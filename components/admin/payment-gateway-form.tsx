'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Switch } from '@/components/ui/switch'
import { groupDigits, normalizeNumberInput } from '@/components/admin/number-field'

type Plan = 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
const PLANS: Array<[Plan, string]> = [['TRIAL', 'آزمایشی'], ['STARTER', 'پایه (STARTER)'], ['PRO', 'حرفه‌ای (PRO)'], ['BUSINESS', 'کسب‌وکار (BUSINESS)']]

export interface PaymentGatewayFormValues {
  enabled: boolean
  planMonthlyCaps: Record<Plan, number | null>
  inboundLines: string[]
  inboundSecret: string | null
  maxAmount: number
}

/** Platform-wide gateway settings: the switch, monthly caps per plan, the SMS line and the largest payment. */
export function PaymentGatewayForm({ initial, appUrl }: { initial: PaymentGatewayFormValues; appUrl: string }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [caps, setCaps] = useState<Record<Plan, string>>(() => Object.fromEntries(PLANS.map(([plan]) => [plan, initial.planMonthlyCaps[plan] == null ? '' : String(initial.planMonthlyCaps[plan])])) as Record<Plan, string>)
  const [lines, setLines] = useState(initial.inboundLines.join('\n'))
  const [maxAmount, setMaxAmount] = useState(String(initial.maxAmount))
  const [secret, setSecret] = useState(initial.inboundSecret)
  const [busy, setBusy] = useState<'save' | 'rotate' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(rotateSecret = false) {
    setBusy(rotateSecret ? 'rotate' : 'save')
    setNotice(null)
    try {
      const response = await fetch('/api/admin/payment-gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          planMonthlyCaps: Object.fromEntries(PLANS.map(([plan]) => [plan, caps[plan] === '' ? null : Number(caps[plan])])),
          inboundLines: lines.split(/[\s,\u060C]+/).map((line) => normalizeNumberInput(line)).filter(Boolean),
          maxAmount: Number(maxAmount) || 10_000_000,
          rotateSecret,
        }),
      })
      const data = (await response.json().catch(() => null)) as { inboundSecret?: string; error?: string } | null
      if (!response.ok) {
        setNotice({ ok: false, text: 'ذخیره نشد؛ شمارهٔ خط‌ها فقط رقم باشد و سقف‌ها عدد صحیح.' })
        return
      }
      if (data?.inboundSecret) setSecret(data.inboundSecret)
      setNotice({ ok: true, text: rotateSecret ? 'کلید تازه ساخته شد؛ نشانی وب‌هوک پنل پیامک را عوض کنید.' : 'ذخیره شد.' })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const webhook = secret ? `${appUrl}/api/pay/sms/inbound?key=${secret}` : null

  return (
    <div className="space-y-5">
      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ui-h3">درگاه پرداخت برای همهٔ کسب‌وکارها</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-7 text-[var(--text-secondary)]">خاموش یعنی هیچ کسب‌وکاری کارت تازه به مشتری نمی‌دهد. پرداخت‌های باز تا پایان مهلت‌شان تأیید می‌شوند.</p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} aria-label="درگاه پرداخت" />
        </div>
      </section>

      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <h2 className="ui-h3">سقف ماهانهٔ پرداخت تأییدشده در هر پلن</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-7 text-[var(--text-secondary)]">درگاه داخل اشتراک است و کارمزد ندارد. وقتی سقف پر شود، سفارش‌های تازهٔ آن کسب‌وکار تا ماه بعد به اپراتورش سپرده می‌شوند. خالی یعنی بدون سقف.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(([plan, label]) => (
            <label key={plan} className="block">
              <span className="ui-field-label">{label}</span>
              <input dir="ltr" inputMode="numeric" className="input mt-1.5 font-mono" placeholder="بدون سقف" value={groupDigits(caps[plan])} onChange={(event) => setCaps((current) => ({ ...current, [plan]: normalizeNumberInput(event.target.value) }))} />
            </label>
          ))}
        </div>
      </section>

      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <h2 className="ui-h3">سامانهٔ پیامکی دریافت</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-7 text-[var(--text-secondary)]">گوشی صاحب کسب‌وکار پیامک واریز بانک را به این خط‌ها فوروارد می‌کند. شمارهٔ اول در راهنمای داشبورد نشان داده می‌شود. فقط پیامک شماره‌هایی خوانده می‌شود که در داشبورد کسب‌وکارها ثبت شده‌اند.</p>
        <label className="mt-3 block max-w-sm">
          <span className="ui-field-label">شمارهٔ خط‌ها (هر خط در یک سطر)</span>
          <textarea dir="ltr" rows={3} className="input mt-1.5 font-mono" value={lines} onChange={(event) => setLines(event.target.value)} placeholder={'3000xxxxxxxx\n5000xxxxxxxx'} />
        </label>
        <div className="mt-4">
          <p className="ui-field-label">نشانی وب‌هوک پیامک دریافتی در پنل پیامک</p>
          {webhook ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 ps-3">
              <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{webhook}</span>
              <CopyButton value={webhook} label="کپی" copiedLabel="کپی شد" showLabel />
            </div>
          ) : <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">با اولین ذخیره ساخته می‌شود.</p>}
          <p className="mt-1.5 text-[12.5px] leading-6 text-[var(--text-muted)]">پنل باید فرستنده، گیرنده و متن را با یکی از نام‌های from / to / text (یا message) بفرستد؛ GET و POST هر دو پذیرفته می‌شوند. این نشانی مثل رمز است.</p>
          {webhook && <Button size="sm" variant="outline" className="mt-2" loading={busy === 'rotate'} disabled={busy !== null} onClick={() => save(true)}>ساخت کلید تازه</Button>}
        </div>
      </section>

      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <h2 className="ui-h3">بیشترین مبلغ یک پرداخت</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-7 text-[var(--text-secondary)]">سبدی بزرگ‌تر از این، کارت‌به‌کارت پیشنهاد نمی‌شود و به اپراتور یا پرداخت سایت می‌رود. سقف روزانهٔ کارت‌به‌کارت بانک‌ها را در نظر بگیرید.</p>
        <label className="mt-3 block max-w-xs">
          <span className="ui-field-label">تومان</span>
          <input dir="ltr" inputMode="numeric" className="input mt-1.5 font-mono" value={groupDigits(maxAmount)} onChange={(event) => setMaxAmount(normalizeNumberInput(event.target.value))} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy === 'save'} disabled={busy !== null} onClick={() => save(false)}>ذخیرهٔ تنظیمات</Button>
        {notice && <span role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-600'}>{notice.text}</span>}
      </div>
    </div>
  )
}
