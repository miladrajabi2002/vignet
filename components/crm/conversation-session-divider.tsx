import { CONVERSATION_IDLE_HOURS } from '@/lib/conversations/session'

export function ConversationSessionDivider({ locale = 'fa' }: { locale?: 'fa' | 'en' }) {
  return (
    <div role="note" dir={locale === 'fa' ? 'rtl' : 'ltr'} className="my-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
      <p className="text-xs font-semibold text-amber-950">
        {locale === 'fa' ? 'شروع جلسهٔ جدید' : 'New conversation session'}
      </p>
      <p className="mt-1 text-xs leading-5 text-amber-900">
        {locale === 'fa'
          ? `مشتری پس از حداقل ${CONVERSATION_IDLE_HOURS.toLocaleString('fa-IR')} ساعت بی‌فعالیتی برگشته است. پیام‌ها و خلاصهٔ قبل از این مرز در پاسخ ایجنت استفاده نمی‌شوند؛ سابقه برای مشاهده محفوظ است.`
          : `The customer returned after at least ${CONVERSATION_IDLE_HOURS} hours of inactivity. The agent excludes messages and summaries before this point from its replies. Earlier messages remain available to view.`}
      </p>
    </div>
  )
}
