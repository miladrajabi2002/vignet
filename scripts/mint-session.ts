/**
 * Mint a short-lived NextAuth v5 session cookie for localhost smoke tests.
 * The token mirrors what the phone-OTP Credentials authorize() returns.
 * Usage: npx tsx --tsconfig scripts/tsconfig.skeleton-check.json scripts/mint-session.ts [phone]
 */
import { encode } from 'next-auth/jwt'
import * as dotenv from 'dotenv'
import { prisma } from '../lib/prisma'

dotenv.config()

async function main() {
  const phone = process.argv[2]
  const user = await prisma.user.findFirst({
    where: phone ? { phone } : undefined,
    orderBy: { createdAt: 'asc' },
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
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '',
    salt,
    maxAge: 5 * 60,
  })
  console.log(token)
  await prisma.$disconnect()
}

void main()
