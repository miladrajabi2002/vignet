'use server'

import { auth, signOut } from '@/auth'
import { stopUserImpersonation } from '@/app/actions/impersonation'

export async function logout() {
  const session = await auth()
  if (session?.user?.impersonatedByAdmin) {
    await stopUserImpersonation()
    return
  }
  await signOut({ redirectTo: '/' })
}
