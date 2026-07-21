import { describe, expect, it } from 'vitest'
import {
  hasWorkspacePermission,
  permissionForApiMutation,
  permissionForApiRequest,
} from '@/lib/workspace-permissions'

describe('workspace permissions', () => {
  it('keeps billing owner-only', () => {
    const permission = permissionForApiMutation('/api/billing/checkout', 'POST')
    expect(permission).toBe('workspace:owner')
    expect(hasWorkspacePermission('OWNER', permission!)).toBe(true)
    expect(hasWorkspacePermission('ADMIN', permission!)).toBe(false)
  })

  it('allows members to operate conversations but not mutate agents', () => {
    expect(hasWorkspacePermission('MEMBER', permissionForApiMutation('/api/conversations/1/reply', 'POST')!)).toBe(true)
    expect(hasWorkspacePermission('MEMBER', permissionForApiMutation('/api/agents/1', 'PATCH')!)).toBe(false)
  })

  it('keeps the mutation-only resolver backward compatible', () => {
    expect(permissionForApiMutation('/api/agents/1', 'GET')).toBeNull()
    expect(permissionForApiMutation('/api/widget/1/chat', 'POST')).toBeNull()
  })

  it('gates management reads while preserving member operations and public chat', () => {
    expect(permissionForApiRequest('/api/agents/1/channels', 'GET')).toBe('agents:manage')
    expect(permissionForApiRequest('/api/products', 'GET')).toBe('catalog:manage')
    expect(permissionForApiRequest('/api/campaigns', 'GET')).toBe('campaigns:manage')
    expect(permissionForApiRequest('/api/operator-channel/diagnostics', 'GET')).toBe('workspace:configure')
    expect(permissionForApiRequest('/api/conversations/1/messages', 'GET')).toBe('conversations:operate')
    expect(hasWorkspacePermission('MEMBER', permissionForApiRequest('/api/conversations/1/messages', 'GET')!)).toBe(true)
    expect(hasWorkspacePermission('MEMBER', permissionForApiRequest('/api/agents/1/channels', 'GET')!)).toBe(false)
    expect(permissionForApiRequest('/api/widget/1/chat', 'POST')).toBeNull()
  })
})
