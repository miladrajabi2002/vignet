export const BUSINESS_TYPES = [
  'COMMERCE',
  'FOOD',
  'APPOINTMENTS',
  'SERVICES',
  'EDUCATION',
  'CUSTOM',
] as const

export type BusinessTypeValue = (typeof BUSINESS_TYPES)[number]

export type DashboardModuleKey =
  | 'overview'
  | 'agents'
  | 'products'
  | 'appointments'
  | 'conversations'
  | 'contacts'
  | 'analytics'
  | 'integrations'
  | 'billing'
  | 'settings'

export type CapabilityPackKey =
  | 'managed_ai'
  | 'crm_support'
  | 'social_automation'
  | 'knowledge_rag'

export interface VerticalPack {
  key: BusinessTypeValue
  titleFa: string
  titleEn: string
  descriptionFa: string
  descriptionEn: string
  /** Modules every Vigent workspace receives, regardless of vertical. */
  coreModules: readonly DashboardModuleKey[]
  /** Operational modules highlighted for this vertical. */
  optionalModules: readonly DashboardModuleKey[]
  capabilities: readonly CapabilityPackKey[]
  suggestedServicesFa: readonly string[]
  suggestedServicesEn: readonly string[]
  /** Existing agent-builder preset used after onboarding. */
  agentTemplate: 'store' | 'services' | 'education' | 'custom'
}

export const CORE_DASHBOARD_MODULES = [
  'overview',
  'agents',
  'conversations',
  'contacts',
  'analytics',
  'integrations',
  'billing',
  'settings',
] as const satisfies readonly DashboardModuleKey[]

export const CORE_CAPABILITY_PACKS = [
  'managed_ai',
  'crm_support',
  'social_automation',
  'knowledge_rag',
] as const satisfies readonly CapabilityPackKey[]

const PACKS: Record<BusinessTypeValue, VerticalPack> = {
  COMMERCE: {
    key: 'COMMERCE',
    titleFa: 'فروشگاه و فروش آنلاین',
    titleEn: 'Commerce & online sales',
    descriptionFa: 'کاتالوگ، راهنمای خرید، پیگیری سفارش و فروش در همه کانال‌ها',
    descriptionEn: 'Catalog, guided selling and order follow-up across every channel',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['فروش محصول', 'مشاوره خرید', 'پیگیری سفارش'],
    suggestedServicesEn: ['Product sales', 'Buying advice', 'Order tracking'],
    agentTemplate: 'store',
  },
  FOOD: {
    key: 'FOOD',
    titleFa: 'رستوران، کافه و سفارش غذا',
    titleEn: 'Food & hospitality',
    descriptionFa: 'منو، پیشنهاد هوشمند، ثبت سفارش و پاسخ‌گویی سریع به مشتری',
    descriptionEn: 'Menus, recommendations, order capture and fast customer service',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products', 'appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['سفارش بیرون‌بر', 'رزرو میز', 'پشتیبانی سفارش'],
    suggestedServicesEn: ['Takeaway orders', 'Table booking', 'Order support'],
    agentTemplate: 'store',
  },
  APPOINTMENTS: {
    key: 'APPOINTMENTS',
    titleFa: 'نوبت‌دهی و رزرو',
    titleEn: 'Appointments & booking',
    descriptionFa: 'تقویم، ظرفیت، زمان‌های آزاد و رزرو بدون تداخل برای هر خدمت',
    descriptionEn: 'Availability, capacity and conflict-free booking for every service',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['مشاوره', 'ویزیت', 'خدمات زیبایی', 'رزرو جلسه'],
    suggestedServicesEn: ['Consultation', 'Visit', 'Beauty service', 'Meeting'],
    agentTemplate: 'services',
  },
  SERVICES: {
    key: 'SERVICES',
    titleFa: 'خدمات و پروژه',
    titleEn: 'Services & projects',
    descriptionFa: 'جمع‌آوری نیاز، ثبت درخواست، پیگیری مشتری و هماهنگی انجام کار',
    descriptionEn: 'Qualify requests, capture leads and coordinate service delivery',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['برآورد و مشاوره', 'ثبت درخواست', 'بازدید حضوری'],
    suggestedServicesEn: ['Estimate & consultation', 'Service request', 'On-site visit'],
    agentTemplate: 'services',
  },
  EDUCATION: {
    key: 'EDUCATION',
    titleFa: 'آموزش و دوره',
    titleEn: 'Education & courses',
    descriptionFa: 'راهنمای انتخاب دوره، ثبت‌نام، پاسخ به سؤالات و پیگیری دانشجو',
    descriptionEn: 'Course guidance, enrollment, Q&A and learner follow-up',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: [],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['مشاوره دوره', 'ثبت‌نام', 'پشتیبانی دانشجو'],
    suggestedServicesEn: ['Course advice', 'Enrollment', 'Learner support'],
    agentTemplate: 'education',
  },
  CUSTOM: {
    key: 'CUSTOM',
    titleFa: 'کسب‌وکار دیگر',
    titleEn: 'Another business',
    descriptionFa: 'ماژول‌های موردنیازتان را آزادانه انتخاب و بعداً تغییر دهید',
    descriptionEn: 'Choose the operational modules you need and change them later',
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products', 'appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['پاسخ‌گویی', 'فروش', 'رزرو', 'پیگیری مشتری'],
    suggestedServicesEn: ['Support', 'Sales', 'Booking', 'Customer follow-up'],
    agentTemplate: 'custom',
  },
}

const MODULE_ORDER: readonly DashboardModuleKey[] = [
  'overview',
  'agents',
  'products',
  'appointments',
  'conversations',
  'contacts',
  'analytics',
  'integrations',
  'billing',
  'settings',
]

export function isBusinessType(value: unknown): value is BusinessTypeValue {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value)
}

export function getVerticalPack(value: unknown): VerticalPack {
  return PACKS[isBusinessType(value) ? value : 'CUSTOM']
}

export function getDashboardModules(value: unknown): DashboardModuleKey[] {
  const pack = getVerticalPack(value)
  const enabled = new Set<DashboardModuleKey>([
    ...pack.coreModules,
    ...pack.optionalModules,
  ])
  return MODULE_ORDER.filter((module) => enabled.has(module))
}

/** Backwards-compatible mapping for existing onboarding/template query values. */
export function fromLegacyBusinessKey(value: string | null | undefined): BusinessTypeValue {
  switch (value?.toLowerCase()) {
    case 'instagram':
    case 'store':
    case 'commerce':
      return 'COMMERCE'
    case 'food':
      return 'FOOD'
    case 'appointments':
    case 'booking':
      return 'APPOINTMENTS'
    case 'services':
      return 'SERVICES'
    case 'education':
      return 'EDUCATION'
    default:
      return 'CUSTOM'
  }
}
