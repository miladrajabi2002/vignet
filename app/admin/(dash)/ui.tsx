import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Sparkline } from "@/components/admin/sparkline";
import { TableLabels } from "@/components/admin/table-labels";
import { cn } from "@/lib/utils";
import { PERSIAN_DATE_LOCALE } from "@/lib/localized-date";
import { PageHeader as DashboardPageHeader } from "@/components/dashboard/page-header";

// ─── FORMATTERS ───────────────────────────────────────────────────

/** Compact Persian date+time for admin tables. */
export function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Persian date only (no time). */
export function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Persian number formatting. */
export function fa(n: number | bigint | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("fa-IR");
}

/** Format a Rial amount as Persian Toman with separator (Toman = Rial / 10). */
export function fmtIRR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${Math.round(amount / 10).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} تومان`;
}

/** Format USD amount. */
export function fmtUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
}

// ─── CARD ─────────────────────────────────────────────────────────

/** The universal surface container — white card with subtle border + shadow. */
export function Card({
  children,
  className,
  pad = true,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div
      className={cn(
        "admin-card spatial-surface rounded-card",
        pad && "p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card with a titled header row. */
export function Panel({
  title,
  subtitle,
  href,
  linkLabel,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-black">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.045] hover:text-black"
          >
            {linkLabel}
          </Link>
        ) : action ? (
          action
        ) : null}
      </div>
      {children}
    </Card>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  trend,
  series,
  seriesLabels,
  seriesValueFormat = "number",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  trend?: { value: number; label?: string }; // percentage, +/-
  series?: number[]; // 7-day (or similar) daily values for an inline sparkline
  seriesLabels?: string[]; // optional per-point labels (e.g. Persian short dates) for the hover tooltip
  seriesValueFormat?: "number" | "irr" | "usd"; // value formatting inside the hover tooltip
}) {
  const toneRing = {
    default: "bg-zinc-100 text-zinc-700",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-100",
    info: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  }[tone];

  const valueColor = tone === "danger" ? "text-red-700" : "text-zinc-900";

  // Split a trailing currency unit («تومان») off the value string so it can
  // render much smaller than the number and stay on the same baseline —
  // the unit no longer wraps/drops below on narrow cards.
  const valueText = typeof value === "number" ? fa(value) : value;
  const unitMatch =
    typeof value === "string" ? /^(.+?)\s*(تومان)\s*$/.exec(value) : null;

  // Sparkline stroke color follows the card tone.
  const sparkColor =
    tone === "danger"
      ? "#dc2626"
      : tone === "success"
        ? "#16a34a"
        : tone === "info"
          ? "#0a84ff"
          : tone === "warning"
            ? "#d97706"
            : "#18181b";

  return (
    <Card className="group relative min-h-[8.25rem] overflow-hidden transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[0.14] hover:shadow-[var(--shadow-float)] active:scale-[.995]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">{label}</p>
          <p
            className={cn(
              "mt-2 flex flex-wrap items-baseline gap-x-1 text-[clamp(0.9rem,3.4vw,1.8rem)] font-bold leading-tight tracking-tight tabular-nums sm:gap-x-1.5",
              valueColor,
            )}
          >
            {unitMatch ? (
              <>
                <span className="whitespace-nowrap">{unitMatch[1]}</span>
                <span className="whitespace-nowrap text-[clamp(0.6rem,1.6vw,0.85rem)] font-semibold tracking-normal text-[var(--text-muted)]">
                  {unitMatch[2]}
                </span>
              </>
            ) : (
              valueText
            )}
          </p>
          {sub && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]">
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.04]",
              toneRing,
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
              trend.value >= 0
                ? "bg-zinc-100 text-zinc-800"
                : "bg-zinc-900 text-white",
            )}
          >
            {trend.value >= 0 ? "▲" : "▼"}{" "}
            {Math.abs(trend.value).toLocaleString("fa-IR")}٪
          </span>
          {trend.label && (
            <span className="text-[12px] text-zinc-400">{trend.label}</span>
          )}
        </div>
      )}
      {series && series.length > 0 && (
        <div className="mt-3">
          <Sparkline
            data={series}
            color={sparkColor}
            width={200}
            height={32}
            fluid
            labels={seriesLabels}
            valueLabel={label}
            valueFormat={seriesValueFormat}
          />
        </div>
      )}
    </Card>
  );
}

// ─── BADGES ───────────────────────────────────────────────────────

type BadgeTone =
  "default" | "success" | "warning" | "danger" | "info" | "muted";

// Shared chip palette (app/ui-system.css) so admin and dashboard agree.
const BADGE_TONES: Record<BadgeTone, string> = {
default: "ui-chip ui-chip-live",
success: "ui-chip ui-chip-ok",
warning: "ui-chip ui-chip-warn",
danger: "ui-chip ui-chip-danger",
info: "ui-chip ui-chip-signal",
muted: "ui-chip ui-chip-neutral",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Severity badge for an ErrorLog level. */
export function LevelBadge({ level }: { level: string }) {
  if (level === "error") return <Badge tone="danger">خطا</Badge>;
  if (level === "warn") return <Badge tone="warning">هشدار</Badge>;
  if (level === "info") return <Badge tone="info">اطلاعات</Badge>;
  return <Badge tone="muted">دیباگ</Badge>;
}

// ─── TABLE HELPERS ────────────────────────────────────────────────

export function Th({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th
      title={title}
      className={cn(
        "whitespace-nowrap px-4 py-3.5 text-start text-[12px] font-semibold text-zinc-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={cn("px-4 py-3.5 text-[13px] text-zinc-700", className)}>
      {children}
    </td>
  );
}

export function TableShell({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    // The shell scrolls on both axes and caps its height, so the sticky
    // thead (globals.css .admin-table-shell table thead) actually engages
    // while long user/payment tables scroll — instead of being inert behind
    // an overflow-x-only ancestor.
    // Below md the rows stack into labelled cards (ط۱۵, app/ui-system.css).
    <div className="admin-table-shell ui-rtable spatial-surface max-h-[min(70dvh,44rem)] overflow-auto overscroll-contain rounded-card [scrollbar-width:thin] max-md:max-h-none max-md:overflow-visible max-md:border-0 max-md:bg-transparent max-md:shadow-none">
      <TableLabels>
        <table className="w-full md:[min-width:var(--table-min)]" style={{ "--table-min": `${minWidth}px` } as React.CSSProperties}>
          {children}
        </table>
      </TableLabels>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────

export function EmptyState({
  children,
  icon,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="text-zinc-300">{icon}</div>}
      <p className="text-sm text-zinc-500">{children}</p>
    </div>
  );
}

// ─── PAGE HEADER ──────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  breadcrumbs,
  icon,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Round back control at the start of the title row. */
  back?: { href: string; label: string };
  breadcrumbs?: { label: string; href?: string }[];
  /** Optional ink tile beside the title — same as the user dashboard. */
  icon?: React.ComponentType<{ className?: string }>;
}) {
  // One header for both panels: the admin keeps its `action` prop name.
  return (
    <DashboardPageHeader
      title={title}
      subtitle={subtitle}
      actions={action}
      back={back}
      breadcrumbs={breadcrumbs}
      icon={icon}
    />
  );
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────

export function Progress({
  value,
  max = 100,
  tone = "default",
  className,
}: {
  value: number;
  max?: number;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const bar = {
    default: "bg-zinc-900",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  }[tone];
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-zinc-100",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          bar,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── KEY/VALUE ROW ────────────────────────────────────────────────

export function KV({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span
        className={cn(
          "min-w-0 break-words text-end text-sm font-medium text-zinc-900",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </span>
    </div>
  );
}

// ─── SECTION DIVIDER ──────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────

/** Light-themed prev/next pagination for the admin area (RTL). */
export function AdminPagination({
  page,
  hasNext,
  makeHref,
}: {
  page: number;
  hasNext: boolean;
  makeHref: (page: number) => string;
}) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav className="flex items-center justify-between gap-3 pt-4">
      <PageBtn
        href={page > 1 ? makeHref(page - 1) : null}
        label="قبلی"
        icon={<ChevronRight className="h-4 w-4" />}
      />
      <span className="text-xs text-zinc-500">
        صفحه {page.toLocaleString("fa-IR")}
      </span>
      <PageBtn
        href={hasNext ? makeHref(page + 1) : null}
        label="بعدی"
        icon={<ChevronLeft className="h-4 w-4" />}
        after
      />
    </nav>
  );
}

function PageBtn({
  href,
  label,
  icon,
  after = false,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  after?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors";
  if (!href) {
    return (
      <span
        className={`${base} cursor-not-allowed border-zinc-200 text-zinc-300`}
      >
        {!after && icon}
        {label}
        {after && icon}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50`}
    >
      {!after && icon}
      {label}
      {after && icon}
    </Link>
  );
}

// ─── FILTER PILLS ─────────────────────────────────────────────────

export function FilterPills({
  options,
}: {
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 text-xs">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={cn(
            "rounded-lg px-3 py-1.5 font-medium transition-colors",
            o.active
              ? "bg-zinc-900 text-white"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
