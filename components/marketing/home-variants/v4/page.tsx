"use client";

import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  BookOpenCheck,
  Bot,
  Check,
  CheckCircle2,
  MessageCircleMore,
  PackageCheck,
  ShieldCheck,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMON_COPY, VARIANT_COPY } from "../shared/content";
import type { HomeLocale, HomeVariantPageProps } from "../shared/types";
import {
  CapabilitySection,
  ChannelPills,
  ClosingCta,
  EASE_OUT,
  FaqSection,
  HeroActions,
  OnboardingStory,
  OutcomeStats,
  PricingPreview,
  ProductIcon,
  Reveal,
  RevealBlock,
  SectionHeading,
  TrialBadge,
  VariantSwitcher,
} from "../shared/primitives";
import styles from "../home-variants.module.css";

const TRACE_COPY = {
  fa: {
    consoleName: "هستهٔ عملیات Vigento",
    consoleCaption: "Trace mode · مسیر زندهٔ تصمیم",
    live: "آمادهٔ پردازش",
    tabsLabel: "انتخاب سناریوی دموی Vigento",
    traceId: "شناسهٔ مسیر",
    stagesLabel: "مراحل پردازش و اقدام",
    message: "پیام",
    source: "منبع",
    response: "پاسخ",
    action: "اقدام",
    handoff: "تحویل انسانی",
    outcome: "نتیجه",
    received: "ورودی کانال ثبت شد",
    grounded: "منبع معتبر تطبیق داده شد",
    composed: "پاسخ در محدودهٔ قواعد ساخته شد",
    executed: "عملیات بعدی آماده شد",
    handedOff: "همراه خلاصه به همکار تحویل شد",
    recorded: "خروجی در پرونده مشتری ماند",
    inspector: "بازرس مسیر",
    inspectHint: "برای دیدن جزئیات، یکی از مراحل را انتخاب کنید.",
    verified: "تأییدشده",
    reviewable: "قابل بازبینی",
    policy: "قاعده اجرا",
    autoPolicy: "اقدام خودکار مجاز",
    humanPolicy: "نیازمند ادامهٔ همکار",
    audit: "ردپای تصمیم",
    auditValue: "منبع، پاسخ و نتیجه ذخیره می‌شوند",
    proofEyebrow: "کنترل قبل از مقیاس",
    proofTitle: "یک محصول واقعی برای کار روزانه، نه یک دموی جعبه‌سیاه",
    proofSubtitle:
      "هر پاسخ به داده و قاعده وصل است؛ هر اقدام دیده می‌شود و هرجا لازم باشد، انسان با متن کامل گفتگو ادامه می‌دهد.",
    proofCards: [
      {
        title: "پاسخ با منبع قابل‌دیدن",
        description:
          "فایل، موجودی، تقویم یا پاسخ تأییدشده کنار تصمیم باقی می‌ماند.",
        meta: "دانش قابل ممیزی",
      },
      {
        title: "اقدام در همان گفتگو",
        description:
          "ارسال محصول، پیگیری سفارش و نگه‌داشتن زمان رزرو بعد از پاسخ انجام می‌شود.",
        meta: "عملیات متصل",
      },
      {
        title: "تحویل بدون تکرار سؤال",
        description:
          "موارد حساس با خلاصه و سابقه کامل به همکار مناسب سپرده می‌شوند.",
        meta: "همکاری انسان و AI",
      },
    ],
  },
  en: {
    consoleName: "Vigento operations core",
    consoleCaption: "Trace mode · live decision path",
    live: "Ready to process",
    tabsLabel: "Choose a Vigento demo scenario",
    traceId: "Trace ID",
    stagesLabel: "Processing and action stages",
    message: "Message",
    source: "Source",
    response: "Response",
    action: "Action",
    handoff: "Human handoff",
    outcome: "Outcome",
    received: "Channel input recorded",
    grounded: "A trusted source was matched",
    composed: "Reply composed within policy",
    executed: "The next operation is ready",
    handedOff: "Passed to a teammate with context",
    recorded: "The result stayed on the customer record",
    inspector: "Trace inspector",
    inspectHint: "Select any stage to inspect its details.",
    verified: "Verified",
    reviewable: "Reviewable",
    policy: "Execution policy",
    autoPolicy: "Automated action allowed",
    humanPolicy: "A teammate continues",
    audit: "Decision trail",
    auditValue: "Source, response and outcome are retained",
    proofEyebrow: "Control before scale",
    proofTitle: "A real daily workspace, not a black-box demo",
    proofSubtitle:
      "Every response is tied to data and policy. Every action is visible, and a person can continue with the full context whenever needed.",
    proofCards: [
      {
        title: "Visible grounding",
        description:
          "The file, stock, calendar or approved answer stays attached to the decision.",
        meta: "Auditable knowledge",
      },
      {
        title: "Action inside the conversation",
        description:
          "Send a product, track an order or hold a booking slot right after the answer.",
        meta: "Connected operations",
      },
      {
        title: "Handoff without repetition",
        description:
          "Sensitive cases reach the right teammate with the summary and conversation history.",
        meta: "Human + AI teamwork",
      },
    ],
  },
} as const;

type TraceStage = {
  key: "message" | "source" | "response" | "action" | "outcome";
  label: string;
  value: string;
  status: string;
  icon: LucideIcon;
  emphasis?: boolean;
};

function TraceWorkspace({ locale }: { locale: HomeLocale }) {
  const copy = COMMON_COPY[locale];
  const text = TRACE_COPY[locale];
  const reduce = useReducedMotion();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [activeStage, setActiveStage] = useState(2);
  const scenario = copy.scenarios[scenarioIndex];
  const isHandoff = scenario.id === "service";
  const traceNumber = new Intl.NumberFormat(
    locale === "fa" ? "fa-IR" : "en-US",
    {
      minimumIntegerDigits: 2,
      useGrouping: false,
    },
  ).format(scenarioIndex + 1);
  const stages: TraceStage[] = [
    {
      key: "message",
      label: text.message,
      value: scenario.message,
      status: text.received,
      icon: MessageCircleMore,
    },
    {
      key: "source",
      label: text.source,
      value: scenario.source,
      status: text.grounded,
      icon: BookOpenCheck,
    },
    {
      key: "response",
      label: text.response,
      value: scenario.answer,
      status: text.composed,
      icon: Bot,
      emphasis: true,
    },
    {
      key: "action",
      label: isHandoff ? text.handoff : text.action,
      value: scenario.action,
      status: isHandoff ? text.handedOff : text.executed,
      icon: isHandoff ? UserRoundCheck : PackageCheck,
    },
    {
      key: "outcome",
      label: text.outcome,
      value: scenario.outcome,
      status: text.recorded,
      icon: CheckCircle2,
    },
  ];
  const inspected = stages[activeStage];
  const InspectedIcon = inspected.icon;

  return (
    <div
      className="overflow-hidden rounded-[1.45rem] border border-white/[0.12] bg-[#0b0b0b] text-white shadow-[0_34px_100px_rgba(0,0,0,0.42)] sm:rounded-[2rem]"
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <header className="flex min-h-16 flex-col justify-between gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-black">
            <Bot aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-white">
              {text.consoleName}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/38">
              {text.consoleCaption}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-mono text-[10px] text-white/32">
            {text.traceId} · VG-{traceNumber}
          </span>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 text-[10px] font-medium text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {text.live}
          </span>
        </div>
      </header>

      <div className="border-b border-white/10 p-3 sm:p-4">
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          role="tablist"
          aria-label={text.tabsLabel}
        >
          {copy.scenarios.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scenarioIndex === index}
              aria-controls="v4-trace-panel"
              onClick={() => {
                setScenarioIndex(index);
                setActiveStage(2);
              }}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-start text-[10px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]",
                scenarioIndex === index
                  ? "border-white bg-white text-black"
                  : "border-white/[0.09] bg-white/[0.035] text-white/45 hover:bg-white/[0.07] hover:text-white/75",
              )}
            >
              <ProductIcon name={item.icon} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="v4-trace-panel" role="tabpanel" className="p-3 sm:p-4">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={scenario.id}
            initial={
              reduce
                ? false
                : { opacity: 0, transform: "translate3d(0, 12px, 0)" }
            }
            animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, transform: "translate3d(0, -7px, 0)" }
            }
            transition={
              reduce ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }
            }
          >
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white">
                  {scenario.person.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-white/78">
                    {scenario.person}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-white/35">
                    {scenario.channel} · {scenario.label}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/38">
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-300" />
                  {text.verified}
                </span>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5">
                  <Workflow className="h-3 w-3" />
                  {text.reviewable}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="relative rounded-2xl border border-white/[0.09] bg-white/[0.025] p-2.5 sm:p-3">
                <p className="px-1 pb-3 text-[10px] font-medium text-white/35">
                  {text.stagesLabel}
                </p>
                <div
                  aria-hidden
                  className="absolute inset-x-[11%] top-[65px] hidden h-px bg-white/10 2xl:block"
                >
                  <m.span
                    className="block h-full w-full bg-emerald-300/65"
                    initial={reduce ? false : { transform: "scaleX(0)" }}
                    animate={{ transform: "scaleX(1)" }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.72, ease: EASE_OUT }
                    }
                    style={{
                      transformOrigin:
                        locale === "fa" ? "right center" : "left center",
                    }}
                  />
                </div>
                <div className="relative grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
                  {stages.map((stage, index) => {
                    const Icon = stage.icon;
                    const selected = activeStage === index;
                    return (
                      <button
                        key={stage.key}
                        type="button"
                        aria-pressed={selected}
                        aria-controls="v4-trace-inspector"
                        onClick={() => setActiveStage(index)}
                        className={cn(
                          "group relative min-h-[148px] rounded-xl border p-3 text-start transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]",
                          selected || stage.emphasis
                            ? "border-white/75 bg-white text-black"
                            : "border-white/[0.08] bg-[#101010] text-white hover:border-white/20 hover:bg-white/[0.055]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded-lg",
                              selected || stage.emphasis
                                ? "bg-black text-white"
                                : "bg-white/[0.07] text-white/60",
                            )}
                          >
                            <Icon aria-hidden className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[9px]",
                              selected || stage.emphasis
                                ? "text-black/28"
                                : "text-white/25",
                            )}
                          >
                            0{index + 1}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-3 text-[10px] font-semibold",
                            selected || stage.emphasis
                              ? "text-black/45"
                              : "text-white/38",
                          )}
                        >
                          {stage.label}
                        </p>
                        <p
                          className={cn(
                            "mt-1.5 line-clamp-3 text-[11px] font-medium leading-5",
                            selected || stage.emphasis
                              ? "text-black/78"
                              : "text-white/72",
                          )}
                        >
                          {stage.value}
                        </p>
                        <span
                          className={cn(
                            "absolute inset-x-3 bottom-2.5 h-0.5 origin-start rounded-full transition-transform duration-200",
                            selected
                              ? "scale-x-100 bg-emerald-500"
                              : "scale-x-0 bg-current",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside
                id="v4-trace-inspector"
                aria-live="polite"
                className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold text-white/42">
                    {text.inspector}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {text.verified}
                  </span>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <m.div
                    key={`${scenario.id}-${inspected.key}`}
                    initial={
                      reduce
                        ? false
                        : { opacity: 0, transform: "translate3d(0, 7px, 0)" }
                    }
                    animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, transform: "translate3d(0, -4px, 0)" }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.22, ease: EASE_OUT }
                    }
                    className="mt-5"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black">
                      <InspectedIcon aria-hidden className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-white">
                      {inspected.label}
                    </h3>
                    <p className="mt-2 min-h-[72px] text-[11px] leading-6 text-white/60">
                      {inspected.value}
                    </p>
                    <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-5 text-emerald-200/75">
                      {inspected.status}
                    </p>
                  </m.div>
                </AnimatePresence>
                <p className="mt-5 text-[9px] leading-5 text-white/28">
                  {text.inspectHint}
                </p>
              </aside>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5">
                <ShieldCheck
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-white/42"
                />
                <div>
                  <p className="text-[9px] font-medium text-white/28">
                    {text.policy}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-white/65">
                    {isHandoff ? text.humanPolicy : text.autoPolicy}
                  </p>
                </div>
              </div>
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5">
                <CheckCircle2
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-emerald-300"
                />
                <div>
                  <p className="text-[9px] font-medium text-white/28">
                    {text.audit}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-white/65">
                    {text.auditValue}
                  </p>
                </div>
              </div>
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function VariantFourPage({ locale, plans }: HomeVariantPageProps) {
  const copy = COMMON_COPY[locale];
  const hero = VARIANT_COPY[4][locale];
  const text = TRACE_COPY[locale];
  const reduce = useReducedMotion();
  const proofIcons = [BookOpenCheck, Workflow, UserRoundCheck];

  return (
    <div className={styles.page}>
      <section
        className="marketing-story-section relative scroll-mt-24 overflow-hidden bg-[#080808] px-4 pb-16 pt-28 text-white sm:px-8 sm:pb-20 sm:pt-32 lg:pt-36"
        data-theme="dark"
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 opacity-35",
            styles.darkGrid,
          )}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15"
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <m.div
              initial={
                reduce
                  ? false
                  : { opacity: 0, transform: "translate3d(0, 10px, 0)" }
              }
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              transition={
                reduce ? { duration: 0 } : { duration: 0.42, ease: EASE_OUT }
              }
              className="flex justify-center"
            >
              <TrialBadge locale={locale} inverse />
            </m.div>
            <m.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduce ? { duration: 0 } : { delay: 0.07, duration: 0.38 }
              }
              className="mt-6 text-[11px] font-semibold text-emerald-200/65"
            >
              {hero.kicker}
            </m.p>
            <m.h1
              initial={
                reduce
                  ? false
                  : { opacity: 0, transform: "translate3d(0, 18px, 0)" }
              }
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { delay: 0.11, duration: 0.65, ease: EASE_OUT }
              }
              className="mt-4 text-[clamp(2.2rem,7.1vw,6rem)] font-semibold leading-[1.08] tracking-[-0.055em] rtl:tracking-normal"
            >
              <span className="block text-white">{hero.title}</span>
              <span className="block text-white/48">{hero.accent}</span>
            </m.h1>
            <m.p
              initial={
                reduce
                  ? false
                  : { opacity: 0, transform: "translate3d(0, 10px, 0)" }
              }
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { delay: 0.22, duration: 0.48, ease: EASE_OUT }
              }
              className="mx-auto mt-6 max-w-2xl text-[14px] leading-8 text-white/50 sm:text-[16px]"
            >
              {hero.subtitle}
            </m.p>
            <m.div
              initial={
                reduce
                  ? false
                  : { opacity: 0, transform: "translate3d(0, 10px, 0)" }
              }
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { delay: 0.29, duration: 0.46, ease: EASE_OUT }
              }
              className="mt-8 flex justify-center"
            >
              <HeroActions locale={locale} inverse />
            </m.div>
          </div>

          <m.div
            initial={
              reduce
                ? false
                : { opacity: 0, transform: "translate3d(0, 26px, 0)" }
            }
            animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
            transition={
              reduce
                ? { duration: 0 }
                : { delay: 0.23, duration: 0.72, ease: EASE_OUT }
            }
            className="mt-12 sm:mt-14"
          >
            <TraceWorkspace locale={locale} />
          </m.div>

          <div className="mt-8 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-7 sm:flex-row">
            <VariantSwitcher variant={4} locale={locale} inverse />
            <a
              href="#product"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.045] px-4 text-[10px] font-medium text-white/48 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]"
            >
              {locale === "fa"
                ? "دیدن محصول و قابلیت‌ها"
                : "Explore the product"}
              <ArrowDown aria-hidden className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      <Reveal
        id="product"
        className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid items-start gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                eyebrow={text.proofEyebrow}
                title={text.proofTitle}
                subtitle={text.proofSubtitle}
                align="start"
              />
              <div className="mt-7">
                <ChannelPills locale={locale} />
              </div>
              <ul className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {copy.proofs.map((proof) => (
                  <li
                    key={proof}
                    className="flex items-start gap-2.5 text-[11px] leading-6 text-black/52"
                  >
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check aria-hidden className="h-3 w-3" />
                    </span>
                    {proof}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3">
              {text.proofCards.map((card, index) => {
                const Icon = proofIcons[index];
                return (
                  <RevealBlock
                    key={card.title}
                    delay={index * 0.055}
                    className={cn(
                      "group grid gap-5 rounded-[1.6rem] border p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center sm:p-6",
                      index === 1
                        ? "border-black bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
                        : "border-black/[0.075] bg-[var(--bg-base)] text-black",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-14 w-14 place-items-center rounded-2xl",
                        index === 1
                          ? "bg-white text-black"
                          : "bg-black text-white",
                      )}
                    >
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <div>
                      <p
                        className={cn(
                          "text-[10px] font-semibold",
                          index === 1
                            ? "text-emerald-200/65"
                            : "text-emerald-700",
                        )}
                      >
                        {card.meta}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold sm:text-lg">
                        {card.title}
                      </h3>
                      <p
                        className={cn(
                          "mt-2 text-[11px] leading-6",
                          index === 1 ? "text-white/48" : "text-black/46",
                        )}
                      >
                        {card.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "hidden min-h-8 items-center gap-1.5 rounded-full border px-3 text-[9px] font-semibold sm:inline-flex",
                        index === 1
                          ? "border-white/12 text-white/42"
                          : "border-black/[0.08] text-black/38",
                      )}
                    >
                      <CheckCircle2
                        aria-hidden
                        className="h-3 w-3 text-emerald-500"
                      />
                      {text.reviewable}
                    </span>
                  </RevealBlock>
                );
              })}
            </div>
          </div>
          <div className="mt-12">
            <OutcomeStats locale={locale} />
          </div>
        </div>
      </Reveal>

      <CapabilitySection locale={locale} mode="matrix" />
      <OnboardingStory locale={locale} mode="console" inverse />
      <PricingPreview locale={locale} plans={plans} />
      <FaqSection locale={locale} />
      <ClosingCta locale={locale} />
    </div>
  );
}
