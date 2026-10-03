import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      workspaceId: string
      platformRole: string
      phone: string
      impersonatedByAdmin?: boolean
      impersonationExpiresAt?: number
    impersonatorId?: string
      impersonatorId?: string
    } & DefaultSession['user']
  }

  interface User {
    workspaceId: string
    platformRole: string
    phone: string
    impersonatedByAdmin?: boolean
    impersonationExpiresAt?: number
    impersonatorId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    workspaceId: string
    platformRole: string
    phone: string
    impersonatedByAdmin?: boolean
    impersonationExpiresAt?: number
    impersonatorId?: string
  }
}
