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

/**
 * Resolve permissions for both management reads and mutations. Read access to
 * operational conversations/appointments remains available to MEMBER, while
 * agent prompts, catalogs, campaigns, integrations and operator configuration
 * require their corresponding management grant.
 */
export function permissionForApiRequest(
  pathname: string,
  method: string,
): WorkspacePermission | null {
  if (method.toUpperCase() !== 'GET') {
    return permissionForApiMutation(pathname, method)
  }

  if (pathname === '/api/agents' || pathname.startsWith('/api/agents/')) {
    return 'agents:manage'
  }
  if (pathname === '/api/products' || pathname.startsWith('/api/products/')) {
    return 'catalog:manage'
  }
  if (pathname === '/api/campaigns' || pathname.startsWith('/api/campaigns/')) {
    return 'campaigns:manage'
  }
  if (pathname === '/api/integrations' || pathname.startsWith('/api/integrations/')) {
    return 'integrations:manage'
  }
  if (pathname === '/api/operator-channel' || pathname.startsWith('/api/operator-channel/')) {
    return 'workspace:configure'
  }
  if (pathname === '/api/appointments' || pathname.startsWith('/api/appointments/')) {
    return 'appointments:manage'
  }
  if (
    pathname === '/api/conversations' ||
    pathname.startsWith('/api/conversations/') ||
    pathname === '/api/contacts' ||
    pathname.startsWith('/api/contacts/') ||
    pathname === '/api/handoff-alerts' ||
    pathname.startsWith('/api/handoff-alerts/') ||
    pathname === '/api/crm/live'
  ) {
    return 'conversations:operate'
  }

  return null
}
