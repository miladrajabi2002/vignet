'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Package,
  BookOpen,
  AudioLines,
  Mic,
  RotateCcw,
  GraduationCap,
  SlidersHorizontal,
  Workflow,
  Share2,
  type LucideIcon,
} from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TextReveal } from '@/components/ui/text-reveal'

const HIGHLIGHTS: { key: string; icon: LucideIcon }[] = [
  { key: 'learning', icon: GraduationCap },
  { key: 'personalize', icon: SlidersHorizontal },
  { key: 'flow', icon: Workflow },
  { key: 'omnichannel', icon: Share2 },
]

type Bubble = {
  role: 'user' | 'agent'
  text: string
  source?: 'catalog' | 'knowledge' | 'voice'
  voice?: boolean
}

const SOURCE_ICON: Record<string, LucideIcon> = {
  catalog: Package,
  knowledge: BookOpen,
  voice: AudioLines,
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

/**
 * "See it in action": an auto-playing chat that types itself out in real time.
 * Each agent reply carries a callout badge naming the source the answer was
 * drawn from (catalog / knowledge base / voice) so visitors immediately grasp
 * what the platform actually does.
 */
export function DemoSection() {
  const t = useTranslations('marketing.demo')
  const tSrc = useTranslations('marketing.demo.sources')
  const tH = useTranslations('marketing.demo.highlights')
  const bubbles = t.raw('bubbles') as Bubble[]

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })

  // How many bubbles are fully settled, plus the live state of the one in flight.
  const [done, setDone] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'writing'>('idle')
  const [partial, setPartial] = useState('')
  const [finished, setFinished] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controller = new AbortController()
    const { signal } = controller

    async function play() {
      setDone(0)
      setPhase('idle')
      setPartial('')
      setFinished(false)
      try {
        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i]
          if (b.role === 'user') {
            await sleep(i === 0 ? 400 : 750, signal)
            setDone(i + 1)
          } else {
            setPhase('typing')
            await sleep(950, signal)
            setPhase('writing')
            for (let c = 1; c <= b.text.length; c++) {
              setPartial(b.text.slice(0, c))
              await sleep(16, signal)
            }
            await sleep(550, signal)
            setPhase('idle')
            setPartial('')
            setDone(i + 1)
          }
        }
        setFinished(true)
      } catch {
        /* aborted — a newer run took over */
      }
    }

    play()
    return () => controller.abort()
    // bubbles is static page copy; depend only on the play triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, runId])

  const renderBubble = (
    b: Bubble,
    key: string | number,
    text: string,
    opts?: { cursor?: boolean },
  ) => {
    const isUser = b.role === 'user'
    const Icon = b.source ? SOURCE_ICON[b.source] : null
    return (
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={isUser ? 'flex justify-start' : 'flex justify-end'}
      >
        <div
          className={
            'flex max-w-[82%] flex-col gap-1.5 ' +
            (isUser ? 'items-start' : 'items-end')
          }
        >
          {!isUser && b.source && Icon && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--white-05)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
              <Icon className="h-3 w-3" />
              {tSrc(b.source)}
            </span>
          )}

          <div
            className={
              isUser
                ? 'rounded-2xl bg-[var(--white-10)] px-4 py-2.5 text-sm text-[var(--text-primary)]'
                : 'rounded-2xl bg-[var(--white)] px-4 py-2.5 text-sm text-[var(--bg-base)]'
            }
          >
            {b.voice ? (
              <span className="inline-flex items-center gap-2 py-0.5">
                <Mic className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="flex items-end gap-[3px]">
                  {[6, 11, 7, 14, 9, 5, 12, 8].map((h, j) => (
                    <motion.span
                      key={j}
                      className="w-[2px] rounded-full bg-[var(--text-muted)]"
                      style={{ height: h }}
                      animate={{ scaleY: [1, 0.45, 1] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: j * 0.08,
                      }}
                    />
                  ))}
                </span>
                <span className="text-xs text-[var(--text-muted)]">0:06</span>
              </span>
            ) : (
              <span className="whitespace-pre-wrap">
                {text}
                {opts?.cursor && (
                  <span className="ms-0.5 inline-block h-3.5 w-px animate-blink bg-[var(--bg-base)]/70 align-middle" />
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  const inFlight = bubbles[done]

  return (
    <section className="relative overflow-hidden bg-[var(--bg-base)] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-light text-[var(--text-primary)] md:text-4xl">
          <TextReveal text={t('title')} />
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-[var(--text-secondary)]">
          {t('subtitle')}
        </p>

        <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Live chat demo */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-lg"
          >
            <SpotlightCard className="p-5">
              {/* Chat header — makes it read as a real, live conversation */}
              <div className="-mx-5 -mt-5 mb-4 flex items-center gap-3 border-b border-[var(--border-default)] px-5 pb-4">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--white-30)] to-[var(--white-05)] text-sm font-medium text-[var(--text-primary)]">
                    و
                  </div>
                  <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t('agentName')}
                  </span>
                  <span className="text-xs text-emerald-500">
                    {t('online')}
                  </span>
                </div>
              </div>

              <div className="flex min-h-[340px] flex-col justify-end space-y-3">
              {bubbles
                .slice(0, done)
                .map((b, i) => renderBubble(b, i, b.text))}

              {phase === 'writing' &&
                inFlight &&
                renderBubble(inFlight, 'writing', partial, { cursor: true })}

              {phase === 'typing' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="flex items-center gap-1.5 rounded-2xl bg-[var(--white)] px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-[var(--bg-base)]/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: d * 0.18,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <AnimatePresence>
              {finished && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setRunId((n) => n + 1)}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('replay')}
                </motion.button>
              )}
            </AnimatePresence>
            </SpotlightCard>
          </motion.div>

          {/* Capability highlights beside the live chat */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="mx-auto w-full max-w-lg"
          >
            <h3 className="text-2xl font-light text-[var(--text-primary)] md:text-3xl">
              {tH('title')}
            </h3>
            <p className="mt-3 text-[var(--text-secondary)]">{tH('subtitle')}</p>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map(({ key, icon: Icon }, i) => (
                <motion.li
                  key={key}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                  className="group flex gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-4 transition-all duration-300 hover:border-[var(--border-hover)] hover:bg-[var(--white-10)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] transition-colors duration-300 group-hover:border-[var(--border-strong)]">
                    <Icon className="h-5 w-5 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-medium text-[var(--text-primary)]">
                      {tH(`items.${key}.title`)}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {tH(`items.${key}.desc`)}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
