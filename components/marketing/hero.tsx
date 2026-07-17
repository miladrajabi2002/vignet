"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  GraduationCap,
  Gift,
  Play,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { NeuralOperationGraph } from "./neural-operation-graph";
import { Spotlight } from "./spotlight";

type Locale = "fa" | "en";

type BusinessScene = {
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

type HeroCopy = {
  kicker: string;
  headlineTop: string;
  headlineBottom: string;
  stageAria: string;
  stageTitle: string;
  connected: string;
  live: string;
  verticalLabel: string;
  core: string;
  coreHint: string;
  allMessages: string;
  sharedBrain: string;
  promises: readonly string[];
  flow: readonly string[];
  scenes: readonly BusinessScene[];
};

const COPY: Record<Locale, HeroCopy> = {
  fa: {
    kicker: "هوش مصنوعی فارسی برای فروش و پشتیبانی",
    headlineTop: "هر پیام، یک پاسخ دقیق",
    headlineBottom: "از همه‌جا، در یک پنل",
    stageAria:
      "نمایش زنده پنج پنل تخصصی فروشگاه، سفارش غذا، نوبت‌دهی، خدمات و آموزش که به هسته هوشمند ویجنت و کانال‌های ارتباطی متصل‌اند.",
    stageTitle: "مرکز عملیات هوشمند کسب‌وکار",
    connected: "۵ پنل تخصصی · همه کانال‌ها",
    live: "پاسخ‌گویی زنده",
    verticalLabel: "ویجنت متناسب با مدل کسب‌وکار شما عمل می‌کند",
    core: "Vigento AI",
    coreHint: "هوش مصنوعی ویجنتو",
    allMessages: "پیام‌های تازه از همه‌جا",
    sharedBrain: "یک ایجنت، یک پاسخ دقیق",
    flow: ["پیام دریافت شد", "دانش پیدا شد", "پاسخ و اقدام ثبت شد"],
    promises: [
      "یک ماه رایگان",
      "اتوماسیون اینستاگرام رایگان",
      "اعتبار فقط برای پاسخ موفق AI",
    ],
    scenes: [
      {
        name: "فروشگاه",
        channel: "اینستاگرام",
        person: "سارا",
        text: "رنگ مشکی این مدل موجوده؟",
        time: "همین حالا",
        reply: "بله، رنگ مشکی موجود است و لینک خرید برای شما آماده شد.",
        source: "کاتالوگ + موجودی زنده",
        result: "موجودی تأیید و لینک خرید ارسال شد",
        confidence: "۹۸٪",
        quickActions: ["مشاهده محصول", "افزودن به سبد"],
      },
      {
        name: "سفارش غذا",
        channel: "واتساپ",
        person: "امیر",
        text: "سفارشم چه زمانی می‌رسه؟",
        time: "۱ دقیقه پیش",
        reply: "سفارش شما ثبت شده و حداکثر تا ۳۰ دقیقه دیگر تحویل می‌شود.",
        source: "سفارش + وضعیت ارسال",
        result: "وضعیت سفارش ثبت و مشتری مطلع شد",
        confidence: "۹۹٪",
        quickActions: ["پیگیری سفارش", "ارسال موقعیت"],
      },
      {
        name: "نوبت‌دهی",
        channel: "ویجت وب",
        person: "نگار",
        text: "برای جمعه وقت خالی دارید؟",
        time: "۲ دقیقه پیش",
        reply:
          "بله، برای جمعه این زمان‌ها خالی هستند؛ ساعت مناسب را انتخاب کنید.",
        source: "تقویم + ظرفیت نوبت‌ها",
        result: "زمان‌های آزاد پیدا و آماده رزرو شد",
        confidence: "۹۸٪",
        quickActions: ["۱۰:۰۰", "۱۲:۰۰", "۱۶:۰۰", "۱۸:۰۰"],
      },
      {
        name: "خدمات",
        channel: "تلگرام",
        person: "مهدی",
        text: "برای نصب، کارشناس می‌فرستید؟",
        time: "۳ دقیقه پیش",
        reply:
          "بله، درخواست شما ثبت شد و نزدیک‌ترین کارشناس برای هماهنگی معرفی می‌شود.",
        source: "خدمات + محدوده پوشش",
        result: "درخواست ثبت و پیگیری خودکار فعال شد",
        confidence: "۹۷٪",
        quickActions: ["ثبت درخواست", "ارتباط با کارشناس"],
      },
      {
        name: "آموزش",
        channel: "روبیکا",
        person: "رضا",
        text: "این دوره پیش‌نیاز هم داره؟",
        time: "۴ دقیقه پیش",
        reply:
          "خیر، دوره از سطح مقدماتی شروع می‌شود و برای شروع به پیش‌نیاز نیاز ندارد.",
        source: "دانش دوره + سرفصل‌ها",
        result: "پاسخ دوره ارسال و سرنخ ثبت شد",
        confidence: "۹۹٪",
        quickActions: ["مشاهده سرفصل", "ثبت‌نام دوره"],
      },
    ],
  },
  en: {
    kicker: "Persian AI for sales and support",
    headlineTop: "Every message gets a clear answer",
    headlineBottom: "Every channel, one inbox",
    stageAria:
      "A live presentation of five specialized workspaces for commerce, food orders, appointments, services and education connected to the Vigent intelligence core.",
    stageTitle: "The intelligent business operating system",
    connected: "5 specialized workspaces · every channel",
    live: "Live replies",
    verticalLabel: "Vigent adapts to how your business operates",
    core: "Vigento AI",
    coreHint: "Vigent business intelligence",
    allMessages: "New messages from everywhere",
    sharedBrain: "One agent, one precise answer",
    flow: ["Message received", "Knowledge found", "Reply and action logged"],
    promises: [
      "One month free",
      "Free Instagram automation",
      "Credit only for successful AI replies",
    ],
    scenes: [
      {
        name: "Commerce",
        channel: "Instagram",
        person: "Sara",
        text: "Is this available in black?",
        time: "just now",
        reply: "Yes, black is in stock and your checkout link is ready.",
        source: "Catalog + live inventory",
        result: "Stock confirmed and checkout link sent",
        confidence: "98%",
        quickActions: ["View item", "Add to cart"],
      },
      {
        name: "Food",
        channel: "WhatsApp",
        person: "Amir",
        text: "When will my order arrive?",
        time: "1 min ago",
        reply: "Your order is confirmed and will arrive within 30 minutes.",
        source: "Order + delivery status",
        result: "Order status logged and customer updated",
        confidence: "99%",
        quickActions: ["Track order", "Send location"],
      },
      {
        name: "Booking",
        channel: "Web widget",
        person: "Negar",
        text: "Do you have an opening on Friday?",
        time: "2 min ago",
        reply: "Yes. These times are available on Friday; choose the best one.",
        source: "Calendar + live availability",
        result: "Available times found and ready to book",
        confidence: "98%",
        quickActions: ["10:00", "12:00", "16:00", "18:00"],
      },
      {
        name: "Services",
        channel: "Telegram",
        person: "Mehdi",
        text: "Can you send a technician?",
        time: "3 min ago",
        reply:
          "Yes. Your request is logged and the nearest technician will contact you.",
        source: "Services + coverage area",
        result: "Request logged and automatic follow-up enabled",
        confidence: "97%",
        quickActions: ["Create request", "Contact technician"],
      },
      {
        name: "Education",
        channel: "Rubika",
        person: "Reza",
        text: "Does this course have prerequisites?",
        time: "4 min ago",
        reply:
          "No. The course begins at the introductory level and needs no prerequisite.",
        source: "Course knowledge + syllabus",
        result: "Answer sent and lead recorded",
        confidence: "99%",
        quickActions: ["View syllabus", "Enroll"],
      },
    ],
  },
};

const BUSINESS_ICONS: ComponentType<{ className?: string }>[] = [
  ShoppingBag,
  UtensilsCrossed,
  CalendarCheck2,
  BriefcaseBusiness,
  GraduationCap,
];

function ProductStage({ reduce }: { reduce: boolean | null }) {
  const locale: Locale = useLocale() === "en" ? "en" : "fa";
  const copy = COPY[locale];
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % copy.scenes.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [copy.scenes.length, paused, reduce]);

  const scene = copy.scenes[activeIndex];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0.45, y: 16, scale: 0.988 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.58, delay: 0.08, ease: [0.16, 1, 0.3, 1] }
      }
      className="relative mx-auto w-full max-w-[720px]"
      role="region"
      aria-label={copy.stageAria}
      dir={locale === "fa" ? "rtl" : "ltr"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-[2rem] border border-black bg-[#050505] text-white shadow-[0_34px_100px_rgba(0,0,0,0.27)]">
        <div
          aria-hidden
          className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-55"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-28 top-16 h-64 w-64 rounded-full bg-emerald-300/[0.055] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 bottom-8 h-56 w-56 rounded-full bg-white/[0.045] blur-3xl"
        />

        <header className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.14)]">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[10px] font-semibold text-white sm:text-xs">
                {copy.stageTitle}
              </p>
              <p className="mt-0.5 whitespace-nowrap text-[8px] text-white/40 sm:text-[10px]">
                {copy.connected}
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-medium text-emerald-200 sm:text-[10px]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50 motion-reduce:animate-none" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            {copy.live}
          </span>
        </header>

        <div className="relative px-3.5 pt-4 sm:px-5">
          <p className="mb-2 whitespace-nowrap text-[8px] font-medium text-white/[0.38] sm:text-[9px]">
            {copy.verticalLabel}
          </p>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {copy.scenes.map((business, index) => {
              const Icon = BUSINESS_ICONS[index];
              const active = index === activeIndex;

              return (
                <button
                  key={business.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveIndex(index)}
                  className={`group relative z-10 min-w-0 overflow-hidden rounded-xl border px-0.5 py-2 text-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-emerald-300/70 sm:rounded-2xl sm:px-1 sm:py-2.5 ${
                    active
                      ? "border-white/35 text-black"
                      : "border-white/10 bg-white/[0.045] text-white/[0.48] hover:bg-white/[0.07] hover:text-white/70"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="vigent-active-business"
                      className="absolute inset-0 bg-white"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  ) : null}

                  <span
                    className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-8 ${
                      active
                        ? "bg-black text-white"
                        : "bg-white/[0.06] text-white/55 group-hover:text-white/75"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>

                  <span className="relative mt-1.5 block truncate px-0.5 text-[7px] font-medium sm:text-[9px]">
                    {business.name}
                  </span>

                  {active ? (
                    <motion.span
                      layoutId="vigent-active-business-line"
                      className="absolute inset-x-[38%] bottom-0 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <NeuralOperationGraph
          locale={locale}
          reduce={reduce}
          activeIndex={activeIndex}
          scenario={scene}
          allMessages={copy.allMessages}
          core={copy.core}
          coreHint={copy.coreHint}
          sharedBrain={copy.sharedBrain}
        />

        <div className="relative grid grid-cols-3 overflow-hidden border-t border-white/10 bg-black/20">
          {copy.flow.map((step, index) => (
            <motion.div
              key={`${activeIndex}-${step}`}
              initial={reduce ? false : { opacity: 0.32 }}
              animate={{ opacity: 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.34, delay: 0.35 + index * 0.28 }
              }
              className="flex min-w-0 items-center justify-center gap-1 border-e border-white/10 px-1 py-2.5 text-center last:border-e-0 sm:gap-1.5 sm:py-3"
            >
              <motion.span
                initial={reduce ? false : { scale: 0.7, opacity: 0.3 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { delay: 0.35 + index * 0.28, duration: 0.3 }
                }
                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300 sm:h-4 sm:w-4"
              >
                <Check className="h-2.5 w-2.5" />
              </motion.span>
              <span className="whitespace-nowrap text-[clamp(6.4px,1.3vw,9px)] text-white/[0.48]">
                {step}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const t = useTranslations("marketing.hero");
  const locale: Locale = useLocale() === "en" ? "en" : "fa";
  const copy = COPY[locale];
  const reduce = useReducedMotion();
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;

  return (
    <section className="marketing-hero-spatial relative overflow-hidden pb-14 pt-[94px] sm:pb-16 sm:pt-28 lg:flex lg:min-h-[min(820px,100svh)] lg:items-center lg:pb-14 lg:pt-24">
      <Spotlight />

      <div className="marketing-hero-content relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-9 xl:gap-14">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-start">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5 }}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--accent-border)] bg-white px-3.5 text-[11px] font-medium text-[var(--text-secondary)]"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-45 motion-reduce:animate-none" />
              <span className="relative h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            {copy.kicker}
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.48, delay: 0.03, ease: [0.16, 1, 0.3, 1] }
            }
            className="mt-5 text-[clamp(1.5rem,6vw,2.15rem)] font-semibold leading-[1.18] tracking-[-0.03em] text-[var(--text-primary)] rtl:tracking-normal sm:text-[clamp(1.7rem,4.6vw,2.6rem)] md:text-[clamp(1.85rem,3.4vw,2.85rem)] lg:text-[clamp(2rem,2.9vw,3.1rem)] xl:text-[clamp(2.1rem,2.6vw,3.4rem)]"
          >
            <span className="marketing-hero-line block md:whitespace-nowrap">
              {copy.headlineTop}
            </span>
            <span className="marketing-hero-line block text-[var(--text-muted)] md:whitespace-nowrap">
              {copy.headlineBottom}
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.42, delay: 0.08, ease: [0.23, 1, 0.32, 1] }
            }
            className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base sm:leading-8 lg:mx-0"
          >
            {t("subtitle")}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.4, delay: 0.14, ease: [0.23, 1, 0.32, 1] }
            }
            className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
          >
            <Link
              href="/login?next=/onboarding"
              className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-6 text-sm font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] hover:bg-[var(--text-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              {t("ctaPrimary")}
              <Arrow
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <Link
              href="#demo"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-6 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <Play
                className="h-3.5 w-3.5 fill-[var(--text-primary)]"
                aria-hidden
              />
              {t("ctaSecondary")}
            </Link>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? { duration: 0 } : { delay: 0.27, duration: 0.45 }
            }
            className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
          >
            {copy.promises.map((promise, index) => (
              <span
                key={promise}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 text-[10px] font-medium text-black/55 shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
              >
                {index === 0 ? (
                  <Gift className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {promise}
              </span>
            ))}
          </motion.div>
        </div>

        <ProductStage reduce={reduce} />
      </div>
    </section>
  );
}
