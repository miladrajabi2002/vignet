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
        "admin-card spatial-surface min-w-0 rounded-card",
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
      {/* Wraps instead of squeezing: a wide action drops under the title on a
          phone rather than pushing the card past the screen edge. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
        <div className="min-w-0 flex-1 basis-[14rem]">
          <h2 className="ui-h3">{title}</h2>
          {subtitle && <p className="ui-caption mt-0.5">{subtitle}</p>}
        </div>
        {href && linkLabel ? (
          <Link href={href} className="ui-link shrink-0">
            {linkLabel}
            <ChevronLeft aria-hidden />
          </Link>
        ) : action ? (
          <div className="max-w-full">{action}</div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Search + filters above a list (sticks under the header on phones). */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("admin-toolbar", className)}>{children}</div>;
}

// ─── STAT CARD ────────────────────────────────────────────────────

type StatTone = "default" | "success" | "warning" | "danger" | "info";

// Icon tile + mini-trend colour per tone. This is the one place the console
// uses colour freely: a tinted tile and a matching sparkline, nothing more.
const STAT_TONES: Record<StatTone, { tile: string; spark: string }> = {
  default: {
    tile: "bg-[#111] text-white",
    spark: "#111111",
  },
  success: {
    tile: "bg-[var(--ok-soft)] text-[var(--ok-ink)]",
    spark: "#15803d",
  },
  warning: {
    tile: "bg-[var(--warn-soft)] text-[var(--warn-ink)]",
    spark: "#d97706",
  },
  danger: {
    tile: "bg-[var(--danger-soft)] text-[var(--danger-ink)]",
    spark: "#dc2626",
  },
  info: {
    tile: "bg-[var(--signal-tint)] text-[var(--signal-strong)]",
    spark: "#5b3de8",
  },
};

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
  tone?: StatTone;
  trend?: { value: number; label?: string }; // percentage, +/-
  series?: number[]; // 7-day (or similar) daily values for an inline sparkline
  seriesLabels?: string[]; // optional per-point labels (e.g. Persian short dates) for the hover tooltip
  seriesValueFormat?: "number" | "irr" | "usd"; // value formatting inside the hover tooltip
}) {
  const palette = STAT_TONES[tone];

  // Split a trailing currency unit («تومان») off the value string so it can
  // render much smaller than the number and stay on the same baseline —
  // the unit no longer wraps/drops below on narrow cards.
  const valueText = typeof value === "number" ? fa(value) : value;
  const unitMatch =
    typeof value === "string" ? /^(.+?)\s*(تومان)\s*$/.exec(value) : null;

  return (
    // Compact tile: tinted icon beside the label, the value under it, and
    // only as much height as the content needs.
    <Card pad={false} className="flex flex-col p-3.5 sm:p-4">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-chip sm:h-9 sm:w-9 [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-[1.05rem] sm:[&_svg]:w-[1.05rem]",
              palette.tile,
            )}
          >
            {icon}
          </span>
        )}
        <p className="line-clamp-2 min-w-0 text-[12px] font-medium leading-5 text-[var(--text-secondary)] sm:text-[13px]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 flex flex-wrap items-baseline gap-x-1 text-[clamp(1.05rem,4.6vw,1.6rem)] font-bold leading-tight tabular-nums sm:gap-x-1.5",
          tone === "danger"
            ? "text-[var(--danger-ink)]"
            : "text-[var(--text-primary)]",
        )}
      >
        {unitMatch ? (
          <>
            <span className="whitespace-nowrap">{unitMatch[1]}</span>
            <span className="whitespace-nowrap text-[12px] font-normal text-[var(--text-muted)] sm:text-[13px]">
              {unitMatch[2]}
            </span>
          </>
        ) : (
          valueText
        )}
      </p>
      {sub && (
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]" title={sub}>
          {sub}
        </p>
      )}
      {trend && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "ui-chip",
              trend.value >= 0 ? "ui-chip-ok" : "ui-chip-danger",
            )}
          >
            <span aria-hidden>{trend.value >= 0 ? "▲" : "▼"}</span>
            {Math.abs(trend.value).toLocaleString("fa-IR")}٪
          </span>
          {trend.label && (
            <span className="text-[12px] text-[var(--text-muted)]">
              {trend.label}
            </span>
          )}
        </div>
      )}
      {series && series.length > 0 && (
        <div className="mt-auto pt-2.5">
          <Sparkline
            data={series}
            color={palette.spark}
            width={200}
            height={28}
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
  return <span className={cn(BADGE_TONES[tone], className)}>{children}</span>;
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
        "whitespace-nowrap px-4 py-3 text-start text-[12px] font-medium text-[var(--text-muted)]",
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
    <td
      title={title}
      className={cn(
        "px-4 py-3 text-[13px] text-[var(--text-secondary)]",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TableShell({
  children,
  minWidth = 640,
  bare = false,
}: {
  children: React.ReactNode;
  minWidth?: number;
  /** Inside a Panel: no second card around the table. */
  bare?: boolean;
}) {
  return (
    // The page is the only vertical scroller; the shell only scrolls sideways
    // when a tablet column is narrower than the table.
    // Below md the rows stack into labelled cards (ط۱۵, app/ui-system.css).
    <div
      className={cn(
        "admin-table-shell admin-scroll ui-rtable overflow-x-auto overscroll-x-contain max-md:overflow-visible",
        // A surface only from md up: on phones each row is its own card.
        bare
          ? "rounded-control md:border md:border-[var(--border-subtle)]"
          : "rounded-card md:spatial-surface",
      )}
    >
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
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-[var(--border-hover)] px-4 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-control bg-[var(--bg-muted)] text-[var(--text-muted)] [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <p className="max-w-sm text-[13px] leading-6 text-[var(--text-muted)]">
        {children}
      </p>
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
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const bar = {
    default: "bg-[#111]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-[var(--signal)]",
  }[tone];
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full", bar)}
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
      <span className="shrink-0 text-xs text-[var(--text-muted)]">{label}</span>
      <span
        className={cn(
          "min-w-0 text-end text-sm font-medium text-[var(--text-primary)] [overflow-wrap:anywhere]",
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
      <span className="text-xs font-medium text-[var(--text-muted)]">
        {children}
      </span>
      <div className="h-px flex-1 bg-[var(--border-default)]" />
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────

/** Prev/next pagination for the admin area (RTL). */
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
    <nav
      aria-label="صفحه‌بندی"
      className="flex items-center justify-between gap-3 pt-2"
    >
      <PageBtn
        href={page > 1 ? makeHref(page - 1) : null}
        label="قبلی"
        icon={<ChevronRight className="h-4 w-4" />}
      />
      <span className="text-xs tabular-nums text-[var(--text-muted)]">
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
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="admin-toolbar-button min-h-11 cursor-not-allowed px-4 text-[13px] opacity-40 shadow-none md:min-h-10"
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
      className="admin-toolbar-button min-h-11 px-4 text-[13px] text-[var(--text-primary)] md:min-h-10"
    >
      {!after && icon}
      {label}
      {after && icon}
    </Link>
  );
}

// ─── FILTER PILLS ─────────────────────────────────────────────────

/** Link filters as the shared segmented control (grey track, white pill). */
export function FilterPills({
  options,
}: {
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="ui-seg inline-grid grid-flow-col text-[12px]">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.active ? "page" : undefined}
          className="ui-seg-tab min-h-9 whitespace-nowrap px-3"
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
