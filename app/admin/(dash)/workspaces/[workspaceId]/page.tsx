import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminWorkspaceDetailPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await props.params
  const user = await prisma.user.findFirst({
    where: { workspaceId, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  }) ?? await prisma.user.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!user) notFound()
  redirect(`/admin/users/${user.id}`)
}
