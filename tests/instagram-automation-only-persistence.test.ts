import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  agentChannelFindFirst: vi.fn(),
  agentChannelUpdate: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationFindUnique: vi.fn(),
  conversationUpdate: vi.fn(),
  conversationUpdateMany: vi.fn(),
  messageFindFirst: vi.fn(),
  transaction: vi.fn(),
  parseUpdate: vi.fn(),
  sendText: vi.fn(),
  transcribeAudio: vi.fn(),
  isMarketingOptOutMessage: vi.fn(),
  fixedReply: vi.fn(),
  resolveInboundContact: vi.fn(),
  generateReply: vi.fn(),
  loadAutomationPolicy: vi.fn(),
  willAutomationHandle: vi.fn(),
  willAutomationSilentlyIgnore: vi.fn(),
  runAutomation: vi.fn(),
  shouldAgentReply: vi.fn(),
  claimInboundEvent: vi.fn(),
  markEffectsCommitted: vi.fn(),
  completeInboundEvent: vi.fn(),
  notifyHandoff: vi.fn(),
  notifyWorkspace: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentChannel: {
      findFirst: mocks.agentChannelFindFirst,
      update: mocks.agentChannelUpdate,
    },
    conversation: {
      findFirst: mocks.conversationFindFirst,
      findUnique: mocks.conversationFindUnique,
      update: mocks.conversationUpdate,
      updateMany: mocks.conversationUpdateMany,
    },
    message: { findFirst: mocks.messageFindFirst, findUnique: vi.fn().mockResolvedValue(null) },
    contact: { findUnique: vi.fn().mockResolvedValue({ name: 'Contact' }), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn().mockResolvedValue(null) },
    instagramAutomationSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    inboundEvent: { update: vi.fn().mockResolvedValue({}) },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/crm/contact-identity', () => ({
  resolveInboundContact: mocks.resolveInboundContact,
}))
vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: mocks.generateReply }))
vi.mock('@/lib/ai/handoff', () => ({
  notifyHandoff: mocks.notifyHandoff,
  shouldHandoff: vi.fn(),
  handoffReplyText: vi.fn(() => ''),
  detectUnanswered: vi.fn(() => false),
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: mocks.notifyWorkspace }))
vi.mock('@/lib/billing/trial-quota-alert', () => ({
  processTrialQuotaAlert: vi.fn(),
  isCreditExhausted: vi.fn(),
}))
vi.mock('@/lib/channels/fixed-replies', () => ({
  fixedReplyForWorkspace: mocks.fixedReply,
  fixedReplyFromProfile: vi.fn(() => 'متن پیش‌فرض'),
  WAITING_MESSAGE_MIN_INTERVAL_MS: 60_000,
}))
vi.mock('@/lib/crm/contact-activity', () => ({ bumpContactActivity: vi.fn() }))
vi.mock('@/lib/conversations/activity', () => ({
  recordConversationActivity: vi.fn(),
  buildTurnReceipts: vi.fn(() => []),
  metadataWithReceipts: vi.fn(() => ({})),
}))
vi.mock('@/lib/channels/registry', () => ({
  isMessengerType: () => true,
  getAdapter: () => ({
    parseUpdate: mocks.parseUpdate,
    sendText: mocks.sendText,
  }),
}))
vi.mock('@/lib/channels/config', () => ({
  readBotToken: () => 'access-token',
  normalizeMessengerSettings: () => ({ quickReplies: [] }),
}))
vi.mock('@/lib/instagram/config', () => ({
  readPageToken: () => 'access-token',
  normalizeInstagramSettings: () => ({ quickReplies: [] }),
}))
vi.mock('@/lib/instagram/automation', () => ({
  loadAutomationPolicy: mocks.loadAutomationPolicy,
  willInstagramAutomationHandle: mocks.willAutomationHandle,
  willInstagramAutomationSilentlyIgnore: mocks.willAutomationSilentlyIgnore,
  runInstagramAutomation: mocks.runAutomation,
  shouldAgentReply: mocks.shouldAgentReply,
}))
vi.mock('@/lib/channels/idempotency', () => ({
  InboundEventLeaseBusyError: class InboundEventLeaseBusyError extends Error {},
  InboundEventLeaseLostError: class InboundEventLeaseLostError extends Error {},
  inboundExternalEventId: () => 'ig:mid-1:DM',
  claimInboundEvent: mocks.claimInboundEvent,
  withInboundEventLease: async (_lease: unknown, run: (guard: { assertActive: () => Promise<void> }) => Promise<void>) =>
    run({ assertActive: async () => undefined }),
  beginInboundEventDispatch: vi.fn().mockResolvedValue(true),
  markInboundEventEffectsCommitted: mocks.markEffectsCommitted,
  markInboundEventDeliveryCompleted: vi.fn(),
  markInboundEventDeliveryUncertain: vi.fn(),
  completeInboundEvent: mocks.completeInboundEvent,
  failInboundEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/channels/conversation-lock', () => ({
  withConversationTurnLock: async (
    _args: unknown,
    run: (guard: { assertActive: () => Promise<void>; lease: { id: string } }) => Promise<void>,
  ) => run({ assertActive: async () => undefined, lease: { id: 'conversation-lease' } }),
}))
vi.mock('@/lib/conversations/source', () => ({ inboundMessageMetadata: () => ({ source: 'instagram' }) }))
vi.mock('@/lib/crm/marketing-consent', () => ({
  isMarketingOptOutMessage: mocks.isMarketingOptOutMessage,
  optOutConfirmation: vi.fn(),
  optOutContact: vi.fn(),
}))
vi.mock('@/lib/instagram/emoji', () => ({ isEmojiOnly: () => false }))
vi.mock('@/lib/instagram/sender-profile', () => ({ fetchInstagramSenderProfile: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/voice/stt', () => ({ transcribeAudio: mocks.transcribeAudio, downloadAudio: vi.fn() }))
vi.mock('@/lib/voice/tts', () => ({ synthesizeSpeech: vi.fn() }))
vi.mock('@/lib/ai/sales-intelligence', () => ({ refreshConversationSalesInsight: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/instagram/media', () => ({ sendProductCarousel: vi.fn() }))
vi.mock('@/lib/products/presentation', () => ({
  formatProductFallback: vi.fn(() => ''),
  parseProductDirectives: vi.fn((text: string) => ({ text, directives: [] })),
  resolveProductShowcases: vi.fn(() => []),
}))
vi.mock('@/lib/channels/typing', () => ({ startChannelTyping: vi.fn() }))

import { handleInbound } from '@/lib/channels/handler'

const automationOnlyPolicy = {
  replyPolicy: 'AUTOMATION_ONLY',
  dmReplyPolicy: 'AUTOMATION_ONLY',
  storyReplyPolicy: 'AUTOMATION_ONLY',
  commentReplyPolicy: 'AUTOMATION_ONLY',
  stopWords: [],
  aiEnabled: true,
  storyReactionReplyEnabled: false,
  storyReactionReplyText: null,
  commentEmojiReplyEnabled: false,
  commentEmojiReplyText: null,
  likeDmAfterReply: false,
  likeStoryReplyAfterReply: false,
  likeStoryReactionAfterReply: false,
  likeCommentAfterReply: false,
}

describe('Instagram AUTOMATION_ONLY inbound persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isMarketingOptOutMessage.mockReturnValue(false)
    mocks.fixedReply.mockResolvedValue('متن پیش‌فرض')
    mocks.agentChannelFindFirst.mockResolvedValue({
      id: 'channel-1',
      config: { accessToken: 'encrypted' },
      agent: {
        id: 'agent-1',
        name: 'ایجنت تست',
        workspaceId: 'workspace-1',
        systemPrompt: 'system',
        language: 'fa',
        model: null,
        temperature: 0.2,
        maxTokens: 500,
        fallbackMessage: null,
        welcomeMessage: null,
        handoffEnabled: false,
        handoffMessage: null,
        handoffKeywords: [],
        voiceEnabled: false,
        ttsVoice: 'alloy',
        active: true,
        promptConfig: null,
        roleTemplate: null,
        requireCustomerInfo: false,
        customerInfoPrompt: null,
        productAccessEnabled: false,
        orderTrackingEnabled: false,
      },
    })
    mocks.agentChannelUpdate.mockResolvedValue({})
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM',
      platformMessageId: 'mid-1',
      senderId: 'sender-1',
      senderName: 'Sender',
      text: 'پیامی که هیچ سناریویی نمی‌گیرد',
      chatId: 'sender-1',
    }])
    mocks.claimInboundEvent.mockResolvedValue({
      status: 'claimed',
      lease: {
        id: 'event-1',
        leaseToken: 'event-lease',
        deliveryStartedAt: null,
        deliveryCompletedAt: null,
      },
    })
    mocks.loadAutomationPolicy.mockResolvedValue(automationOnlyPolicy)
    mocks.conversationFindFirst.mockResolvedValue(null)
    mocks.willAutomationHandle.mockResolvedValue(false)
    mocks.willAutomationSilentlyIgnore.mockResolvedValue(false)
    mocks.markEffectsCommitted.mockResolvedValue(undefined)
    mocks.completeInboundEvent.mockResolvedValue(undefined)
    mocks.conversationUpdate.mockResolvedValue({})
    mocks.conversationUpdateMany.mockResolvedValue({ count: 1 })
    mocks.conversationFindUnique.mockResolvedValue(null)
    mocks.messageFindFirst.mockResolvedValue(null)
    mocks.notifyHandoff.mockResolvedValue(undefined)
    mocks.notifyWorkspace.mockResolvedValue(undefined)
    mocks.sendText.mockResolvedValue(undefined)
    mocks.resolveInboundContact.mockResolvedValue('contact-1')
    // persistInboundOnly / persistFixedAssistantReply run inside $transaction.
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      typeof fn === 'function'
        ? fn({
            conversation: {
              upsert: vi.fn().mockResolvedValue({ id: 'conversation-1', status: 'OPEN', handedOff: false }),
              update: vi.fn().mockResolvedValue({}),
            },
            message: {
              findFirst: vi.fn().mockResolvedValue(null),
              findUnique: vi.fn().mockResolvedValue(null),
              findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'message-1', conversationId: 'conversation-1' }),
              create: vi.fn().mockResolvedValue({ id: 'message-1' }),
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
              update: vi.fn().mockResolvedValue({}),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
              count: vi.fn().mockResolvedValue(1),
            },
            contact: { update: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
            conversationSalesInsight: { upsert: vi.fn().mockResolvedValue({}) },
          })
        : Promise.resolve([]),
    )
  })

  it.each(['DM', 'COMMENT', 'STORY_REPLY', 'STORY_MENTION', 'STORY_REACTION', 'REACTION'] as const)(
    'ignores an unmatched %s without a reply, contact, conversation or handoff',
    async (kind) => {
      mocks.parseUpdate.mockReturnValue([{
        kind,
        platformMessageId: 'mid-1',
        senderId: 'sender-1',
        senderName: 'Sender',
        text: 'پیامی که هیچ سناریویی نمی‌گیرد',
        chatId: 'sender-1',
        ...(kind === 'COMMENT' ? { commentId: 'comment-1', postId: 'post-1' } : {}),
        ...(kind === 'STORY_REPLY' ? { storyId: 'story-1' } : {}),
      }])

      await handleInbound('INSTAGRAM', 'webhook-token', { object: 'instagram' })

      expect(mocks.willAutomationHandle).toHaveBeenCalledWith({
        agentId: 'agent-1',
        channelId: 'channel-1',
        msg: expect.objectContaining({ platformMessageId: 'mid-1' }),
      })
      expect(mocks.resolveInboundContact).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
      expect(mocks.sendText).not.toHaveBeenCalled()
      expect(mocks.fixedReply).not.toHaveBeenCalled()
      expect(mocks.conversationUpdateMany).not.toHaveBeenCalled()
      expect(mocks.conversationUpdate).not.toHaveBeenCalled()
      expect(mocks.notifyHandoff).not.toHaveBeenCalled()
      expect(mocks.notifyWorkspace).not.toHaveBeenCalled()
      expect(mocks.runAutomation).not.toHaveBeenCalled()
      expect(mocks.generateReply).not.toHaveBeenCalled()
      expect(mocks.markEffectsCommitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-1' }),
        expect.objectContaining({
          conversationId: null,
          inboundMessageId: null,
          resultMessageId: null,
          result: { outcome: 'AUTOMATION_ONLY_UNMATCHED' },
        }),
      )
      expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
    },
  )

  it('ignores unmatched messages even when the previous thread belongs to an operator', async () => {
    mocks.conversationFindFirst.mockResolvedValue({ id: 'old-thread', status: 'HANDED_OFF', handedOff: true })
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.notifyHandoff).not.toHaveBeenCalled()
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('does not let an opt-out phrase trigger an unconfigured reply or conversation', async () => {
    mocks.isMarketingOptOutMessage.mockReturnValue(true)
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.resolveInboundContact).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('settles a SILENT scenario without creating a brand-new conversation', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1', text: 'فالو کردم',
    }])
    mocks.willAutomationHandle.mockResolvedValue(true)
    mocks.willAutomationSilentlyIgnore.mockResolvedValue(true)
    mocks.conversationFindFirst.mockResolvedValue(null)

    await handleInbound('INSTAGRAM', 'webhook-token', {})

    expect(mocks.resolveInboundContact).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.runAutomation).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.markEffectsCommitted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: null,
        inboundMessageId: null,
        resultMessageId: null,
        result: { outcome: 'SILENT_AUTOMATION_IGNORED' },
      }),
    )
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('keeps a SILENT message when the sender already has a conversation', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1', text: 'فالو کردم',
    }])
    mocks.willAutomationHandle.mockResolvedValue(true)
    mocks.willAutomationSilentlyIgnore.mockResolvedValue(true)
    mocks.conversationFindFirst.mockResolvedValue({ id: 'conversation-1' })
    mocks.runAutomation.mockResolvedValue({ handled: true, replied: false })

    await handleInbound('INSTAGRAM', 'webhook-token', {})

    expect(mocks.resolveInboundContact).toHaveBeenCalledOnce()
    expect(mocks.transaction).toHaveBeenCalled()
    expect(mocks.runAutomation).toHaveBeenCalledOnce()
    expect(mocks.markEffectsCommitted).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ result: { outcome: 'AUTOMATION_HANDLED' } }),
    )
  })

  it('ignores unmatched media without transcription or a generic media reply', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1',
      text: '', hasMedia: true, voiceFileId: 'voice-1',
    }])
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.transcribeAudio).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.fixedReply).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it.each(['DM', 'COMMENT', 'STORY_REPLY'] as const)('still executes a configured %s scenario without the default agent', async (kind) => {
    mocks.parseUpdate.mockReturnValue([{
      kind, platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1', text: 'سویشرت',
    }])
    mocks.willAutomationHandle.mockResolvedValue(true)
    mocks.runAutomation.mockResolvedValue({ handled: true, replied: false })
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.runAutomation).toHaveBeenCalledOnce()
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.fixedReply).not.toHaveBeenCalled()
    expect(mocks.notifyHandoff).not.toHaveBeenCalled()
    expect(mocks.markEffectsCommitted).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ result: { outcome: 'AUTOMATION_HANDLED' } }),
    )
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('honors an explicitly configured story reaction reply', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'STORY_REACTION', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1', text: '❤️',
    }])
    mocks.loadAutomationPolicy.mockResolvedValue({
      ...automationOnlyPolicy, storyReactionReplyEnabled: true, storyReactionReplyText: 'ممنون از شما',
    })
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.sendText).toHaveBeenCalledWith('sender-1', 'ممنون از شما', expect.anything())
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.notifyHandoff).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('uses the event-specific policy instead of the global automation-only default', async () => {
    mocks.loadAutomationPolicy.mockResolvedValue({
      ...automationOnlyPolicy, dmReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
    })
    mocks.runAutomation.mockResolvedValue({ handled: false, replied: false })
    mocks.shouldAgentReply.mockResolvedValue(false)
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.willAutomationHandle).not.toHaveBeenCalled()
    expect(mocks.resolveInboundContact).toHaveBeenCalledOnce()
    expect(mocks.transaction).toHaveBeenCalled()
    expect(mocks.shouldAgentReply).toHaveBeenCalledOnce()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('runs a matching media scenario without inserting a generic media reply', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1',
      text: '', hasMedia: true,
    }])
    mocks.willAutomationHandle.mockResolvedValue(true)
    mocks.runAutomation.mockResolvedValue({ handled: true, replied: false })
    await handleInbound('INSTAGRAM', 'webhook-token', {})
    expect(mocks.runAutomation).toHaveBeenCalledOnce()
    expect(mocks.fixedReply).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })

  it('hands unsupported media to an operator when the regular agent owns the DM', async () => {
    mocks.parseUpdate.mockReturnValue([{
      kind: 'DM', platformMessageId: 'mid-1', senderId: 'sender-1', chatId: 'sender-1',
      text: '', hasMedia: true, mediaKind: 'image',
    }])
    mocks.loadAutomationPolicy.mockResolvedValue({
      ...automationOnlyPolicy, dmReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
    })

    await handleInbound('INSTAGRAM', 'webhook-token', {})

    expect(mocks.fixedReply).toHaveBeenCalledWith('mediaUnsupportedMessage', 'workspace-1')
    expect(mocks.conversationUpdateMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: { handedOff: true, status: 'HANDED_OFF' },
    })
    expect(mocks.notifyHandoff).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      conversationId: 'conversation-1',
      agentId: 'agent-1',
      reason: expect.stringContaining('image'),
    }))
    expect(mocks.sendText).toHaveBeenCalledWith('sender-1', 'متن پیش‌فرض', undefined)
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.completeInboundEvent).toHaveBeenCalledOnce()
  })
})
