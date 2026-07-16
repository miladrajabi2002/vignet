import { prisma } from '@/lib/prisma'

export const DATABASE_MODELS = [
  { key: 'Workspace', label: 'کسب‌وکارها', order: 'createdAt' },
  { key: 'User', label: 'کاربران', order: 'createdAt' },
  { key: 'Agent', label: 'ایجنت‌ها', order: 'createdAt' },
  { key: 'AgentChannel', label: 'کانال‌ها', order: 'createdAt' },
  { key: 'Contact', label: 'مخاطبان', order: 'createdAt' },
  { key: 'Conversation', label: 'گفتگوها', order: 'createdAt' },
  { key: 'Message', label: 'پیام‌ها', order: 'createdAt' },
  { key: 'UsageLog', label: 'مصرف AI', order: 'date' },
  { key: 'Subscription', label: 'اشتراک‌ها', order: 'createdAt' },
  { key: 'Payment', label: 'پرداخت‌ها', order: 'createdAt' },
  { key: 'WalletLedger', label: 'گردش اعتبار', order: 'createdAt' },
  { key: 'PlatformAiSettings', label: 'سیاست AI', order: 'updatedAt' },
  { key: 'AdminAuditLog', label: 'ممیزی ادمین', order: 'createdAt' },
  { key: 'AdminVigentoMessage', label: 'تاریخچه ویجنتو', order: 'createdAt' },
  { key: 'ErrorLog', label: 'خطاها', order: 'createdAt' },
  { key: 'Notification', label: 'اعلان‌ها', order: 'createdAt' },
  { key: 'Campaign', label: 'کمپین‌ها', order: 'createdAt' },
  { key: 'Product', label: 'محصولات', order: 'createdAt' },
  { key: 'KnowledgeBase', label: 'پایگاه دانش', order: 'createdAt' },
  { key: 'Appointment', label: 'رزروها', order: 'createdAt' },
  { key: 'Service', label: 'خدمات', order: 'createdAt' },
  { key: 'BlogPost', label: 'مقالات', order: 'createdAt' },
] as const

export type DatabaseModelKey = (typeof DATABASE_MODELS)[number]['key']

const SENSITIVE_FIELD = /(password|secret|token|cookie|authorization|api.?key|otp|config|settings)/i

function serializeValue(key: string, value: unknown): string {
  if (SENSITIVE_FIELD.test(key)) return '•••••••• (مخفی)'
  if (value === null || value === undefined) return '—'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.length > 520 ? `${value.slice(0, 520)}…` : value
  if (typeof value === 'object') {
    const text = JSON.stringify(value, (_key, nested) => typeof nested === 'bigint' ? nested.toString() : nested)
    return text.length > 520 ? `${text.slice(0, 520)}…` : text
  }
  return String(value)
}

export async function readDatabaseModel(modelKey: string, page: number, pageSize = 25) {
  const model = DATABASE_MODELS.find((item) => item.key === modelKey) ?? DATABASE_MODELS[0]
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safeSize = Math.min(50, Math.max(10, Math.floor(pageSize) || 25))
  const offset = (safePage - 1) * safeSize

  const [countRows, rawRows, connectionRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) AS "count" FROM "${model.key}"`),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "${model.key}" ORDER BY "${model.order}" DESC NULLS LAST LIMIT ${safeSize} OFFSET ${offset}`,
    ),
    prisma.$queryRaw<Array<{ database: string; version: string }>>`
      SELECT current_database() AS "database", version() AS "version"
    `,
  ])

  return {
    model,
    page: safePage,
    pageSize: safeSize,
    total: Number(countRows[0]?.count ?? 0),
    database: connectionRows[0]?.database ?? 'PostgreSQL',
    version: connectionRows[0]?.version?.split(',')[0] ?? 'PostgreSQL',
    columns: rawRows[0] ? Object.keys(rawRows[0]) : [],
    rows: rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serializeValue(key, value)]))),
  }
}
