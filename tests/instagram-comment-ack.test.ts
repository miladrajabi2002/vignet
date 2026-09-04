/**
 * Regression test for the "comment left unanswered" bug.
 *
 * Bug: COMMENT scenarios with `dmOnComment` deliver their content in the
 * commenter's DM — which left the PUBLIC comment itself with no reply at all
 * ("وقتی در جواب کامنت دایرکت می‌فرستیم، کامنت بی‌جواب می‌ماند").
 *
 * Fix: a new per-scenario action field pair (commentAckEnabled +
 * commentAckText) posts a short public reply ON the comment (adapter routes
 * the `comment:<id>` chatId to /{comment-id}/replies) after the DM goes out.
 *
 * Contract tested here (engine level, lib/instagram/automation.ts):
 *   1. comment + dmOnComment + commentAckEnabled  → DM send + public ack send
 *   2. comment + dmOnComment + ack disabled       → DM send only (legacy)
 *   3. ack text empty                             → no public send
 *   4. a failing ack must NOT break the DM delivery (best-effort)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
        return {
                automationFindMany: vi.fn(),
                followGateFindFirst: vi.fn(),
                generateReply: vi.fn(),
                captureError: vi.fn(),
        }
})

vi.mock('@/lib/prisma', () => ({
        prisma: {
                instagramAutomation: { findMany: mocks.automationFindMany },
                instagramFollowGate: { findFirst: mocks.followGateFindFirst },
        },
}))
vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: mocks.generateReply }))
vi.mock('@/lib/channels/typing', () => ({ startChannelTyping: vi.fn() }))
vi.mock('@/lib/instagram/media', () => ({
        sendImage: vi.fn(),
        sendAudio: vi.fn(),
        sendVideo: vi.fn(),
        sendProductCard: vi.fn(),
        sendRichEntry: vi.fn(),
        sendButtonMessage: vi.fn(),
        pickTemplateImageUrl: vi.fn(),
}))
vi.mock('@/lib/instagram/config', () => ({
        readAutomationPolicy: vi.fn(),
        readUserToken: vi.fn(),
        readPageToken: vi.fn(),
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))

import { runInstagramAutomation } from '@/lib/instagram/automation'

const AGENT_ID = 'agent-1'
const CHANNEL_ID = 'ig-channel-1'

function commentScenario(action: Record<string, unknown>) {
        return {
                id: 'auto-1',
                agentId: AGENT_ID,
                channelId: CHANNEL_ID,
                type: 'COMMENT',
                name: 'قیمت',
                active: true,
                priority: 0,
                trigger: {
                        keywords: ['قیمت'],
                        matchMode: 'CONTAINS',
                        storyScope: 'KEYWORD',
                        postIds: [],
                },
                action: {
                        replyMode: 'STATIC',
                        replyText: 'لینک محصول برایتان فرستاده شد',
                        messages: [],
                        mediaType: 'TEXT',
                        mediaUrl: '',
                        productId: '',
                        dmOnComment: true,
                        followGate: false,
                        gateMode: 'SOFT',
                        gateButtonType: 'button',
                        gatePrompt: '',
                        gateConfirmKeyword: '',
                        gateQuickReply: '',
                        contentText: '',
                        aiAgentEnabled: false,
                        followUpEnabled: false,
                        followUpDelayMin: 60,
                        followUpMessage: '',
                        ...action,
                },
        }
}

function runEngine(adapter: { sendText: ReturnType<typeof vi.fn> }) {
        return runInstagramAutomation({
                agent: { id: AGENT_ID, workspaceId: 'ws-1', name: 'Bot' } as never,
                channelId: CHANNEL_ID,
                adapter: adapter as never,
                msg: {
                        chatId: 'comment:cmt-1',
                        senderId: 'user-1',
                        text: 'قیمت',
                        kind: 'COMMENT' as never,
                        commentId: 'cmt-1',
                        platformMessageId: 'cmt-1',
                } as never,
                contactId: null,
                contactName: null,
                quickReplies: [],
        })
}

describe('Instagram comment→DM ack (commentAck*)', () => {
        beforeEach(() => {
                vi.clearAllMocks()
                mocks.followGateFindFirst.mockResolvedValue(null)
                mocks.generateReply.mockResolvedValue({ reply: 'x' })
        })

        it('sends the DM AND posts the configured public ack on the comment', async () => {
                mocks.automationFindMany.mockResolvedValue([
                        commentScenario({
                                commentAckEnabled: true,
                                commentAckText: 'تو دایرکت فرستادم 🌟',
                        }),
                ])
                const adapter = { sendText: vi.fn().mockResolvedValue(undefined) }

                const result = await runEngine(adapter)

                expect(result.handled).toBe(true)
                expect(result.replied).toBe(true)
                // 1) the DM to the commenter (private reply target)
                expect(adapter.sendText).toHaveBeenCalledWith(
                        expect.stringMatching(/^private:cmt-1/),
                        'لینک محصول برایتان فرستاده شد',
                        expect.anything(),
                )
                // 2) the public ack ON the comment (comment: chatId → /replies)
                expect(adapter.sendText).toHaveBeenCalledWith(
                        'comment:cmt-1',
                        'تو دایرکت فرستادم 🌟',
                        undefined,
                )
        })

        it('keeps legacy behavior when the ack is disabled (DM only)', async () => {
                mocks.automationFindMany.mockResolvedValue([
                        commentScenario({ commentAckEnabled: false }),
                ])
                const adapter = { sendText: vi.fn().mockResolvedValue(undefined) }

                await runEngine(adapter)

                expect(adapter.sendText).toHaveBeenCalledTimes(1)
                expect(adapter.sendText).toHaveBeenCalledWith(
                        expect.stringMatching(/^private:cmt-1/),
                        'لینک محصول برایتان فرستاده شد',
                        expect.anything(),
                )
        })

        it('does not post an empty ack', async () => {
                mocks.automationFindMany.mockResolvedValue([
                        commentScenario({ commentAckEnabled: true, commentAckText: '   ' }),
                ])
                const adapter = { sendText: vi.fn().mockResolvedValue(undefined) }

                await runEngine(adapter)

                expect(adapter.sendText).toHaveBeenCalledTimes(1)
        })

        it('never breaks the DM delivery when the ack send fails', async () => {
                mocks.automationFindMany.mockResolvedValue([
                        commentScenario({
                                commentAckEnabled: true,
                                commentAckText: 'تو دایرکت فرستادم 🌟',
                        }),
                ])
                const adapter = {
                        sendText: vi
                                .fn()
                                .mockResolvedValueOnce(undefined) // DM ok
                                .mockRejectedValueOnce(new Error('comment reply failed (500)')), // ack fails
                }

                const result = await runEngine(adapter)

                // The DM went out, the run is still "handled", and the failure was
                // captured instead of thrown.
                expect(adapter.sendText).toHaveBeenCalledTimes(2)
                expect(result.handled).toBe(true)
                expect(result.replied).toBe(true)
                expect(mocks.captureError).toHaveBeenCalledWith(
                        'instagram:automation:comment-ack',
                        expect.any(Error),
                        expect.anything(),
                )
        })
})
