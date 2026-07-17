"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Database,
  Globe2,
  MessageCircleMore,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { InstagramIcon } from "./social-links";

type Scenario = {
  name: string;
  channel: string;
  person: string;
  text: string;
  time: string;
  reply: string;
  source: string;
  result: string;
  confidence: string;
  quickActions: readonly string[];
};

type NeuralOperationGraphProps = {
  locale: "fa" | "en";
  reduce: boolean | null;
  activeIndex: number;
  scenario: Scenario;
  allMessages: string;
  core: string;
  coreHint: string;
  sharedBrain: string;
};

const LABELS = {
  fa: {
    knowledge: "دانش",
    rules: "قواعد",
    crm: "CRM",
    incoming: "دریافت",
    outgoing: "پاسخ",
    source: "منبع",
    confidence: "اطمینان",
  },
  en: {
    knowledge: "Knowledge",
    rules: "Rules",
    crm: "CRM",
    incoming: "Receive",
    outgoing: "Reply",
    source: "Source",
    confidence: "Confidence",
  },
} as const;

const SECONDARY_MESSAGES = {
  fa: [
    {
      channel: "واتساپ",
      text: "هزینه و زمان ارسال چقدره؟",
      time: "۳ دقیقه پیش",
    },
    {
      channel: "وب‌سایت",
      text: "چطور می‌تونم درخواست ثبت کنم؟",
      time: "۵ دقیقه پیش",
    },
  ],
  en: [
    {
      channel: "WhatsApp",
      text: "How much is delivery?",
      time: "3 min ago",
    },
    {
      channel: "Website",
      text: "How can I submit a request?",
      time: "5 min ago",
    },
  ],
} as const;

function SignalParticle({
  path,
  delay,
  filterId,
}: {
  path: string;
  delay: number;
  filterId: string;
}) {
  return (
    <circle r="2.35" fill="#6ee7b7" filter={`url(#${filterId})`} opacity="0">
      <animateMotion
        path={path}
        begin={`${delay}s`}
        dur="2.9s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        begin={`${delay}s`}
        dur="2.9s"
        repeatCount="indefinite"
      />
    </circle>
  );
}

function NetworkDefs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={id} x="-350%" y="-350%" width="800%" height="800%">
        <feGaussianBlur stdDeviation="2.8" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <linearGradient id={`${id}-line`} x1="0" x2="1">
        <stop offset="0" stopColor="#6ee7b7" stopOpacity="0.08" />
        <stop offset="0.5" stopColor="#6ee7b7" stopOpacity="0.62" />
        <stop offset="1" stopColor="#6ee7b7" stopOpacity="0.08" />
      </linearGradient>
    </defs>
  );
}

function ChannelIcon({
  activeIndex,
  className,
}: {
  activeIndex: number;
  className?: string;
}) {
  if (activeIndex === 0) {
    return <InstagramIcon className={className} />;
  }

  if (activeIndex === 2) {
    return <Globe2 className={className} />;
  }

  return <MessageCircleMore className={className} />;
}

function MessageCard({
  locale,
  scenario,
  label,
  activeIndex,
  reduce,
}: {
  locale: "fa" | "en";
  scenario: Scenario;
  label: string;
  activeIndex: number;
  reduce: boolean | null;
}) {
  const secondaryMessages = SECONDARY_MESSAGES[locale];

  return (
    <div
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="rounded-[1.35rem] border border-white/[0.14] bg-[#090909]/95 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.34)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[8px] font-medium text-white/[0.48] sm:text-[9px]">
          <MessageCircleMore className="h-3 w-3 shrink-0" />
          {label}
        </p>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
      </div>

      <div className="mt-2.5 space-y-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${activeIndex}-${scenario.person}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{
              duration: reduce ? 0 : 0.28,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="rounded-xl border border-white/[0.12] bg-white/[0.055] p-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-black shadow-[0_6px_18px_rgba(255,255,255,0.08)]">
                <ChannelIcon
                  activeIndex={activeIndex}
                  className="h-3.5 w-3.5"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-semibold text-white sm:text-[9px]">
                  {scenario.person} · {scenario.channel}
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[7px] text-white/[0.34]">
                  {scenario.time}
                </p>
              </div>
            </div>

            <p className="mt-2 line-clamp-2 text-[9px] leading-[1.7] text-white/[0.76] sm:text-[10px]">
              {scenario.text}
            </p>
          </motion.div>
        </AnimatePresence>

        {secondaryMessages.map((message, index) => (
          <div
            key={`${message.channel}-${index}`}
            className="flex items-center gap-2 rounded-xl border border-white/[0.075] bg-white/[0.025] px-2.5 py-2"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-white/[0.48]">
              <MessageCircleMore className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[7px] font-medium text-white/[0.48]">
                  {message.channel}
                </p>
                <p className="shrink-0 whitespace-nowrap text-[6.5px] text-white/[0.25]">
                  {message.time}
                </p>
              </div>
              <p className="mt-0.5 truncate text-[7px] text-white/[0.34]">
                {message.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  locale,
  scenario,
  label,
  activeIndex,
  reduce,
}: {
  locale: "fa" | "en";
  scenario: Scenario;
  label: string;
  activeIndex: number;
  reduce: boolean | null;
}) {
  const labels = LABELS[locale];

  return (
    <div
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="rounded-[1.4rem] bg-white p-3.5 text-black shadow-[0_22px_52px_rgba(0,0,0,0.38)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="whitespace-nowrap text-[9px] font-semibold sm:text-[10px]">
            {label}
          </p>
        </div>

        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${activeIndex}-${scenario.reply}`}
          initial={reduce ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{
            duration: reduce ? 0 : 0.3,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          <p className="mt-3 min-h-[46px] text-[9px] leading-[1.9] text-black/[0.68] sm:text-[10px]">
            {scenario.reply}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {scenario.quickActions.slice(0, 4).map((action) => (
              <span
                key={action}
                className="truncate rounded-lg border border-black/[0.075] bg-black/[0.025] px-1.5 py-1.5 text-center text-[7px] font-medium text-black/[0.52]"
              >
                {action}
              </span>
            ))}
          </div>

          <div className="mt-2.5 rounded-xl border border-black/[0.065] bg-black/[0.025] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[7px] text-black/[0.44]">
              <span className="flex min-w-0 items-center gap-1.5">
                <PackageSearch className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {labels.source}: {scenario.source}
                </span>
              </span>

              <span className="shrink-0 whitespace-nowrap text-[6.5px] text-black/[0.34]">
                {labels.confidence}: {scenario.confidence}
              </span>
            </div>

            <p className="mt-1.5 flex min-w-0 items-center gap-1 text-emerald-700">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span className="whitespace-nowrap text-[clamp(5.9px,0.96vw,7.4px)] font-semibold tracking-[-0.02em]">
                {scenario.result}
              </span>
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Core({
  core,
  coreHint,
  reduce,
}: {
  core: string;
  coreHint: string;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      animate={
        reduce
          ? undefined
          : {
              scale: [1, 1.025, 1],
              boxShadow: [
                "0 0 34px rgba(52,211,153,0.10)",
                "0 0 52px rgba(52,211,153,0.22)",
                "0 0 34px rgba(52,211,153,0.10)",
              ],
            }
      }
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      className="relative grid h-[108px] w-[108px] place-items-center rounded-[1.9rem] border border-white/25 bg-white/[0.085] text-center backdrop-blur-xl sm:h-[116px] sm:w-[116px]"
    >
      <span
        aria-hidden
        className="absolute inset-2 rounded-[1.45rem] border border-white/10"
      />
      <span
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-[2.2rem] border border-emerald-300/10"
      />

      <div className="relative">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.2)]">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <p className="mt-2 whitespace-nowrap text-[11px] font-semibold text-white sm:text-xs">
          {core}
        </p>
        <p className="mt-0.5 max-w-[88px] truncate text-[7px] text-white/35">
          {coreHint}
        </p>
      </div>
    </motion.div>
  );
}

function NetworkNode({
  cx,
  cy,
  active,
}: {
  cx: number;
  cy: number;
  active: boolean;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r="8.5"
        fill="#090909"
        stroke={active ? "#6ee7b7" : "white"}
        strokeOpacity={active ? 0.8 : 0.2}
      />
      <circle
        cx={cx}
        cy={cy}
        r="2.3"
        fill={active ? "#6ee7b7" : "white"}
        fillOpacity={active ? 1 : 0.32}
      />
    </g>
  );
}

export function NeuralOperationGraph({
  locale,
  reduce,
  activeIndex,
  scenario,
  allMessages,
  core,
  coreHint,
  sharedBrain,
}: NeuralOperationGraphProps) {
  const labels = LABELS[locale];
  const activeBranch = activeIndex % 3;

  const desktopIn = [
    "M 212 146 C 238 146 246 88 284 88",
    "M 212 146 C 242 146 252 146 284 146",
    "M 212 146 C 238 146 246 204 284 204",
  ];
  const desktopCore = [
    "M 284 88 C 310 88 314 119 323 132",
    "M 284 146 C 302 146 310 146 323 146",
    "M 284 204 C 310 204 314 173 323 160",
  ];
  const desktopOut = [
    "M 397 132 C 410 119 414 88 444 88",
    "M 397 146 C 412 146 424 146 444 146",
    "M 397 160 C 410 173 414 204 444 204",
  ];
  const desktopEnd = [
    "M 444 88 C 470 88 474 124 486 146",
    "M 444 146 C 462 146 474 146 486 146",
    "M 444 204 C 470 204 474 168 486 146",
  ];

  const mobilePaths = [
    "M 160 150 C 160 178 102 178 102 205",
    "M 160 150 C 160 178 218 178 218 205",
    "M 102 205 C 102 235 136 240 146 252",
    "M 218 205 C 218 235 184 240 174 252",
    "M 146 310 C 132 330 102 334 102 360",
    "M 174 310 C 188 330 218 334 218 360",
    "M 102 360 C 102 388 140 392 160 402",
    "M 218 360 C 218 388 180 392 160 402",
  ];

  return (
    <>
      <div
        dir="ltr"
        className="relative hidden h-[292px] overflow-hidden px-4 py-4 sm:block"
      >
        <svg
          aria-hidden
          viewBox="0 0 680 292"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
        >
          <NetworkDefs id="vigent-signal-desktop" />

          {[...desktopIn, ...desktopCore, ...desktopOut, ...desktopEnd].map(
            (path) => (
              <path
                key={path}
                d={path}
                fill="none"
                stroke="url(#vigent-signal-desktop-line)"
                strokeWidth="1.15"
                strokeDasharray="4 7"
                strokeLinecap="round"
              />
            ),
          )}

          {[
            [284, 88],
            [284, 146],
            [284, 204],
            [444, 88],
            [444, 146],
            [444, 204],
          ].map(([cx, cy], index) => (
            <NetworkNode
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              active={index % 3 === activeBranch}
            />
          ))}

          {!reduce ? (
            <>
              <SignalParticle
                path={desktopIn[activeBranch]}
                delay={0}
                filterId="vigent-signal-desktop"
              />
              <SignalParticle
                path={desktopCore[activeBranch]}
                delay={0.72}
                filterId="vigent-signal-desktop"
              />
              <SignalParticle
                path={desktopOut[activeBranch]}
                delay={1.42}
                filterId="vigent-signal-desktop"
              />
              <SignalParticle
                path={desktopEnd[activeBranch]}
                delay={2.08}
                filterId="vigent-signal-desktop"
              />
            </>
          ) : null}
        </svg>

        <div className="absolute start-5 top-1/2 z-10 w-[192px] -translate-y-1/2">
          <MessageCard
            locale={locale}
            scenario={scenario}
            label={allMessages}
            activeIndex={activeIndex}
            reduce={reduce}
          />
        </div>

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <Core core={core} coreHint={coreHint} reduce={reduce} />
        </div>

        <div className="absolute end-5 top-1/2 z-10 w-[210px] -translate-y-1/2">
          <ResultCard
            locale={locale}
            scenario={scenario}
            label={sharedBrain}
            activeIndex={activeIndex}
            reduce={reduce}
          />
        </div>

        <div
          aria-hidden
          className="absolute left-[35.2%] top-[12%] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/[0.42]"
        >
          <Database className="h-2.5 w-2.5" />
          {labels.knowledge}
        </div>

        <div
          aria-hidden
          className="absolute left-[35.2%] top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/[0.42]"
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          {labels.rules}
        </div>

        <div
          aria-hidden
          className="absolute left-[67%] bottom-[9%] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/[0.42]"
        >
          <UsersRound className="h-2.5 w-2.5" />
          {labels.crm}
        </div>

        <div
          aria-hidden
          className="absolute left-[30.5%] top-[38%] rounded-full border border-emerald-300/15 bg-black/80 px-2 py-1 text-[7px] text-emerald-200/65"
        >
          {labels.incoming}
        </div>

        <div
          aria-hidden
          className="absolute right-[29.5%] top-[38%] rounded-full border border-emerald-300/15 bg-black/80 px-2 py-1 text-[7px] text-emerald-200/65"
        >
          {labels.outgoing}
        </div>
      </div>

      <div dir="ltr" className="relative h-[520px] overflow-hidden sm:hidden">
        <svg
          aria-hidden
          viewBox="0 0 320 520"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
        >
          <NetworkDefs id="vigent-signal-mobile" />

          {mobilePaths.map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="url(#vigent-signal-mobile-line)"
              strokeWidth="1.1"
              strokeDasharray="4 7"
              strokeLinecap="round"
            />
          ))}

          {[
            [102, 205],
            [218, 205],
            [102, 360],
            [218, 360],
          ].map(([cx, cy], index) => (
            <NetworkNode
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              active={index % 2 === activeIndex % 2}
            />
          ))}

          {!reduce ? (
            <>
              <SignalParticle
                path={mobilePaths[activeIndex % 2]}
                delay={0}
                filterId="vigent-signal-mobile"
              />
              <SignalParticle
                path={mobilePaths[2 + (activeIndex % 2)]}
                delay={0.78}
                filterId="vigent-signal-mobile"
              />
              <SignalParticle
                path={mobilePaths[4 + (activeIndex % 2)]}
                delay={1.48}
                filterId="vigent-signal-mobile"
              />
              <SignalParticle
                path={mobilePaths[6 + (activeIndex % 2)]}
                delay={2.1}
                filterId="vigent-signal-mobile"
              />
            </>
          ) : null}
        </svg>

        <div className="absolute inset-x-4 top-3 z-10">
          <MessageCard
            locale={locale}
            scenario={scenario}
            label={allMessages}
            activeIndex={activeIndex}
            reduce={reduce}
          />
        </div>

        <div className="absolute left-1/2 top-[53%] z-10 -translate-x-1/2 -translate-y-1/2">
          <Core core={core} coreHint={coreHint} reduce={reduce} />
        </div>

        <div className="absolute inset-x-4 bottom-3 z-10">
          <ResultCard
            locale={locale}
            scenario={scenario}
            label={sharedBrain}
            activeIndex={activeIndex}
            reduce={reduce}
          />
        </div>

        <span
          aria-hidden
          className="absolute left-[22%] top-[38%] rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/40"
        >
          {labels.knowledge}
        </span>

        <span
          aria-hidden
          className="absolute right-[20%] top-[38%] rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/40"
        >
          {labels.rules}
        </span>
      </div>
    </>
  );
}
