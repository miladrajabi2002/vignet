import { prisma } from '@/lib/prisma'
import { CAPABILITY_KEYS, type CapabilityKey } from '@/lib/verticals/registry'

/**
 * Whether a switched-on capability can actually do its job yet. Being on
 * only puts a section in the menu; «ready» means the agent can use it with
 * real data (a bookable service, an active product, a connected account…).
 */
export type ReadinessState = 'off' | 'setup' | 'ready'

export interface ReadinessStep {
  key: string
  fa: string
  en: string
  done: boolean
  href: string
}

export interface CapabilityReadiness {
  key: CapabilityKey
  state: ReadinessState
  steps: ReadinessStep[]
  /** The first unfinished step, for a one-tap "continue setup". */
  next: ReadinessStep | null
}

export type CapabilityReadinessMap = Record<CapabilityKey, CapabilityReadiness>

export interface ReadinessFacts {
  activeProducts: number
  storeConnected: boolean
  activeServices: number
  bookableServices: number
  chatLinkLive: boolean
  instagramConnected: boolean
  publishedCourses: number
  scheduledCourses: number
  knowledgeSources: number
  handoffAgents: number
  primaryAgentId: string | null
}

function steps(key: CapabilityKey, facts: ReadinessFacts): ReadinessStep[] {
  const agentHref = facts.primaryAgentId ? `/agents/${facts.primaryAgentId}` : '/agents'
  switch (key) {
    case 'products':
      return [{
        key: 'catalog',
        fa: 'حداقل یک محصول فعال یا فروشگاه متصل',
        en: 'At least one active product or a connected store',
        done: facts.activeProducts > 0 || facts.storeConnected,
        href: '/products/new',
      }]
    case 'digital-menu':
      return [
        { key: 'items', fa: 'حداقل یک آیتم فعال در منو', en: 'At least one active menu item', done: facts.activeProducts > 0, href: '/products/new' },
        { key: 'chat', fa: 'لینک گفتگو برای سفارش از منو', en: 'A chat link so guests can order from the menu', done: facts.chatLinkLive, href: '/menu' },
      ]
    case 'bookings':
      return [
        { key: 'service', fa: 'یک خدمت فعال', en: 'An active service', done: facts.activeServices > 0, href: '/appointments?tab=services' },
        { key: 'hours', fa: 'ساعت کاری برای خدمت', en: 'Working hours on a service', done: facts.bookableServices > 0, href: '/appointments?tab=services' },
      ]
    case 'services':
      return [{ key: 'service', fa: 'حداقل یک خدمت فعال', en: 'At least one active service', done: facts.activeServices > 0, href: '/services' }]
    case 'instagram':
      return [{ key: 'account', fa: 'اتصال حساب اینستاگرام', en: 'Connect the Instagram account', done: facts.instagramConnected, href: '/instagram' }]
    case 'courses':
      return [
        { key: 'published', fa: 'یک دوره منتشرشده', en: 'A published course', done: facts.publishedCourses > 0, href: '/courses' },
        { key: 'sessions', fa: 'زمان جلسات دوره', en: 'Session dates on the course', done: facts.scheduledCourses > 0, href: '/courses' },
      ]
    case 'support':
      return [
        { key: 'knowledge', fa: 'یک منبع دانش آماده', en: 'A ready knowledge source', done: facts.knowledgeSources > 0, href: `${agentHref}/knowledge` },
        { key: 'handoff', fa: 'تحویل به اپراتور روشن', en: 'Operator handoff on', done: facts.handoffAgents > 0, href: `${agentHref}/settings` },
      ]
  }
}

/** Pure part, kept separate for tests and for rendering without a query. */
export function buildCapabilityReadiness(
  enabled: readonly CapabilityKey[],
  facts: ReadinessFacts,
): CapabilityReadinessMap {
  const on = new Set(enabled)
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => {
    const list = steps(key, facts)
    const next = list.find((step) => !step.done) ?? null
    const state: ReadinessState = !on.has(key) ? 'off' : next ? 'setup' : 'ready'
    return [key, { key, state, steps: list, next }]
  })) as CapabilityReadinessMap
}

export async function loadReadinessFacts(workspaceId: string): Promise<ReadinessFacts> {
  const [
    activeProducts,
    storeConnected,
    activeServices,
    bookableServices,
    chatLinkLive,
    instagramConnected,
    publishedCourses,
    scheduledCourses,
    knowledgeSources,
    handoffAgents,
    primaryAgent,
  ] = await Promise.all([
    prisma.product.count({ where: { workspaceId, active: true } }),
    prisma.storeIntegration.count({ where: { workspaceId, active: true } }),
    prisma.service.count({ where: { workspaceId, active: true } }),
    prisma.service.count({ where: { workspaceId, active: true, weeklyRules: { some: { active: true } } } }),
    prisma.chatLink.count({ where: { workspaceId, enabled: true, agent: { active: true } } }),
    prisma.agentChannel.count({ where: { type: 'INSTAGRAM', active: true, agent: { workspaceId } } }),
    // Courses ship in a later migration than this code may run against.
    prisma.course.count({ where: { workspaceId, status: 'PUBLISHED' } }).catch(() => 0),
    prisma.course.count({ where: { workspaceId, status: 'PUBLISHED', sessions: { some: {} } } }).catch(() => 0),
    prisma.knowledgeBase.count({ where: { workspaceId, status: 'READY', type: { not: 'PRODUCT_CATALOG' } } }),
    prisma.agent.count({ where: { workspaceId, handoffEnabled: true } }),
    prisma.agent.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
  ])
  return {
    activeProducts,
    storeConnected: storeConnected > 0,
    activeServices,
    bookableServices,
    chatLinkLive: chatLinkLive > 0,
    instagramConnected: instagramConnected > 0,
    publishedCourses,
    scheduledCourses,
    knowledgeSources,
    handoffAgents,
    primaryAgentId: primaryAgent?.id ?? null,
  }
}

export async function getCapabilityReadiness(
  workspaceId: string,
  enabled: readonly CapabilityKey[],
): Promise<CapabilityReadinessMap> {
  return buildCapabilityReadiness(enabled, await loadReadinessFacts(workspaceId))
}
