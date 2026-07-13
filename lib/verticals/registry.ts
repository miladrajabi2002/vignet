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
  | 'services'
  | 'menu'
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

export interface BusinessServiceOption {
  key: string
  fa: string
  en: string
  descriptionFa: string
  descriptionEn: string
  modules: readonly DashboardModuleKey[]
  recommendedFor: readonly BusinessTypeValue[]
}

export const BUSINESS_SERVICE_OPTIONS: readonly BusinessServiceOption[] = [
  { key: 'instagram', fa: 'مدیریت و فروش در اینستاگرام', en: 'Instagram sales & management', descriptionFa: 'پاسخ دایرکت، مدیریت کامنت، فروش در دایرکت و اتوماسیون رایگان', descriptionEn: 'DM replies, comment management, in-DM sales and free automations', modules: ['instagram'], recommendedFor: ['SOCIAL', 'COMMERCE', 'FOOD', 'SERVICES', 'EDUCATION'] },
  { key: 'products', fa: 'فروش و مدیریت محصولات', en: 'Product sales & management', descriptionFa: 'کاتالوگ، قیمت، موجودی و پیشنهاد محصول در پاسخ ایجنت', descriptionEn: 'Catalog, pricing, stock and product recommendations', modules: ['products'], recommendedFor: ['COMMERCE', 'SOCIAL', 'FOOD'] },
  { key: 'bookings', fa: 'رزرو و نوبت‌دهی', en: 'Bookings & appointments', descriptionFa: 'تقویم، ظرفیت، زمان آزاد و ثبت نوبت بدون تداخل', descriptionEn: 'Calendar, capacity, availability and conflict-free booking', modules: ['appointments', 'services'], recommendedFor: ['APPOINTMENTS', 'FOOD', 'SERVICES', 'EDUCATION'] },
  { key: 'services', fa: 'معرفی و مدیریت خدمات', en: 'Service catalog & management', descriptionFa: 'ثبت خدمات، مدت، محل ارائه و استفاده مستقیم توسط ایجنت', descriptionEn: 'Service catalog, duration, location and direct agent usage', modules: ['services'], recommendedFor: ['SERVICES', 'APPOINTMENTS', 'EDUCATION', 'SUPPORT'] },
  { key: 'digital-menu', fa: 'منوی دیجیتال و سفارش‌گیری', en: 'Digital menu & ordering', descriptionFa: 'لینک عمومی، QR Code و منوی حرفه‌ای متصل به کاتالوگ', descriptionEn: 'Public link, QR code and a catalog-connected menu', modules: ['menu', 'products'], recommendedFor: ['FOOD'] },
  { key: 'courses', fa: 'دوره، مشاوره و ثبت‌نام', en: 'Courses, consulting & enrollment', descriptionFa: 'معرفی دوره و جلسه، دریافت درخواست و هماهنگی ثبت‌نام', descriptionEn: 'Courses and sessions, lead capture and enrollment', modules: ['services', 'appointments'], recommendedFor: ['EDUCATION', 'SERVICES'] },
  { key: 'support', fa: 'پشتیبانی و پیگیری مشتری', en: 'Customer support & follow-up', descriptionFa: 'پاسخ دانش‌محور، ثبت درخواست و تحویل موارد حساس به اپراتور', descriptionEn: 'Knowledge-grounded support, requests and safe handoff', modules: [], recommendedFor: ['SUPPORT', 'COMMERCE', 'SERVICES'] },
] as const

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
    optionalModules: ['products', 'menu'],
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
    optionalModules: ['appointments', 'services'],
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
    optionalModules: ['services'],
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
    optionalModules: ['services'],
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
    optionalModules: [],
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
  'services',
  'menu',
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

const PRODUCT_INTENT = /(محصول|فروش|کالا|منو|سفارش|product|store|shop|catalog|menu|order|commerce)/i
const BOOKING_INTENT = /(رزرو|نوبت|وقت|قرار|جلسه|ملاقات|booking|appointment|reservation|schedule|meeting)/i
const SERVICE_INTENT = /(خدمت|خدمات|مشاوره|دوره|ویزیت|بازدید|درخواست|service|consult|course|visit)/i
const MENU_INTENT = /(منو|غذا|کافه|رستوران|menu|food|restaurant|cafe)/i
const INSTAGRAM_INTENT = /(اینستاگرام|دایرکت|کامنت|instagram|direct|\bdm\b|comment)/i

/**
 * Resolve visible modules from the vertical plus every additive capability the
 * owner selected. Capabilities never replace each other: a business can sell
 * products, offer services, accept bookings and use Instagram at the same time.
 */
export function getDashboardModules(
  value: unknown,
  services: readonly string[] = [],
): DashboardModuleKey[] {
  const pack = getVerticalPack(value)
  const enabled = new Set<DashboardModuleKey>([
    ...pack.coreModules,
    ...pack.optionalModules,
  ])

  const serviceText = services.join(' ')
  if (PRODUCT_INTENT.test(serviceText)) enabled.add('products')
  if (BOOKING_INTENT.test(serviceText)) { enabled.add('appointments'); enabled.add('services') }
  if (SERVICE_INTENT.test(serviceText)) enabled.add('services')
  if (MENU_INTENT.test(serviceText)) { enabled.add('menu'); enabled.add('products') }
  if (INSTAGRAM_INTENT.test(serviceText)) enabled.add('instagram')
  return MODULE_ORDER.filter((module) => enabled.has(module))
}

/** All useful cross-business capabilities, with the relevant ones shown first. */
export function getBusinessServiceOptions(value: unknown): BusinessServiceOption[] {
  const type = getVerticalPack(value).key
  const priority: Record<BusinessTypeValue, readonly string[]> = {
    COMMERCE: ['products', 'instagram', 'support', 'bookings', 'services'],
    FOOD: ['digital-menu', 'products', 'bookings', 'instagram', 'services'],
    APPOINTMENTS: ['bookings', 'services', 'instagram', 'support'],
    SERVICES: ['services', 'bookings', 'instagram', 'courses', 'support'],
    EDUCATION: ['courses', 'services', 'bookings', 'instagram', 'support'],
    SUPPORT: ['support', 'services', 'instagram', 'bookings'],
    SOCIAL: ['instagram', 'products', 'support', 'services'],
    CUSTOM: ['services', 'products', 'bookings', 'instagram', 'digital-menu', 'courses', 'support'],
  }
  const order = priority[type]
  return [...BUSINESS_SERVICE_OPTIONS].sort((a, b) => {
    const ai = order.indexOf(a.key)
    const bi = order.indexOf(b.key)
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
  })
}

export function getDashboardModuleLabel(
  module: DashboardModuleKey,
  businessType: unknown,
  locale: string,
  fallback: string,
): string {
  const fa = locale !== 'en'
  if (module === 'services') {
    if (businessType === 'EDUCATION') return fa ? 'دوره‌ها و خدمات' : 'Courses & services'
    return fa ? 'خدمات' : 'Services'
  }
  if (module === 'menu') return fa ? 'منوی دیجیتال' : 'Digital menu'
  if (module === 'appointments') {
    if (businessType === 'FOOD') return fa ? 'رزرو میز' : 'Table bookings'
    if (businessType === 'SERVICES') return fa ? 'درخواست‌ها و زمان‌بندی' : 'Requests & schedule'
    if (businessType === 'EDUCATION') return fa ? 'جلسات و مشاوره' : 'Sessions & consulting'
  }
  return fallback
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
