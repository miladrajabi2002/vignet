/**
 * Regression test for the Instagram automation keywords bug.
 *
 * Bug: when creating a DIRECT_MESSAGE scenario with keywords via the form,
 * `buildPayload()` would discard the keywords because the DM flow never
 * showed the "ANY / SPECIFIC" SegmentedField. As a result `keywordFilter`
 * stayed at its default ('ANY') and `effectiveKeywords` resolved to `[]`,
 * so keywords were never persisted — even though the user typed them and
 * saw them as tags in the UI.
 *
 * Fix: show the SegmentedField for DM too, so users can pick 'SPECIFIC'
 * and have their keywords sent to the API. This test guards the API layer
 * (the contract the form depends on): given a trigger with `keywords`, the
 * POST /api/agents/:agentId/instagram/automations route must persist them
 * verbatim, and PATCH must update them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    getCurrentUser: vi.fn(),
    agentFindFirst: vi.fn(),
    automationCreate: vi.fn(),
    automationFindFirst: vi.fn(),
    automationUpdate: vi.fn(),
  }
})

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findFirst: mocks.agentFindFirst },
    instagramAutomation: {
      create: mocks.automationCreate,
      findFirst: mocks.automationFindFirst,
      update: mocks.automationUpdate,
    },
  },
}))

import { POST } from '@/app/api/agents/[agentId]/instagram/automations/route'
import { PATCH } from '@/app/api/agents/[agentId]/instagram/automations/[id]/route'

const AGENT_ID = 'agent-1'
const CHANNEL_ID = 'ig-channel-1'
const AUTOMATION_ID = 'auto-1'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseDmBody = {
  type: 'DIRECT_MESSAGE',
  name: 'سلام و خوش‌آمد',
  active: true,
  priority: 0,
  trigger: {
    keywords: ['سلام', 'hi', 'hey'],
    matchMode: 'CONTAINS',
    storyScope: 'KEYWORD',
    postIds: [],
  },
  action: {
    replyMode: 'STATIC',
    replyText: 'سلام! خوش آمدی 🌿',
    messages: [],
    dmOnComment: false,
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
  },
}

describe('POST /api/agents/:agentId/instagram/automations — keyword persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.agentFindFirst.mockResolvedValue({
      id: AGENT_ID,
      channels: [{ id: CHANNEL_ID }],
    })
    mocks.automationCreate.mockImplementation(async (args: { data: unknown }) => {
      // Echo back the persisted shape — the trigger must contain keywords.
      const data = args.data as { trigger?: { keywords?: string[] } }
      return {
        id: AUTOMATION_ID,
        agentId: AGENT_ID,
        channelId: CHANNEL_ID,
        trigger: data.trigger,
      }
    })
  })

  it('persists the trigger.keywords verbatim for a DM scenario', async () => {
    const props = { params: Promise.resolve({ agentId: AGENT_ID }) }
    const res = await POST(makeRequest(baseDmBody), props)
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.automation.trigger.keywords).toEqual(['سلام', 'hi', 'hey'])

    // The prisma.create call must have received the keywords unchanged.
    expect(mocks.automationCreate).toHaveBeenCalledOnce()
    const createCall = mocks.automationCreate.mock.calls[0][0] as {
      data: { trigger: { keywords: string[] } }
    }
    expect(createCall.data.trigger.keywords).toEqual(['سلام', 'hi', 'hey'])
  })

  it('rejects an empty keywords array only when the form signals SPECIFIC', async () => {
    // An ANY-style payload intentionally sends keywords: [] (match-all).
    // The API must accept it — the engine treats empty keywords as match-all
    // for DM scenarios (see lib/instagram/automation.ts).
    const anyBody = {
      ...baseDmBody,
      trigger: { ...baseDmBody.trigger, keywords: [] },
    }
    const props = { params: Promise.resolve({ agentId: AGENT_ID }) }
    const res = await POST(makeRequest(anyBody), props)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.automation.trigger.keywords).toEqual([])
  })

  it('rejects a trigger with the wrong shape (defensive zod)', async () => {
    const bad = { ...baseDmBody, trigger: { keywords: 'not-an-array' } }
    const props = { params: Promise.resolve({ agentId: AGENT_ID }) }
    const res = await POST(makeRequest(bad), props)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/agents/:agentId/instagram/automations/:id — keyword update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    // owns() lookup — must return a row whose agent.workspaceId matches.
    mocks.automationFindFirst.mockResolvedValue({
      id: AUTOMATION_ID,
      agent: { workspaceId: 'workspace-1' },
    })
    mocks.automationUpdate.mockImplementation(async (args: { data: unknown }) => {
      const data = args.data as { trigger?: { keywords?: string[] } }
      return {
        id: AUTOMATION_ID,
        trigger: data.trigger ?? { keywords: [] },
      }
    })
  })

  it('updates keywords when a new trigger is sent', async () => {
    const props = {
      params: Promise.resolve({ agentId: AGENT_ID, id: AUTOMATION_ID }),
    }
    const res = await PATCH(
      makePatchRequest({
        trigger: {
          keywords: ['قیمت', 'price'],
          matchMode: 'CONTAINS',
          storyScope: 'KEYWORD',
          postIds: [],
        },
      }),
      props,
    )
    expect(res.status).toBe(200)

    const updateCall = mocks.automationUpdate.mock.calls[0][0] as {
      data: { trigger: { keywords: string[] } }
    }
    expect(updateCall.data.trigger.keywords).toEqual(['قیمت', 'price'])
  })
})
