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
import { captureError, persistLog } from '@/lib/errors/capture'
import { getClientIp } from '@/lib/security/request-ip'
import { getRequestId } from '@/lib/observability/request-context'

export const { handlers, auth, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      if (error?.name === 'UnknownAction') return
      captureError('auth:next-auth', error)
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
        const startedAt = Date.now()
        const requestId = getRequestId(request.headers)
        const ip = getClientIp(request.headers)
        const phone = normalizePhone(String(credentials?.phone ?? ''))
        const code = String(credentials?.code ?? '')
        const name = credentials?.name ? String(credentials.name).trim() : null
        if (!phone || !/^\d{6}$/.test(code)) {
          await persistLog('warn', 'auth:otp:authorize-invalid-input', 'Malformed phone login credentials', {
            metadata: { requestId, ip, phoneValid: Boolean(phone), codeLength: code.length },
          })
          return null
        }

        // Sending a code is rate-limited separately. The verification endpoint
        // also needs its own cap or an attacker can brute-force the 6-digit code.
        if (!(await allowOtpVerificationAttempt(phone, request.headers))) {
          await persistLog('warn', 'auth:otp:authorize-rate-limit', 'OTP sign-in rate limit exceeded', {
            metadata: { phone, requestId, ip, durationMs: Date.now() - startedAt },
          })
          return null
        }

        // Verify (and consume) the OTP from Redis.
        const valid = await verifyOTP(phone, code)
        if (!valid) {
          await persistLog('warn', 'auth:otp:authorize-invalid-code', 'Incorrect or expired OTP supplied for sign-in', {
            metadata: { phone, requestId, ip, durationMs: Date.now() - startedAt },
          })
          return null
        }

        // Upsert user — first-time login creates a workspace + owner.
        let user = await prisma.user.findUnique({ where: { phone } })
        const existingUserAtStart = Boolean(user)
        if (!user) {
          // Name is required to register (the registration form enforces this
          // client-side too). Reject if somehow empty so we never create a
          // workspace/user without an owner name.
          if (!name) {
            await persistLog('warn', 'auth:otp:registration-name-missing', 'Valid OTP could not create a user because the name was missing', {
              metadata: { phone, requestId, ip, durationMs: Date.now() - startedAt },
            })
            return null
          }
          const commercialConfig = await getPlatformCommercialConfig()
          const platformRole = isPlatformOwnerPhone(phone) ? 'ADMIN' : 'USER'
          // One transaction: a failed user.create must not leave an ownerless
          // workspace row holding trial credit.
          user = await prisma.$transaction(async (tx) => {
            const workspace = await tx.workspace.create({
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
            return tx.user.create({
              data: {
                phone,
                name,
                workspaceId: workspace.id,
                platformRole,
              },
            })
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

        await persistLog('info', 'auth:otp:sign-in-success', 'Phone OTP sign-in completed', {
          workspaceId: user.workspaceId,
          metadata: {
            phone,
            userId: user.id,
            requestId,
            ip,
            isNewUser: !existingUserAtStart,
            platformRole: user.platformRole,
            durationMs: Date.now() - startedAt,
          },
        })

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
