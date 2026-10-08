/**
 * Mint a short-lived NextAuth v5 session cookie for localhost smoke tests.
 * The token mirrors what the phone-OTP Credentials authorize() returns.
 * Usage: npx tsx --tsconfig scripts/tsconfig.skeleton-check.json scripts/mint-session.ts <phone>
 *
 * The phone is REQUIRED: without it the script used to pick the oldest user —
 * on this server that is the platform owner — and print a live admin session.
 */
import { encode } from 'next-auth/jwt'
import * as dotenv from 'dotenv'
import { prisma } from '../lib/prisma'

dotenv.config()

async function main() {
  const phone = process.argv[2]
  if (!phone) {
    console.error('usage: mint-session.ts <phone>')
    process.exit(1)
  }
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('AUTH_SECRET is not set — refusing to sign a token with an empty secret')
    process.exit(1)
  }
  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, name: true, phone: true, workspaceId: true, platformRole: true },
  })
  if (!user) {
    console.error('no user found')
    process.exit(1)
  }
  // In production NextAuth v5 uses the __Secure- cookie names.
  const salt = process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'
  const token = await encode({
    token: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      workspaceId: user.workspaceId,
      platformRole: user.platformRole,
      sub: user.id,
    },
    secret,
    salt,
    maxAge: 5 * 60,
  })
  console.log(token)
  await prisma.$disconnect()
}

void main()
