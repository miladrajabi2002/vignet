'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { signIn, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { ADMIN_OWNER_PHONE } from '@/lib/admin/owner'
import { ADMIN_COOKIE, createSessionToken } from '@/lib/admin/auth'
import { ADMIN_VISIBLE_USER_WHERE } from '@/lib/admin/reporting-scope'
import { createAdminImpersonationGrant } from '@/lib/admin/impersonation'
import {
  canSwitchUsers,
  listSwitchableUsers,
  type SwitchableUser,
} from '@/lib/admin/user-switcher'
import { captureWarning } from '@/lib/errors/capture'

/** Accounts the platform owner can open from the dashboard header switcher. */
export async function loadSwitchableUsers(): Promise<SwitchableUser[]> {
  const current = await getCurrentUser()
  if (!current || !canSwitchUsers(current)) return []
  return listSwitchableUsers()
}

/**
 * Open /admin straight from the owner's dashboard: the OTP sign-in on the
 * owner phone stands in for the admin password, so mint the admin cookie.
 */
export async function openAdminPanel(): Promise<void> {
  const current = await getCurrentUser()
  if (!current || !canSwitchUsers(current)) redirect('/overview')

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
        action: 'ADMIN_SESSION_FROM_DASHBOARD',
        targetType: 'User',
        targetId: current.id,
        payload: { impersonating: current.impersonatedByAdmin === true } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    captureWarning('admin:dashboard-entry:audit', error, { metadata: { userId: current.id } })
  }

  const { value, maxAge } = createSessionToken()
  ;(await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
  redirect('/admin')
}

export async function startUserImpersonation(formData: FormData): Promise<void> {
  const current = await getCurrentUser()
  if (!current || !canSwitchUsers(current)) redirect('/overview')

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

  // Switching from one customer to another keeps the original owner as the
  // impersonator, so the session can always fall back to the owner account.
  const impersonatorId = current.impersonatedByAdmin ? current.impersonatorId : current.id
  const grant = createAdminImpersonationGrant(user.id, user.workspaceId, Date.now(), impersonatorId)
  await prisma.adminAuditLog.create({
    data: {
      adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
      action: 'START_USER_IMPERSONATION',
      targetType: 'User',
      targetId: user.id,
      payload: {
        workspaceId: user.workspaceId,
        sessionExpiresAt: new Date(grant.sessionExpiresAt).toISOString(),
        source: 'DASHBOARD_USER_SWITCHER',
      } as Prisma.InputJsonValue,
    },
  })

  await signIn('admin-impersonation', {
    grant: grant.token,
    redirectTo: user.workspace.onboardingCompleted ? '/overview' : '/onboarding',
  })
}

/** Leave the support session and land back in the owner's own dashboard. */
export async function stopUserImpersonation(): Promise<void> {
  const user = await getCurrentUser()
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

  const owner = ADMIN_OWNER_PHONE
    ? await prisma.user.findFirst({
        where: { phone: ADMIN_OWNER_PHONE, platformRole: 'ADMIN' },
        select: { id: true, workspaceId: true },
      })
    : null
  if (!owner) {
    await signOut({ redirectTo: '/login' })
    return
  }

  await signIn('admin-impersonation', {
    grant: createAdminImpersonationGrant(owner.id, owner.workspaceId).token,
    redirectTo: '/overview',
  })
}
