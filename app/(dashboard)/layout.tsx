import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_SKIP_COOKIE } from '@/lib/onboarding'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  const pathname = headers().get('x-pathname') ?? ''
  const skipped = cookies().get(ONBOARDING_SKIP_COOKIE)?.value === '1'

  // Force first-time users through onboarding until step 3 is reached.
  if (!pathname.startsWith('/onboarding') && !skipped) {
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { onboardingStep: true, onboardingCompleted: true },
    })
    if (ws && !ws.onboardingCompleted && ws.onboardingStep < 3) {
      redirect('/onboarding')
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
