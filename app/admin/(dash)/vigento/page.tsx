import {
  Bot,
  Building2,
  CreditCard,
  FileSearch,
  MessagesSquare,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { VigentoAdminConsole } from '@/components/admin/vigento-admin-console'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import { findModel, resolveModelId } from '@/lib/ai/models'

export const dynamic = 'force-dynamic'

const CAPABILITIES = [
  { icon: Search, label: 'تحلیل زنده پلتفرم', detail: 'کاربر، درآمد، گفتگو و سلامت' },
  { icon: Users, label: 'جست‌وجوی کاربران', detail: 'نام، موبایل، شناسه و نقش واقعی' },
  { icon: Building2, label: 'مدیریت کسب‌وکار', detail: 'نام، پلن، وضعیت و اعتبار' },
  { icon: MessagesSquare, label: 'بررسی گفتگوها', detail: 'جزئیات، انتقال و حل پرونده' },
  { icon: Bot, label: 'کنترل ایجنت‌ها', detail: 'یافتن، فعال یا غیرفعال‌کردن' },
  { icon: CreditCard, label: 'تنظیم اعتبار AI', detail: 'افزایش و کاهش تأییدشونده' },
  { icon: UserCog, label: 'مدیریت اعضا', detail: 'ساخت، ویرایش و حذف امن' },
  { icon: FileSearch, label: 'بررسی فایل پروژه', detail: 'خواندن فایل‌های امن و غیرمحرمانه' },
] as const

export default async function AdminVigentoPage() {
  const policy = await getPlatformAiConfig()
  const vigentoModel = findModel(policy.vigentoModel)
  const providerId = resolveModelId(policy.vigentoModel, policy.providerModels)

  return (
    // Phones: the console ends above the floating bar; from md it fills the page.
    <div className="flex h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] min-h-[26rem] gap-4 md:h-[calc(100dvh-7.5rem)] md:min-h-[34rem] lg:flex-row">
      <VigentoAdminConsole className="min-w-0 flex-1" modelLabel={vigentoModel.name} providerId={providerId} />

      <aside className="spatial-surface hidden w-[17.5rem] shrink-0 overflow-hidden rounded-card lg:flex lg:flex-col">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-[var(--signal-tint)] text-[var(--signal-strong)]"><ShieldCheck className="h-4 w-4" /></span><div className="min-w-0"><h2 className="text-[13px] font-bold text-[var(--text-primary)]">قابلیت‌های مدیریتی</h2><p className="text-[12px] text-[var(--text-muted)]">همه عملیات حساس نیازمند تأیید شماست</p></div></div>
        </div>
        <ul className="admin-scroll flex min-h-0 flex-1 flex-col justify-center gap-0.5 overflow-y-auto p-2.5">
          {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
            <li key={label} className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-[var(--bg-muted)] text-[var(--text-secondary)]"><Icon className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{label}</p><p className="truncate text-[12px] text-[var(--text-muted)]">{detail}</p></div>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <p className="text-[12px] text-[var(--text-muted)]">مدل فعال</p><p className="mt-1 truncate text-[13px] font-medium text-[var(--text-primary)]" title={providerId}>{vigentoModel.name}</p><code dir="ltr" className="mt-0.5 block truncate text-left text-[12px] text-[var(--text-muted)]">{providerId}</code>
        </div>
      </aside>
    </div>
  )
}
