import { describe, expect, it } from 'vitest'
import { hasWorkspacePermission, permissionForApiMutation } from '@/lib/workspace-permissions'

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

  it('does not gate reads or public chat endpoints', () => {
    expect(permissionForApiMutation('/api/agents/1', 'GET')).toBeNull()
    expect(permissionForApiMutation('/api/widget/1/chat', 'POST')).toBeNull()
  })
})
