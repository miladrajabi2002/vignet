'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, Send, Smartphone, X } from 'lucide-react'

type UserOption = { id: string; name: string; phone: string; workspace: string; plan: string }

export function AdminBroadcastDialog({ users }: { users: UserOption[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-black px-3.5 text-xs font-bold text-white shadow-[var(--shadow-control)] transition-[opacity,transform] hover:opacity-85 active:scale-[.97]"
      >
        <Send className="h-4 w-4" />
        ارسال پیام
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="ارسال پیام به کاربران" className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white p-2 shadow-[0_32px_100px_-34px_rgba(0,0,0,.65)]">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-[1.35rem] bg-white/90 px-3 py-2 backdrop-blur-xl">
              <div>
                <h2 className="text-sm font-bold text-zinc-950">ارسال پیام</h2>
                <p className="mt-0.5 text-[10px] text-zinc-400">ارسال تکی یا گروهی اعلان و پیامک</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AdminBroadcastForm users={users} />
          </div>
        </div>
      )}
    </>
  )
}

export function AdminBroadcastForm({ users }: { users: UserOption[] }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [audience, setAudience] = useState('all')
  const [channel, setChannel] = useState<'notification' | 'sms' | 'both'>('notification')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (mode === 'bulk' && !window.confirm('این پیام برای تمام مخاطبان فیلتر انتخاب‌شده ارسال می‌شود. ادامه می‌دهید؟')) return
    setPending(true); setResult(null); setError(null)
    try {
      const plan = audience.startsWith('plan:') ? audience.slice(5) : undefined
      const response = await fetch('/api/admin/notifications', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, userId: mode === 'single' ? userId : undefined, audience: mode === 'bulk' && !plan ? audience : undefined, plan, channel, title, message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ارسال انجام نشد.')
      setResult(`${new Intl.NumberFormat('fa-IR').format(data.notificationCount)} اعلان و ${new Intl.NumberFormat('fa-IR').format(data.smsCount)} پیامک ثبت شد.`)
      setTitle(''); setMessage('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ارسال انجام نشد.') }
    finally { setPending(false) }
  }

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-white shadow-sm">
      <div className="grid border-b border-zinc-100 sm:grid-cols-2">
        {(['single', 'bulk'] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`min-h-12 text-xs font-bold transition-colors ${mode === item ? 'bg-black text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}>{item === 'single' ? 'ارسال تکی' : 'ارسال گروهی'}</button>)}
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <label className="mb-2 block text-xs font-bold text-zinc-800">مخاطب</label>
          {mode === 'single' ? <select required value={userId} onChange={(e) => setUserId(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-black"><option value="">انتخاب کاربر</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.phone} · {user.workspace}</option>)}</select> : <select value={audience} onChange={(e) => setAudience(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-black"><option value="all">تمام کسب‌وکارها</option><option value="paid">پلن‌های پولی</option><option value="trial">کاربران آزمایشی</option><option value="onboarding">تکمیل‌نکرده‌های راه‌اندازی</option><option value="plan:STARTER">فقط پلن شروع</option><option value="plan:PRO">فقط پلن حرفه‌ای</option><option value="plan:BUSINESS">فقط پلن سازمانی</option></select>}
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold text-zinc-800">روش ارسال</label>
          <div className="grid grid-cols-3 gap-2">{([
            ['notification', 'اعلان', Bell], ['sms', 'پیامک', Smartphone], ['both', 'هر دو', Send],
          ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setChannel(value)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-bold transition-[background-color,border-color,transform] active:scale-[.98] ${channel === value ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
        </div>
        <div><label className="mb-2 block text-xs font-bold text-zinc-800">عنوان</label><input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان کوتاه و روشن" className="min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-black" /></div>
        <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold text-zinc-800">متن پیام</label><span className="text-[10px] text-zinc-400">{new Intl.NumberFormat('fa-IR').format(message.length)} / ۱۰۰۰</span></div><textarea required maxLength={1000} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="پیام شما…" className="w-full resize-y rounded-xl border border-zinc-200 p-3 text-xs leading-6 outline-none focus:border-black" /></div>
        {error && <p className="rounded-xl bg-zinc-100 p-3 text-xs font-semibold text-zinc-700">{error}</p>}
        {result && <p className="flex items-center gap-2 rounded-xl bg-black p-3 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4" />{result}</p>}
        <button disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white transition-[opacity,transform] hover:opacity-85 active:scale-[.99] disabled:opacity-45"><Send className="h-4 w-4" />{pending ? 'در حال ثبت ارسال…' : mode === 'single' ? 'ارسال به کاربر' : 'ارسال به گروه'}</button>
      </div>
    </form>
  )
}
