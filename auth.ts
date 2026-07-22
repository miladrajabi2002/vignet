import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { sendWelcomeSms, verifyOTP } from '@/lib/sms/ippanel'
import { normalizePhone } from '@/lib/phone'
import { generateSlug } from '@/lib/utils'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { isPlatformOwnerPhone } from '@/lib/admin/owner'
import { allowOtpVerificationAttempt } from '@/lib/security/otp-attempts'

export const { handlers, auth, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      if (error?.name === 'UnknownAction') return
      console.error('[auth][error]', error)
    },
  },
  providers: [
    Credentials({
      name: 'phone-otp',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Code', type: 'text' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials, request) {
        const phone = normalizePhone(String(credentials?.phone ?? ''))
        const code = String(credentials?.code ?? '')
        const name = credentials?.name ? String(credentials.name).trim() : null
        if (!phone || !/^\d{6}$/.test(code)) return null

        // Sending a code is rate-limited separately. The verification endpoint
        // also needs its own cap or an attacker can brute-force the 6-digit code.
        if (!(await allowOtpVerificationAttempt(phone, request.headers))) return null

        // Verify (and consume) the OTP from Redis.
        const valid = await verifyOTP(phone, code)
        if (!valid) return null

        // Upsert user — first-time login creates a workspace + owner.
        let user = await prisma.user.findUnique({ where: { phone } })
        if (!user) {
          // Name is required to register (the registration form enforces this
          // client-side too). Reject if somehow empty so we never create a
          // workspace/user without an owner name.
          if (!name) return null
          const commercialConfig = await getPlatformCommercialConfig()
          const platformRole = isPlatformOwnerPhone(phone) ? 'ADMIN' : 'USER'
          const workspace = await prisma.workspace.create({
            data: {
              name: name || 'کسب‌وکار من',
              slug: generateSlug(),
              // One full month to experience the platform. The starter reply
              // credit remains unchanged; only successful AI replies consume it.
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              aiCreditBalanceIRR: commercialConfig.trialCreditIRR,
              excludeFromAdminReports: platformRole === 'ADMIN',
            },
          })
          user = await prisma.user.create({
            data: {
              phone,
              name,
              workspaceId: workspace.id,
              platformRole,
            },
          })
          await sendWelcomeSms(phone, { name })
        } else if ((name && !user.name) || user.platformRole !== (isPlatformOwnerPhone(phone) ? 'ADMIN' : 'USER')) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              ...(name && !user.name ? { name } : {}),
              platformRole: isPlatformOwnerPhone(phone) ? 'ADMIN' : 'USER',
            },
          })
        }

        if (user.platformRole === 'ADMIN') {
          await prisma.workspace.update({
            where: { id: user.workspaceId },
            data: { excludeFromAdminReports: true },
          })
        }

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          workspaceId: user.workspaceId,
          platformRole: user.platformRole,
        }
      },
    }),
  ],
})
