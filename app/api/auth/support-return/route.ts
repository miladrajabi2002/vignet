import type { Prisma } from '@prisma/client'
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_OWNER_PHONE, isPlatformOwnerPhone } from '@/lib/admin/owner'
import { createAdminImpersonationGrant } from '@/lib/admin/impersonation'
import { captureWarning } from '@/lib/errors/capture'

export const dynamic = 'force-dynamic'

/**
 * Where an owner support session lands when its 60-minute window ends.
 * Opening a customer account replaced the owner's own session cookie, so
 * rebuild it here — but only for the owner recorded inside the signed session
 * token, and only while that account is still the platform owner. Anything
 * else is signed out exactly like before.
 */
export async function GET() {
  const tokenUser = (await auth())?.user
  const impersonatorId = tokenUser?.impersonatedByAdmin ? tokenUser.impersonatorId : undefined

  const owner = impersonatorId
    ? await prisma.user.findFirst({
        where: { id: impersonatorId, platformRole: 'ADMIN' },
        select: { id: true, workspaceId: true, phone: true },
      })
    : null
  if (!owner || !isPlatformOwnerPhone(owner.phone)) redirect('/api/auth/force-logout')

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
        action: 'STOP_USER_IMPERSONATION',
        targetType: 'User',
        targetId: tokenUser?.id ?? 'unknown',
        payload: {
          workspaceId: tokenUser?.workspaceId ?? null,
          source: 'SESSION_EXPIRED',
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    captureWarning('admin:impersonation:expired-audit', error, {
      metadata: { userId: tokenUser?.id },
    })
  }

  await signIn('admin-impersonation', {
    grant: createAdminImpersonationGrant(owner.id, owner.workspaceId).token,
    redirectTo: '/overview',
  })
}
