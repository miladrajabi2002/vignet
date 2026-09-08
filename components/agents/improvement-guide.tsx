import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/panel'

export function ImprovementGuide({ agentId, isFa }: {
  agentId: string
  isFa: boolean
  compact?: boolean
}) {
  return (
    <DashboardPanel bodyClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{isFa ? 'پاسخ‌های ایجنت را بعد از گفتگو بهتر کنید' : 'Improve responses after each conversation'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
          {isFa ? 'گفتگوهای خودتان و مشتری‌ها را بررسی کنید؛ از «بهبود ایجنت» لحن و رفتار را تنظیم کنید، اطلاعات کم‌شده را به دانش اضافه کنید و پاسخ‌های مفید را از گفتگوها یاد بدهید.' : 'Review test and customer chats, then adjust behavior, fill knowledge gaps and teach useful answers from Improve agent.'}
        </p>
      </div>
      <Link href={`/agents/${agentId}/improve`} className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-semibold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{isFa ? 'بهبود ایجنت' : 'Improve agent'}
      </Link>
    </DashboardPanel>
  )
}
