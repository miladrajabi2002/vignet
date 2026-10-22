import { CONVERSATION_IDLE_HOURS } from '@/lib/conversations/session'

// A quiet timeline separator, not a warning: the agent starts a fresh thread
// here but still carries a digest of the previous session (see
// previousSessionDigestMessage in lib/ai/conversation-memory.ts).
export function ConversationSessionDivider({ locale = 'fa' }: { locale?: 'fa' | 'en' }) {
  return (
    <div role="note" dir={locale === 'fa' ? 'rtl' : 'ltr'} className="my-5 text-center">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-black/[0.08]" />
        <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[11px] font-semibold text-black/60">
          {locale === 'fa' ? 'گفتگوی جدید' : 'New conversation'}
        </span>
        <span className="h-px flex-1 bg-black/[0.08]" />
      </div>
      <p className="mx-auto mt-1.5 max-w-xs text-[11px] leading-5 text-[var(--text-muted)]">
        {locale === 'fa'
          ? `مشتری بعد از بیش از ${CONVERSATION_IDLE_HOURS.toLocaleString('fa-IR')} ساعت برگشته. ایجنت گفتگو را از نو شروع می‌کند، ولی خلاصهٔ دفعهٔ قبل یادش هست.`
          : `The customer came back after more than ${CONVERSATION_IDLE_HOURS} hours. The agent starts a fresh thread but remembers what was discussed last time.`}
      </p>
    </div>
  )
}
