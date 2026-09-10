import type { SessionUser } from '@/lib/session'

declare const workspaceIdBrand: unique symbol
export type WorkspaceId = string & { readonly [workspaceIdBrand]: true }

export type WorkspaceVigentoContext = Readonly<{
  kind: 'workspace-owner'
  actorId: string
  workspaceId: WorkspaceId
  requestId: string
  impersonated: boolean
}>

export type PlatformAdminVigentoContext = Readonly<{
  kind: 'platform-admin'
  actorId: string
  requestId: string
}>

export function createWorkspaceVigentoContext(
  user: SessionUser,
  requestId = crypto.randomUUID(),
): WorkspaceVigentoContext {
  return Object.freeze({
    kind: 'workspace-owner' as const,
    actorId: user.id,
    workspaceId: user.workspaceId as WorkspaceId,
    requestId,
    impersonated: user.impersonatedByAdmin === true,
  })
}
