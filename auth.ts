import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { verifyOTP } from '@/lib/sms/smsir'
import { normalizePhone } from '@/lib/phone'
import { generateSlug } from '@/lib/utils'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Bots/scanners constantly probe /api/auth/* with invalid actions, which
    // makes authjs throw UnknownAction (a harmless 400) and flood the pm2
    // error log. Swallow just that case; surface every other auth error.
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
        const name = credentials?.name ? String(credentials.name) : null
        if (!phone || !/^\d{6}$/.test(code)) return null

        // Verify (and consume) the OTP from Redis.
        const valid = await verifyOTP(phone, code)
        if (!valid) return null

        // Upsert user — first-time login creates a workspace + owner.
        let user = await prisma.user.findUnique({ where: { phone } })
        if (!user) {
          const workspace = await prisma.workspace.create({
            data: {
              name: name || 'کسب‌وکار من',
              slug: generateSlug(),
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          })
          user = await prisma.user.create({
            data: {
              phone,
              name: name || null,
              workspaceId: workspace.id,
              role: 'OWNER',
            },
          })
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
