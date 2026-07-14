import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import {
        Bot,
        Plus,
        MessagesSquare,
        Share2,
        Database,
        Settings,
        Sparkles,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/admin/sparkline'
import { conversationsDailyByAgent } from '@/lib/dashboard/charts'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function AgentsPage() {
        const user = await requireUser()
        const t = await getTranslations('agents')
        const fa = (await getLocale()) !== 'en'

        const [agents, agentSparks] = await Promise.all([
                prisma.agent.findMany({
                        where: { workspaceId: user.workspaceId },
                        orderBy: { createdAt: 'desc' },
                        select: {
                                id: true,
                                name: true,
                                description: true,
                                active: true,
                                language: true,
                                _count: {
                                        select: {
                                                conversations: true,
                                                channels: true,
                                                catalogItems: true,
                                                knowledgeBases: true,
                                        },
                                },
                        },
                }),
                conversationsDailyByAgent(user.workspaceId, 7),
        ])

        return (
                <div className="mx-auto max-w-6xl space-y-6">
                        <PageHeader
                                icon={Bot}
                                title={t('title')}
                                subtitle={t('subtitle')}
                                actions={
                                        <Link
                                                href="/agents/new"
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {t('new')}
                                        </Link>
                                }
                        />

                        {agents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
                                        <Bot className="h-8 w-8 text-[var(--text-muted)]" />
                                        <h2 className="mt-4 text-lg text-[var(--text-primary)]">{t('empty')}</h2>
                                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('emptyDesc')}</p>
                                        <Link
                                                href="/agents/new"
                                                className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)]"
                                        >
                                                {t('create')}
                                        </Link>
                                </div>
                        ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {agents.map((agent) => (
                                                <Link
                                                        key={agent.id}
                                                        href={`/agents/${agent.id}`}
                                                        className="spatial-surface group flex flex-col rounded-[1.5rem] p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
                                                >
                                                        {/* Header */}
                                                        <div className="flex items-start justify-between">
                                                                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
                                                                        <Bot className="h-5 w-5" />
                                                                </div>
                                                                <span
                                                                        className={cn(
                                                                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                                                                agent.active
                                                                                        ? 'bg-success/10 text-success'
                                                                                        : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
                                                                        )}
                                                                >
                                                                        {agent.active && (
                                                                                <span className="relative flex h-2 w-2">
                                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                                                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                                                                                </span>
                                                                        )}
                                                                        {agent.active ? t('active') : t('inactive')}
                                                                </span>
                                                        </div>

                                                        {/* Title */}
                                                        <h3 className="mt-4 truncate text-base font-medium text-[var(--text-primary)]">
                                                                {agent.name}
                                                        </h3>
                                                        {agent.description ? (
                                                                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                                                                        {agent.description}
                                                                </p>
                                                        ) : (
                                                                <p className="mt-1 text-sm italic text-[var(--text-muted)]">
                                                                        {agent.language === 'fa' ? 'بدون توضیحات' : 'No description'}
                                                                </p>
                                                        )}

                                                        {/* Stats */}
                                                        <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                                                <span
                                                                        className="inline-flex items-center gap-1"
                                                                        title={t('conversations')}
                                                                >
                                                                        <MessagesSquare className="h-3.5 w-3.5" />
                                                                        {agent._count.conversations}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1" title={t('channels')}>
                                                                        <Share2 className="h-3.5 w-3.5" />
                                                                        {agent._count.channels}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1" title={t('knowledge')}>
                                                                        <Database className="h-3.5 w-3.5" />
                                                                        {agent._count.knowledgeBases}
                                                                </span>
                                                        </div>

                                                        {/* 7-day conversation sparkline */}
                                                        {(() => {
                                                                const spark = agentSparks.get(agent.id)
                                                                if (!spark || spark.total === 0) return null
                                                                return (
                                                                        <div className="mt-3 flex items-center gap-2">
                                                                                <Sparkline data={spark.series} color="#111111" width={100} height={24} fluid />
                                                                                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                                                                        {spark.total.toLocaleString('fa-IR')} در ۷ روز
                                                                                </span>
                                                                        </div>
                                                                )
                                                        })()}

                                                        {/* Action hints */}
                                                        <div className="mt-4 flex items-center gap-1 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-muted)]">
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-base)] px-2 py-1 transition-colors group-hover:bg-[var(--bg-hover)] group-hover:text-[var(--text-secondary)]">
                                                                        <Settings className="h-3 w-3" />
                                                                        {t('settings')}
                                                                </span>
                                                                <span className="ms-auto inline-flex items-center gap-1 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]">
                                                                        {agent.language === 'fa' ? 'مشاهده' : 'Open'}
                                                                        <span className="rtl:rotate-180">→</span>
                                                                </span>
                                                        </div>
                                                </Link>
                                        ))}
                                </div>
                        )}

                        {/* Tip card */}
                        {agents.length > 0 && (
                                <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm">
                                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                        <div className="text-[var(--text-secondary)]">
                                                <p className="font-medium text-[var(--text-primary)]">
                                                        {agent_hint_title(agents.length)}
                                                </p>
                                                <p className="mt-1 text-xs">{agent_hint_body(agents.length)}</p>
                                        </div>
                                </div>
                        )}
                </div>
        )
}

function agent_hint_title(n: number): string {
        return n === 1 ? 'ایجنت شما آماده است' : `${n} ایجنت فعال دارید`
}

function agent_hint_body(n: number): string {
        return n === 1
                ? 'برای تست، روی کارت بزنید. از بخش «کانال‌ها» می‌توانید آن را به وب‌سایت یا تلگرام وصل کنید.'
                : 'روی هر کارت بزنید تا تنظیمات، پایگاه دانش و کانال‌های آن را ببینید. می‌توانید ایجنت‌های مختلف برای کارهای مختلف بسازید.'
}
