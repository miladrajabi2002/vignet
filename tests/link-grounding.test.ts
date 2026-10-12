import { describe, expect, it } from 'vitest'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { createLivePreviewGuard, runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import {
  buildLinkEvidence,
  findUngroundedLinks,
  isAcceptableLinkRepair,
  linkEvidenceForTurn,
  resolveLinkGuardMode,
  stripUngroundedLinks,
} from '@/lib/agent-kernel/skills/link-grounding'

/**
 * Regression: a test conversation (October 2026) where the agent, with no
 * link anywhere in its knowledge, catalog or settings, sent the customer
 * «[رویداد باهمیم](https://baahamim.ir/events)» — a transliterated brand
 * name on a domain that does not exist.
 */
const REPORTED_REPLY = [
  'خوشحالم که دوباره می‌خوای تجربه کنی. برای آگاهی از ایونت‌های پیش رو و ثبت‌نام، می‌تونی از طریق لینک زیر صفحهٔ رویداد باهمیم رو ببینی و ثبت‌نام کنی:',
  '',
  '[رویداد باهمیم](https://baahamim.ir/events)',
  '',
  'اگر سؤال خاصی دربارهٔ برنامه‌ها یا شرایط داری، خوشحال می‌شم راهنمایی کنم.',
].join('\n')

const NO_EVIDENCE = buildLinkEvidence(['محصول: رویداد باهمیم | قیمت: 480,000 تومان | شناسه: p1'])
const plan = compileAgentSkillPlan({ language: 'fa', userMessage: 'چطور ثبت‌نام کنم؟', history: [], handoffEnabled: true })

describe('link grounding — detection', () => {
  it('flags the invented link of the reported conversation', () => {
    expect(findUngroundedLinks(REPORTED_REPLY, NO_EVIDENCE)).toEqual(['https://baahamim.ir/events'])
  })

  it('accepts a link copied from knowledge, whatever its scheme, www or trailing slash', () => {
    const evidence = buildLinkEvidence(['ثبت‌نام: https://www.bahamim.ir/register/ و اینستاگرام instagram.com/bahamim'])
    expect(findUngroundedLinks('از http://bahamim.ir/register ثبت‌نام کن.', evidence)).toEqual([])
    expect(findUngroundedLinks('[ثبت‌نام](https://bahamim.ir/register/)', evidence)).toEqual([])
    expect(findUngroundedLinks('صفحهٔ ما: https://instagram.com/bahamim', evidence)).toEqual([])
  })

  it('accepts a percent-encoded link written back decoded, and the reverse', () => {
    const evidence = buildLinkEvidence(['لینک: https://shop.ir/product/%D9%85%DB%8C%D8%B2-%DA%86%D9%88%D8%A8%DB%8C/'])
    expect(findUngroundedLinks('https://shop.ir/product/میز-چوبی/', evidence)).toEqual([])
    const decoded = buildLinkEvidence(['لینک: https://shop.ir/product/میز-چوبی'])
    expect(findUngroundedLinks('https://shop.ir/product/%D9%85%DB%8C%D8%B2-%DA%86%D9%88%D8%A8%DB%8C/', decoded)).toEqual([])
  })

  it('flags a guessed page on a real site but allows that site’s home page', () => {
    const evidence = buildLinkEvidence(['تماس با ما: https://shop.ir/contact'])
    expect(findUngroundedLinks('ایونت‌ها: https://shop.ir/events', evidence)).toEqual(['https://shop.ir/events'])
    expect(findUngroundedLinks('حساب کاربری: shop.ir/my-account/events', evidence)).toEqual(['shop.ir/my-account/events'])
    expect(findUngroundedLinks('سایت ما https://shop.ir هست.', evidence)).toEqual([])
  })

  it('keeps a query string only when that exact link is on record', () => {
    const evidence = buildLinkEvidence(['https://shop.ir/?post_type=product&s=body'])
    expect(findUngroundedLinks('https://shop.ir/?post_type=product&s=body', evidence)).toEqual([])
    expect(findUngroundedLinks('https://shop.ir/?post_type=product&s=shampoo', evidence)).toEqual(['https://shop.ir/?post_type=product&s=shampoo'])
  })

  it('reads a scheme-less domain as a link but not an email, a file name or a marker', () => {
    expect(findUngroundedLinks('به baahamim.ir سر بزن', NO_EVIDENCE)).toEqual(['baahamim.ir'])
    expect(findUngroundedLinks('ایمیل بزن به info@baahamim.ir', NO_EVIDENCE)).toEqual([])
    expect(findUngroundedLinks('فایل catalog.pdf و نسخهٔ 2.5 و Node.js', NO_EVIDENCE)).toEqual([])
    expect(findUngroundedLinks('[[product:{"id":"p1","name":"shop.com special"}]]', NO_EVIDENCE)).toEqual([])
  })

  it('lets a reply name a public platform by its home address, but not a page or handle on it', () => {
    const steps = '1. به سایت **adsense.google.com** بروید.\n2. وارد `studio.youtube.com` یا gmail.com شوید.'
    expect(findUngroundedLinks(steps, NO_EVIDENCE)).toEqual([])
    expect(findUngroundedLinks('پیج ما: instagram.com/baahamim', NO_EVIDENCE)).toEqual(['instagram.com/baahamim'])
    expect(findUngroundedLinks('https://youtube.com/@baahamim', NO_EVIDENCE)).toEqual(['https://youtube.com/@baahamim'])
    expect(findUngroundedLinks('سایت فروشگاه: **zibasouvenir.com**', NO_EVIDENCE)).toEqual(['zibasouvenir.com'])
  })

  it('reads the shape of an address the customer should send as an example, not a link', () => {
    expect(findUngroundedLinks('مثلاً آدرس کانال به شکل `kick.com/نام‌کانال` باشه.', NO_EVIDENCE)).toEqual([])
    expect(findUngroundedLinks('لینک پیج رو مثل instagram.com/username بفرستید', NO_EVIDENCE)).toEqual([])
    expect(findUngroundedLinks('baahamim.ir/نام‌رویداد', NO_EVIDENCE)).toEqual(['baahamim.ir/نام‌رویداد'])
  })

  it('takes evidence from the whole model input and the catalog rows', () => {
    const evidence = linkEvidenceForTurn(
      [
        { role: 'system', content: 'دانش: فرم ثبت‌نام https://forms.example.org/r/abc' },
        { role: 'assistant', content: 'کانال ما: https://t.me/bahamim' },
        { role: 'user', content: 'این لینک رو دیدم https://bahamim.ir/blog/1 درسته؟' },
      ],
      [{ url: 'https://shop.ir/product/1' }, { url: null }],
      ['الان پاسخ‌گو نیستیم؛ از https://bahamim.ir/support پیام بدهید', null],
    )
    const reply = 'https://forms.example.org/r/abc — https://t.me/bahamim — https://bahamim.ir/blog/1 — https://shop.ir/product/1 — https://bahamim.ir/support'
    expect(findUngroundedLinks(reply, evidence)).toEqual([])
  })
})

describe('link grounding — deterministic strip', () => {
  it('removes the invented link and the sentence that pointed at it, and says so', () => {
    const { reply, removed } = stripUngroundedLinks({ reply: REPORTED_REPLY, evidence: NO_EVIDENCE, isFa: true, handoffEnabled: true })
    expect(removed).toEqual(['https://baahamim.ir/events'])
    expect(reply).toBe([
      'خوشحالم که دوباره می‌خوای تجربه کنی.',
      '',
      'لینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم؛ اگه بخواید، این موضوع رو به همکارم می‌سپارم',
      '',
      'اگر سؤال خاصی دربارهٔ برنامه‌ها یا شرایط داری، خوشحال می‌شم راهنمایی کنم.',
    ].join('\n'))
  })

  it('offers no colleague when the agent cannot hand off', () => {
    const { reply } = stripUngroundedLinks({ reply: 'برای ثبت‌نام به https://baahamim.ir/reg برید.', evidence: NO_EVIDENCE, isFa: true })
    expect(reply).toBe('لینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم')
  })

  it('drops a lead-in that ended with a colon above the link', () => {
    const { reply } = stripUngroundedLinks({
      reply: 'ایونت‌ها تجربه‌محورن.\nصفحهٔ ثبت‌نام:\nhttps://baahamim.ir/reg',
      evidence: NO_EVIDENCE,
      isFa: true,
    })
    expect(reply).toBe('ایونت‌ها تجربه‌محورن.\n\nلینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم')
  })

  it('keeps a grounded link and the sentence that points at it', () => {
    const evidence = buildLinkEvidence(['https://bahamim.ir/register'])
    const text = 'از لینک زیر ثبت‌نام کن:\nhttps://bahamim.ir/register\nاینستاگرام: https://instagram.com/guessed'
    const { reply } = stripUngroundedLinks({ reply: text, evidence, isFa: true })
    expect(reply).toContain('از لینک زیر ثبت‌نام کن:\nhttps://bahamim.ir/register')
    expect(reply).not.toContain('instagram.com')
  })

  it('cuts only the sentence that carries the invented link', () => {
    const { reply } = stripUngroundedLinks({
      reply: 'ایونت بعدی هنوز اعلام نشده. شاید اینجا باشه: https://baahamim.ir/next ولی مطمئن نیستم. هزینه‌اش ۴۸۰ هزار تومانه.',
      evidence: NO_EVIDENCE,
      isFa: true,
    })
    expect(reply).toBe('ایونت بعدی هنوز اعلام نشده. هزینه‌اش ۴۸۰ هزار تومانه.\n\nلینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم')
  })

  it('leaves a reply without invented links untouched', () => {
    const text = 'هزینهٔ ایونت ۴۸۰ هزار تومانه.'
    expect(stripUngroundedLinks({ reply: text, evidence: NO_EVIDENCE, isFa: true })).toEqual({ reply: text, removed: [] })
  })

  it('answers in English for an English turn', () => {
    const { reply } = stripUngroundedLinks({ reply: 'Register here: https://example.com/register', evidence: NO_EVIDENCE, isFa: false, handoffEnabled: true })
    expect(reply).toBe('I don’t have a confirmed link for this in my information; if you like, I can pass it to a colleague.')
  })
})

describe('link grounding — in the reply pipeline', () => {
  const context = (mode: 'off' | 'shadow' | 'enforce', codes: string[]) => ({
    userMessage: 'چطور ثبت‌نام کنم؟',
    isFa: true,
    continuityGuardCodes: codes,
    linkGuard: { evidence: NO_EVIDENCE, mode, handoffEnabled: true },
  })

  it('strips the invented link and records the guard code when enforced', () => {
    const codes: string[] = []
    const out = runAgentSkillPostprocessors(REPORTED_REPLY, plan, context('enforce', codes))
    expect(out).not.toContain('baahamim')
    expect(out).toContain('لینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم')
    expect(codes).toContain('UNGROUNDED_LINK')
  })

  it('only records the code in shadow mode', () => {
    const codes: string[] = []
    const out = runAgentSkillPostprocessors(REPORTED_REPLY, plan, context('shadow', codes))
    expect(out).toContain('https://baahamim.ir/events')
    expect(codes).toEqual(['UNGROUNDED_LINK_SHADOW'])
  })

  it('does nothing when switched off or when no evidence was supplied', () => {
    const codes: string[] = []
    expect(runAgentSkillPostprocessors(REPORTED_REPLY, plan, context('off', codes))).toContain('baahamim.ir')
    expect(runAgentSkillPostprocessors(REPORTED_REPLY, plan, { userMessage: 'سلام', isFa: true })).toContain('baahamim.ir')
    expect(codes).toEqual([])
  })

  it('never lets the invented link into a live draft', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'چطور ثبت‌نام کنم؟', linkGuard: { evidence: NO_EVIDENCE, mode: 'enforce' } })
    let shown = ''
    for (let end = 1; end <= REPORTED_REPLY.length; end += 1) shown = guard(REPORTED_REPLY.slice(0, end))
    expect(shown).not.toContain('baahamim')
    expect(shown).toContain('خوشحالم که دوباره می‌خوای تجربه کنی.')
  })
})

describe('link grounding — rewrite acceptance and rollout switch', () => {
  it('accepts a rewrite only when it is clean, marker-preserving and not inflated', () => {
    const original = `${REPORTED_REPLY}\n[[product:{"id":"p1","name":"رویداد باهمیم"}]]`
    const marker = '[[product:{"id":"p1","name":"رویداد باهمیم"}]]'
    expect(isAcceptableLinkRepair({ original, repaired: `لینک تأییدشده‌ای ندارم.\n${marker}`, evidence: NO_EVIDENCE })).toBe(true)
    expect(isAcceptableLinkRepair({ original, repaired: 'لینک تأییدشده‌ای ندارم.', evidence: NO_EVIDENCE })).toBe(false)
    expect(isAcceptableLinkRepair({ original, repaired: `به baahamim.com برو\n${marker}`, evidence: NO_EVIDENCE })).toBe(false)
    expect(isAcceptableLinkRepair({ original, repaired: '   ', evidence: NO_EVIDENCE })).toBe(false)
    expect(isAcceptableLinkRepair({ original: 'کوتاه https://x.ir/a', repaired: 'الف'.repeat(400), evidence: NO_EVIDENCE })).toBe(false)
  })

  it('is enforced unless the environment asks for shadow or off', () => {
    expect(resolveLinkGuardMode(undefined)).toBe('enforce')
    expect(resolveLinkGuardMode('anything')).toBe('enforce')
    expect(resolveLinkGuardMode('shadow')).toBe('shadow')
    expect(resolveLinkGuardMode('off')).toBe('off')
  })
})

describe('link grounding — what the prompt tells the model', () => {
  it('ties the links option to links on record instead of «any helpful link»', async () => {
    const { buildLayeredPrompt, promptConfigFor } = await promptHelpers()
    const fa = buildLayeredPrompt(promptConfigFor({ links: true }), '', true)
    expect(fa).toContain('لینک فقط وقتی بده که عیناً در دانش، کاتالوگ محصولات، دستورهای بالا یا همین گفتگو آمده باشد')
    expect(fa).not.toContain('اگر لینک مفید داری')
    const en = buildLayeredPrompt(promptConfigFor({ links: true }), '', false)
    expect(en).toContain('Never compose or guess an address')
    expect(buildLayeredPrompt(promptConfigFor({ links: false }), '', true)).toContain('لینک قرار نده.')
  })

  it('keeps an example answer with an unfilled slot away from the model', async () => {
    const { buildLayeredPrompt, promptConfigFor, hasUnfilledPlaceholder } = await promptHelpers()
    const prompt = buildLayeredPrompt(promptConfigFor({ links: true }, [
      { question: 'از کجا ثبت‌نام کنم؟', answer: 'می‌تونی از این لینک مراحل ثبت‌نام رو ببینی: [لینک تأییدشده]' },
      { question: 'هزینهٔ ایونت چقدره؟', answer: 'هزینهٔ ایونت [قیمت تأییدشده] است.' },
      { question: 'این ایونت درمانه؟', answer: 'نه، ایونت‌ها جایگزین خدمات درمانی نیستن.' },
    ]), '', true)
    expect(prompt).not.toContain('[لینک تأییدشده]')
    expect(prompt).not.toContain('[قیمت تأییدشده]')
    expect(prompt).toContain('نه، ایونت‌ها جایگزین خدمات درمانی نیستن.')
    expect(hasUnfilledPlaceholder('جزئیات در [صفحهٔ ثبت‌نام](https://bahamim.ir/register) هست.')).toBe(false)
    expect(hasUnfilledPlaceholder('کد [۱۲۳] را بفرستید')).toBe(false)
    expect(hasUnfilledPlaceholder('Sign up here: [registration link]')).toBe(true)
  })

  it('states that a product has no link on record rather than leaving a gap', async () => {
    const { buildMessages } = await import('@/lib/ai/rag')
    const product = { id: 'p1', name: 'رویداد باهمیم', description: null, price: 480000, stock: null, category: null, image: null, attributes: null, tags: [] }
    const prompt = (url: string | null) => buildMessages({
      systemPrompt: 'پاسخ دقیق بده.',
      language: 'fa',
      contextText: '',
      catalogProducts: [{ ...product, url }],
      history: [],
      userMessage: 'از کجا ثبت‌نام کنم؟',
      catalogAccessEnabled: true,
    })[0]?.content ?? ''
    expect(prompt(null)).toContain('لینک: ثبت نشده')
    expect(prompt('https://bahamim.ir/event/1')).toContain('لینک: https://bahamim.ir/event/1')
    expect(prompt('https://bahamim.ir/event/1')).not.toContain('لینک: ثبت نشده')
  })
})

async function promptHelpers() {
  const { buildLayeredPrompt, hasUnfilledPlaceholder } = await import('@/lib/ai/prompt-builder')
  const { promptConfigSchema } = await import('@/lib/validations/agent')
  const promptConfigFor = (format: { links: boolean }, qaPairs: Array<{ question: string; answer: string }> = []) =>
    promptConfigSchema.parse({ personality: 'دستیار باهمیم', format, qaPairs })
  return { buildLayeredPrompt, hasUnfilledPlaceholder, promptConfigFor }
}
