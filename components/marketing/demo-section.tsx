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
  type LucideIcon,
} from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TextReveal } from '@/components/ui/text-reveal'

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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/55">
              <Icon className="h-3 w-3" />
              {tSrc(b.source)}
            </span>
          )}

          <div
            className={
              isUser
                ? 'rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80'
                : 'rounded-2xl bg-white px-4 py-2.5 text-sm text-black'
            }
          >
            {b.voice ? (
              <span className="inline-flex items-center gap-2 py-0.5">
                <Mic className="h-4 w-4 text-white/70" />
                <span className="flex items-end gap-[3px]">
                  {[6, 11, 7, 14, 9, 5, 12, 8].map((h, j) => (
                    <motion.span
                      key={j}
                      className="w-[2px] rounded-full bg-white/45"
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
                <span className="text-xs text-white/45">0:06</span>
              </span>
            ) : (
              <span className="whitespace-pre-wrap">
                {text}
                {opts?.cursor && (
                  <span className="ms-0.5 inline-block h-3.5 w-px animate-blink bg-black/70 align-middle" />
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
    <section className="relative overflow-hidden bg-black py-28">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-3xl font-light text-white md:text-4xl">
          <TextReveal text={t('title')} />
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-white/45">
          {t('subtitle')}
        </p>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-14 max-w-lg"
        >
          <SpotlightCard className="p-5">
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
                  <div className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-black/50"
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
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('replay')}
                </motion.button>
              )}
            </AnimatePresence>
          </SpotlightCard>
        </motion.div>
      </div>
    </section>
  )
}
