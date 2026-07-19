import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { CatalogAssign } from '@/components/products/catalog-assign'

export default async function AgentCatalogPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true },
  })
  if (!agent) notFound()

  const [products, assigned] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId: user.workspaceId, active: true },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { name: true } } },
    }),
    prisma.agentCatalog.findMany({
      where: { agentId: agent.id },
      select: { productId: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <CatalogAssign
        agentId={agent.id}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category?.name ?? null,
        }))}
        initialSelected={assigned.map((a) => a.productId)}
      />
    </div>
  )
}
