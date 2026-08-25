'use server'

import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { auth, signIn, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { ADMIN_OWNER_PHONE } from '@/lib/admin/owner'
import { ADMIN_VISIBLE_USER_WHERE } from '@/lib/admin/reporting-scope'
import { createAdminImpersonationGrant } from '@/lib/admin/impersonation'
import { captureWarning } from '@/lib/errors/capture'

export async function startUserImpersonation(formData: FormData): Promise<void> {
  await requireAdmin()

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId || userId.length > 128) throw new Error('IMPERSONATION_USER_NOT_FOUND')

  const user = await prisma.user.findFirst({
    where: {
      ...ADMIN_VISIBLE_USER_WHERE,
      id: userId,
      platformRole: 'USER',
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      workspace: { select: { onboardingCompleted: true } },
    },
  })
  if (!user) throw new Error('IMPERSONATION_USER_NOT_FOUND')

  const grant = createAdminImpersonationGrant(user.id, user.workspaceId)
  await prisma.adminAuditLog.create({
    data: {
      adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
      action: 'START_USER_IMPERSONATION',
      targetType: 'User',
      targetId: user.id,
      payload: {
        workspaceId: user.workspaceId,
        sessionExpiresAt: new Date(grant.sessionExpiresAt).toISOString(),
        source: 'ADMIN_USER_DETAIL',
      } as Prisma.InputJsonValue,
    },
  })

  await signIn('admin-impersonation', {
    grant: grant.token,
    redirectTo: user.workspace.onboardingCompleted ? '/overview' : '/onboarding',
  })
}

export async function stopUserImpersonation(): Promise<void> {
  const session = await auth()
  const user = session?.user
  if (!user?.impersonatedByAdmin) redirect('/overview')

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
        action: 'STOP_USER_IMPERSONATION',
        targetType: 'User',
        targetId: user.id,
        payload: {
          workspaceId: user.workspaceId,
          source: 'USER_DASHBOARD',
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    // Losing the audit write must never trap the admin inside the user session.
    captureWarning('admin:impersonation:stop-audit', error, {
      workspaceId: user.workspaceId,
      metadata: { userId: user.id },
    })
  }

  await signOut({ redirectTo: `/admin/users/${user.id}` })
}
