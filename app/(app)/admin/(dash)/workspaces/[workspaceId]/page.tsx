import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_USER_WHERE } from '@/lib/admin/reporting-scope'

export const dynamic = 'force-dynamic'

export default async function AdminWorkspaceDetailPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await props.params
  const user = await prisma.user.findFirst({
    where: { ...ADMIN_VISIBLE_USER_WHERE, workspaceId },
    select: { id: true },
  })

  if (!user) notFound()
  redirect(`/admin/users/${user.id}`)
}
