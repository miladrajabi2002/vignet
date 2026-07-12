import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { sendWelcomeSms, verifyOTP } from '@/lib/sms/ippanel'
import { normalizePhone } from '@/lib/phone'
import { generateSlug } from '@/lib/utils'

// ─── Demo login ────────────────────────────────────────────────────
// A dedicated phone number + code that bypasses SMS OTP. Lets anyone
// explore the dashboard without a real phone. The demo workspace is
// seeded by `bun run seed:demo`.
// Note: stored in E.164 (+98…) to match the normalized form from phoneSchema.
export const DEMO_PHONE = '+989120000000'
export const DEMO_CODE = '123456'
export const DEMO_NAME = 'کاربر دمو ویجنت'
function isDemoLogin(phone: string, code: string) {
  return phone === DEMO_PHONE && code === DEMO_CODE
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      async authorize(credentials) {
        const phone = normalizePhone(String(credentials?.phone ?? ''))
        const code = String(credentials?.code ?? '')
        const name = credentials?.name ? String(credentials.name).trim() : null
        if (!phone || !/^\d{6}$/.test(code)) return null

        // Demo bypass — skip Redis OTP, skip SMS.
        const isDemo = isDemoLogin(phone, code)

        if (!isDemo) {
          // Verify (and consume) the OTP from Redis.
          const valid = await verifyOTP(phone, code)
          if (!valid) return null
        }

        // Upsert user — first-time login creates a workspace + owner.
        let user = await prisma.user.findUnique({ where: { phone } })
        if (!user) {
          if (!name && !isDemo) return null
          const workspace = await prisma.workspace.create({
            data: {
              name: name || (isDemo ? DEMO_NAME : 'کسب‌وکار من'),
              slug: generateSlug(),
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              aiCreditBalanceIRR: (() => {
                const value = Number(process.env.AI_TRIAL_CREDIT_IRR)
                return Number.isFinite(value) && value >= 0 ? Math.round(value) : 100_000
              })(),
            },
          })
          user = await prisma.user.create({
            data: {
              phone,
              name: name || (isDemo ? DEMO_NAME : null),
              workspaceId: workspace.id,
              role: 'OWNER',
            },
          })
          if (!isDemo) await sendWelcomeSms(phone, { name: name! })
        } else if (name && !user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name },
          })
        }

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          workspaceId: user.workspaceId,
          role: user.role,
        }
      },
    }),
  ],
})
