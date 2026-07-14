export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type WorkspacePermission =
  | 'workspace:owner'
  | 'workspace:configure'
  | 'agents:manage'
  | 'catalog:manage'
  | 'campaigns:manage'
  | 'integrations:manage'
  | 'appointments:manage'
  | 'conversations:operate'

const grants: Record<WorkspaceRole, ReadonlySet<WorkspacePermission>> = {
  OWNER: new Set(['workspace:owner', 'workspace:configure', 'agents:manage', 'catalog:manage', 'campaigns:manage', 'integrations:manage', 'appointments:manage', 'conversations:operate']),
  ADMIN: new Set(['workspace:configure', 'agents:manage', 'catalog:manage', 'campaigns:manage', 'integrations:manage', 'appointments:manage', 'conversations:operate']),
  MEMBER: new Set(['appointments:manage', 'conversations:operate']),
}

export function hasWorkspacePermission(role: string | null | undefined, permission: WorkspacePermission): boolean {
  if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'MEMBER') return false
  return grants[role].has(permission)
}

export function permissionForApiMutation(pathname: string, method: string): WorkspacePermission | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return null
  if (pathname === '/api/billing/checkout' || pathname.startsWith('/api/workspace/')) return 'workspace:owner'
  if (pathname.startsWith('/api/settings/') || pathname.startsWith('/api/operator-channel')) return 'workspace:configure'
  if (pathname.startsWith('/api/agents')) return 'agents:manage'
  if (pathname.startsWith('/api/products') || pathname.startsWith('/api/uploads/instagram')) return 'catalog:manage'
  if (pathname.startsWith('/api/campaigns')) return 'campaigns:manage'
  if (pathname.startsWith('/api/integrations') || pathname.startsWith('/api/sync/')) return 'integrations:manage'
  if (pathname.startsWith('/api/appointments')) return 'appointments:manage'
  if (pathname.startsWith('/api/conversations') || pathname.startsWith('/api/contacts') || pathname.startsWith('/api/handoff-alerts')) return 'conversations:operate'
  return null
}
