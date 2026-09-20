/**
 * Regression test for the Instagram scenario media upload persistence bug.
 *
 * Bug (observed in production 2026-09-20): while an image upload was still
 * in-flight (or had failed), the scenario form saved the browser-session-local
 * `blob:` URL as `messages[].mediaUrl`. A blob: URL is unreachable outside the
 * operator's browser tab, so:
 *   - the dashboard scenario preview showed a permanent 404/broken image, and
 *   - the automation could never deliver the media (Meta's crawler cannot
 *     fetch a blob: URL), so the scenario replied with text only.
 *
 * Fix: the form blocks saves while a blob: URL is present, and the API layer
 * (POST + PATCH) now REJECTS any mediaUrl that is not an empty string or an
 * absolute http(s) URL. This test guards that server-side contract.
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
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: vi.fn(async () => ({ allowed: true, plan: 'STARTER' })),
}))
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

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBody = {
  type: 'DIRECT_MESSAGE' as const,
  name: 'سناریوی عکس',
  active: true,
  priority: 0,
  trigger: {
    keywords: ['قیمت'],
    matchMode: 'CONTAINS',
    storyScope: 'KEYWORD',
    postIds: [],
  },
  action: {
    replyMode: 'STATIC' as const,
    replyText: 'سلام!',
    messages: [
      { type: 'IMAGE' as const, mediaUrl: 'https://vigent.ir/api/uploads/instagram/ws/2026/09/1-abc.jpg' },
    ],
    mediaType: 'TEXT' as const,
    mediaUrl: '',
    productId: '',
    dmOnComment: false,
    commentAckEnabled: false,
    commentAckText: '',
    followGate: false,
    gateMode: 'SOFT' as const,
    gateButtonType: 'button' as const,
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

describe('mediaUrl validation — blob:/data: URLs must never persist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.agentFindFirst.mockResolvedValue({
      id: AGENT_ID,
      channels: [{ id: CHANNEL_ID }],
    })
    mocks.automationCreate.mockImplementation(async (args: { data: unknown }) => args.data)
    mocks.automationFindFirst.mockResolvedValue({
      id: AUTOMATION_ID,
      agent: { workspaceId: 'workspace-1' },
    })
    mocks.automationUpdate.mockImplementation(async (args: { data: unknown }) => args.data)
  })

  it('POST rejects a blob: URL in messages[].mediaUrl with 400', async () => {
    const body = {
      ...baseBody,
      action: {
        ...baseBody.action,
        messages: [
          { type: 'IMAGE', mediaUrl: 'blob:https://vigent.ir/ac99365c-0a40-4fe9-88c0-3c20cb008286' },
        ],
      },
    }
    const res = await POST(makeRequest(body), { params: Promise.resolve({ agentId: AGENT_ID }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('INVALID')
    expect(mocks.automationCreate).not.toHaveBeenCalled()
  })

  it('POST rejects a blob: URL in action.mediaUrl (legacy field) with 400', async () => {
    const body = {
      ...baseBody,
      action: {
        ...baseBody.action,
        messages: [],
        mediaType: 'IMAGE',
        mediaUrl: 'blob:https://vigent.ir/deadbeef',
      },
    }
    const res = await POST(makeRequest(body), { params: Promise.resolve({ agentId: AGENT_ID }) })
    expect(res.status).toBe(400)
    expect(mocks.automationCreate).not.toHaveBeenCalled()
  })

  it('POST rejects a data: URL in messages[].mediaUrl with 400', async () => {
    const body = {
      ...baseBody,
      action: {
        ...baseBody.action,
        messages: [{ type: 'IMAGE', mediaUrl: 'data:image/png;base64,iVBORw0KGgo=' }],
      },
    }
    const res = await POST(makeRequest(body), { params: Promise.resolve({ agentId: AGENT_ID }) })
    expect(res.status).toBe(400)
    expect(mocks.automationCreate).not.toHaveBeenCalled()
  })

  it('POST accepts a valid https mediaUrl and persists it verbatim', async () => {
    const url = 'https://vigent.ir/api/uploads/instagram/ws-1/2026/09/1789930920181-44d8d97a.jpg'
    const body = {
      ...baseBody,
      action: { ...baseBody.action, messages: [{ type: 'IMAGE', mediaUrl: url }] },
    }
    const res = await POST(makeRequest(body), { params: Promise.resolve({ agentId: AGENT_ID }) })
    expect(res.status).toBe(201)
    const createCall = mocks.automationCreate.mock.calls[0][0] as {
      data: { action: { messages: Array<{ mediaUrl?: string }> } }
    }
    expect(createCall.data.action.messages[0].mediaUrl).toBe(url)
  })

  it('POST accepts an empty mediaUrl string', async () => {
    const body = {
      ...baseBody,
      action: { ...baseBody.action, messages: [], mediaUrl: '' },
    }
    const res = await POST(makeRequest(body), { params: Promise.resolve({ agentId: AGENT_ID }) })
    expect(res.status).toBe(201)
  })

  it('PATCH rejects a blob: URL in messages[].mediaUrl with 400', async () => {
    const body = {
      action: {
        replyMode: 'STATIC',
        messages: [{ type: 'IMAGE', mediaUrl: 'blob:http://localhost/x' }],
      },
    }
    const res = await PATCH(makeRequest(body, 'PATCH'), {
      params: Promise.resolve({ agentId: AGENT_ID, id: AUTOMATION_ID }),
    })
    expect(res.status).toBe(400)
    expect(mocks.automationUpdate).not.toHaveBeenCalled()
  })

  it('PATCH rejects a blob: URL in action.mediaUrl with 400', async () => {
    const body = {
      action: { mediaType: 'IMAGE', mediaUrl: 'blob:https://vigent.ir/y' },
    }
    const res = await PATCH(makeRequest(body, 'PATCH'), {
      params: Promise.resolve({ agentId: AGENT_ID, id: AUTOMATION_ID }),
    })
    expect(res.status).toBe(400)
    expect(mocks.automationUpdate).not.toHaveBeenCalled()
  })

  it('PATCH accepts a valid https mediaUrl', async () => {
    const body = {
      action: {
        mediaType: 'IMAGE',
        mediaUrl: 'https://vigent.ir/api/uploads/instagram/ws/2026/09/2-def.jpg',
      },
    }
    const res = await PATCH(makeRequest(body, 'PATCH'), {
      params: Promise.resolve({ agentId: AGENT_ID, id: AUTOMATION_ID }),
    })
    expect(res.status).toBe(200)
    expect(mocks.automationUpdate).toHaveBeenCalledOnce()
  })
})
