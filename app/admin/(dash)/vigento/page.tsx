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
    <div className="flex h-[calc(100dvh-8.25rem)] min-h-[38rem] gap-4 overflow-hidden lg:flex-row">
      <VigentoAdminConsole className="min-w-0 flex-1" modelLabel={vigentoModel.name} providerId={providerId} />

      <aside className="spatial-surface hidden w-[17.5rem] shrink-0 overflow-hidden rounded-[1.65rem] lg:flex lg:flex-col">
        <div className="border-b border-black/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white"><ShieldCheck className="h-3.5 w-3.5" /></span><div><h2 className="text-xs font-bold text-black">قابلیت‌های مدیریتی</h2><p className="mt-0.5 text-[9px] text-black/38">همه عملیات حساس نیازمند تأیید شماست</p></div></div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1.5 p-2.5">
          {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-black/[0.06] hover:bg-white/75">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><Icon className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><p className="truncate text-[11px] font-bold text-zinc-900">{label}</p><p className="mt-0.5 truncate text-[9px] text-zinc-400">{detail}</p></div>
            </div>
          ))}
        </div>
        <div className="border-t border-black/[0.06] px-4 py-3">
          <p className="text-[9px] text-black/35">مدل فعال</p><p className="mt-1 truncate text-[10px] font-semibold text-black" title={providerId}>{vigentoModel.name}</p><code dir="ltr" className="mt-0.5 block truncate text-left text-[8px] text-black/30">{providerId}</code>
        </div>
      </aside>
    </div>
  )
}
