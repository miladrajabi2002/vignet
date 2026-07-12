export const BUSINESS_TYPES = [
  'COMMERCE',
  'FOOD',
  'APPOINTMENTS',
  'SERVICES',
  'EDUCATION',
  'SUPPORT',
  'SOCIAL',
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
  | 'instagram'
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
  /** Short feature highlights shown on the selection card (3-4 items). */
  featuresFa: readonly string[]
  featuresEn: readonly string[]
  /** Modules every Vigent workspace receives, regardless of vertical. */
  coreModules: readonly DashboardModuleKey[]
  /** Operational modules highlighted for this vertical. */
  optionalModules: readonly DashboardModuleKey[]
  capabilities: readonly CapabilityPackKey[]
  suggestedServicesFa: readonly string[]
  suggestedServicesEn: readonly string[]
  /** Existing agent-builder preset used after onboarding. */
  agentTemplate: 'commerce' | 'food' | 'appointments' | 'services' | 'education' | 'support' | 'instagram' | 'custom'
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
    titleFa: 'فروشگاه و محصول',
    titleEn: 'Commerce & product',
    descriptionFa: 'کاتالوگ، راهنمای خرید، پیگیری سفارش و فروش در همه کانال‌ها',
    descriptionEn: 'Catalog, buying guide, order tracking and sales across all channels',
    featuresFa: ['کاتالوگ و موجودی زنده', 'مشاوره و مقایسه محصول', 'پیگیری سفارش', 'فروش در همه کانال‌ها'],
    featuresEn: ['Live catalog & stock', 'Product advice & comparison', 'Order tracking', 'Omnichannel sales'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['فروش محصول', 'مشاوره خرید', 'پیگیری سفارش'],
    suggestedServicesEn: ['Product sales', 'Buying advice', 'Order tracking'],
    agentTemplate: 'commerce',
  },
  FOOD: {
    key: 'FOOD',
    titleFa: 'رستوران، کافه و سفارش غذا',
    titleEn: 'Food & hospitality',
    descriptionFa: 'منو، پیشنهاد هوشمند، ثبت سفارش و پاسخ‌گویی سریع به مشتری',
    descriptionEn: 'Menu, smart recommendations, order capture and fast customer service',
    featuresFa: ['منو دیجیتال', 'ثبت سفارش بیرون‌بر', 'رزرو میز', 'پشتیبانی سریع سفارش'],
    featuresEn: ['Digital menu', 'Takeaway ordering', 'Table booking', 'Fast order support'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products', 'appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['سفارش بیرون‌بر', 'رزرو میز', 'پشتیبانی سفارش'],
    suggestedServicesEn: ['Takeaway orders', 'Table booking', 'Order support'],
    agentTemplate: 'food',
  },
  APPOINTMENTS: {
    key: 'APPOINTMENTS',
    titleFa: 'رزرو و نوبت‌دهی',
    titleEn: 'Booking & appointments',
    descriptionFa: 'تقویم، ظرفیت، زمان‌های آزاد و رزرو بدون تداخل برای هر خدمت',
    descriptionEn: 'Calendar, capacity, free slots and conflict-free booking per service',
    featuresFa: ['تقویم و ظرفیت زنده', 'رزرو بدون تداخل', 'یادآوری خودکار', 'مدیریت لغو و تغییر'],
    featuresEn: ['Live calendar & capacity', 'Conflict-free booking', 'Auto reminders', 'Cancel & reschedule'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['appointments'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['مشاوره', 'ویزیت', 'خدمات زیبایی', 'رزرو جلسه'],
    suggestedServicesEn: ['Consultation', 'Visit', 'Beauty service', 'Meeting'],
    agentTemplate: 'appointments',
  },
  SERVICES: {
    key: 'SERVICES',
    titleFa: 'خدمات حرفه‌ای',
    titleEn: 'Professional services',
    descriptionFa: 'جمع‌آوری نیاز، ثبت درخواست، پیگیری مشتری و هماهنگی انجام کار',
    descriptionEn: 'Qualify requests, capture leads and coordinate service delivery',
    featuresFa: ['جمع‌آوری نیاز و سرنخ', 'ثبت درخواست', 'پیگیری مشتری', 'هماهنگی انجام کار'],
    featuresEn: ['Lead & need capture', 'Request logging', 'Customer follow-up', 'Work coordination'],
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
    featuresFa: ['راهنمای انتخاب دوره', 'ثبت‌نام آنلاین', 'پاسخ به سؤالات', 'پیگیری دانشجو'],
    featuresEn: ['Course selection guide', 'Online enrollment', 'Q&A support', 'Learner follow-up'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: [],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['مشاوره دوره', 'ثبت‌نام', 'پشتیبانی دانشجو'],
    suggestedServicesEn: ['Course advice', 'Enrollment', 'Learner support'],
    agentTemplate: 'education',
  },
  SUPPORT: {
    key: 'SUPPORT',
    titleFa: 'پشتیبانی مشتری',
    titleEn: 'Customer support',
    descriptionFa: 'تیکت، اولویت‌بندی، SLA و پاسخ‌گویی دانش‌محور به مشتری',
    descriptionEn: 'Tickets, priority, SLA and knowledge-driven customer support',
    featuresFa: ['مدیریت تیکت', 'اولویت‌بندی و SLA', 'پاسخ دانش‌محور', 'گزارش عملکرد'],
    featuresEn: ['Ticket management', 'Priority & SLA', 'Knowledge-driven replies', 'Performance reports'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: [],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['پشتیبانی فنی', 'پاسخ به سؤال', 'پیگیری تیکت'],
    suggestedServicesEn: ['Technical support', 'Q&A', 'Ticket follow-up'],
    agentTemplate: 'support',
  },
  SOCIAL: {
    key: 'SOCIAL',
    titleFa: 'فروش و اتوماسیون اینستاگرام',
    titleEn: 'Instagram sales & automation',
    descriptionFa: 'مدیریت دایرکت، کامنت، اتوماسیون و فروش در اینستاگرام',
    descriptionEn: 'DM, comment, automation management and sales on Instagram',
    featuresFa: ['پاسخ خودکار دایرکت', 'مدیریت کامنت', 'اتوماسیون فروش', 'کاتالوگ در دایرکت'],
    featuresEn: ['Auto DM replies', 'Comment management', 'Sales automation', 'In-DM catalog'],
    coreModules: CORE_DASHBOARD_MODULES,
    optionalModules: ['products', 'instagram'],
    capabilities: CORE_CAPABILITY_PACKS,
    suggestedServicesFa: ['پاسخ دایرکت', 'فروش در دایرکت', 'مدیریت کامنت'],
    suggestedServicesEn: ['DM replies', 'In-DM sales', 'Comment management'],
    agentTemplate: 'instagram',
  },
  CUSTOM: {
    key: 'CUSTOM',
    titleFa: 'کسب‌وکار دیگر',
    titleEn: 'Another business',
    descriptionFa: 'ماژول‌های موردنیازتان را آزادانه انتخاب و بعداً تغییر دهید',
    descriptionEn: 'Choose the operational modules you need and change them later',
    featuresFa: ['انتخاب آزاد ماژول‌ها', 'پاسخ‌گویی هوشمند', 'قابل تغییر بعداً'],
    featuresEn: ['Free module selection', 'Smart replies', 'Changeable later'],
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
  'instagram',
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
      return 'SOCIAL'
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
    case 'support':
      return 'SUPPORT'
    default:
      return 'CUSTOM'
  }
}
