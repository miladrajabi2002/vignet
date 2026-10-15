/**
 * Iranian (Shetab) card numbers — the pure half: issuer prefixes, the check
 * digit and display helpers. Safe to import from client components.
 *
 * Logos are the CC0 «LogoS» set (github.com/zegond/logos-per-banks), served
 * from /brands/banks/<key>.svg (colour) and <key>-mono.svg (white, for the
 * face of a card).
 */
import { toEnglishDigits } from '@/lib/phone'

export interface Bank {
  key: string
  fa: string
  en: string
  /** 6-digit prefixes; `prefixes8` wins when one matches (neobank ranges). */
  bins: string[]
  prefixes8?: string[]
  /** Card face: [deep, light] of the bank's own colour. */
  colors: [string, string]
  /** False when the logo set has no mark for this issuer. */
  logo: boolean
}

export const BANKS: Bank[] = [
  { key: 'melli', fa: 'بانک ملی ایران', en: 'Bank Melli Iran', bins: ['603799'], colors: ['#0d2f6b', '#1d55a8'], logo: true },
  { key: 'mellat', fa: 'بانک ملت', en: 'Bank Mellat', bins: ['610433', '991975'], colors: ['#a10f26', '#d12236'], logo: true },
  { key: 'saderat', fa: 'بانک صادرات ایران', en: 'Bank Saderat Iran', bins: ['603769'], colors: ['#1e1158', '#3a2a9a'], logo: true },
  { key: 'tejarat', fa: 'بانک تجارت', en: 'Tejarat Bank', bins: ['627353', '585983'], colors: ['#1f0d8a', '#3f3ad1'], logo: true },
  { key: 'sepah', fa: 'بانک سپه', en: 'Bank Sepah', bins: ['589210', '627381', '639370', '639599', '636949', '505801'], colors: ['#005f94', '#0093dd'], logo: true },
  { key: 'blu', fa: 'بلوبانک', en: 'Blu Bank', bins: [], prefixes8: ['62198610', '62198618', '62198619'], colors: ['#1d74c2', '#3094ea'], logo: false },
  { key: 'saman', fa: 'بانک سامان', en: 'Saman Bank', bins: ['621986'], colors: ['#007fae', '#00aae8'], logo: true },
  { key: 'pasargad', fa: 'بانک پاسارگاد', en: 'Bank Pasargad', bins: ['502229', '639347'], colors: ['#1b1b1b', '#3d3524'], logo: true },
  { key: 'parsian', fa: 'بانک پارسیان', en: 'Parsian Bank', bins: ['622106', '639194', '627884'], colors: ['#7a0b14', '#a10f1f'], logo: true },
  { key: 'keshavarzi', fa: 'بانک کشاورزی', en: 'Keshavarzi Bank', bins: ['603770', '639217'], colors: ['#0e2307', '#2b5c1a'], logo: true },
  { key: 'maskan', fa: 'بانک مسکن', en: 'Bank Maskan', bins: ['628023'], colors: ['#b3140f', '#e8372b'], logo: true },
  { key: 'refah', fa: 'بانک رفاه کارگران', en: 'Refah Bank', bins: ['589463'], colors: ['#155a00', '#2f8a12'], logo: true },
  { key: 'ayandeh', fa: 'بانک آینده (ادغام در ملی)', en: 'Ayandeh Bank (now Melli)', bins: ['636214'], colors: ['#4a2f17', '#8a5a2b'], logo: true },
  { key: 'shahr', fa: 'بانک شهر', en: 'Shahr Bank', bins: ['502806', '504706'], colors: ['#a80a0a', '#dd1c1c'], logo: true },
  { key: 'en', fa: 'بانک اقتصاد نوین', en: 'EN Bank', bins: ['627412'], colors: ['#471c6f', '#6a3aa3'], logo: true },
  { key: 'resalat', fa: 'بانک قرض‌الحسنه رسالت', en: 'Resalat Bank', bins: ['504172'], colors: ['#006b99', '#0092cf'], logo: true },
  { key: 'mehriran', fa: 'بانک قرض‌الحسنه مهر ایران', en: 'Mehr Iran Bank', bins: ['606373'], colors: ['#007a3d', '#00a653'], logo: true },
  { key: 'sina', fa: 'بانک سینا', en: 'Sina Bank', bins: ['639346'], colors: ['#0f2e7c', '#2456b8'], logo: true },
  { key: 'dey', fa: 'بانک دی', en: 'Day Bank', bins: ['502938'], colors: ['#006b7a', '#008a9f'], logo: true },
  { key: 'postbank', fa: 'پست بانک ایران', en: 'Post Bank of Iran', bins: ['627760'], colors: ['#006b2e', '#008840'], logo: true },
  { key: 'karafarin', fa: 'بانک کارآفرین', en: 'Karafarin Bank', bins: ['627488', '502910'], colors: ['#106c5b', '#168474'], logo: true },
  { key: 'taavon', fa: 'بانک توسعه تعاون', en: 'Tose’e Ta’avon Bank', bins: ['502908'], colors: ['#086673', '#0b8a93'], logo: true },
  { key: 'khavarmianeh', fa: 'بانک خاورمیانه', en: 'Middle East Bank', bins: ['585947'], colors: ['#b8660a', '#f7941e'], logo: true },
  { key: 'gardeshgari', fa: 'بانک گردشگری', en: 'Tourism Bank', bins: ['505416'], colors: ['#7f0707', '#af0a0f'], logo: true },
  { key: 'iranzamin', fa: 'بانک ایران زمین', en: 'Iran Zamin Bank', bins: ['505785'], colors: ['#3c0079', '#5a1fb8'], logo: true },
  { key: 'sarmayeh', fa: 'بانک سرمایه', en: 'Sarmayeh Bank', bins: ['639607'], colors: ['#4d5560', '#7a8490'], logo: true },
  { key: 'sanatmadan', fa: 'بانک صنعت و معدن', en: 'Bank of Industry & Mine', bins: ['627961'], colors: ['#0a1f5d', '#0f317e'], logo: true },
  { key: 'edbi', fa: 'بانک توسعه صادرات', en: 'Export Development Bank', bins: ['627648', '207177'], colors: ['#005b12', '#0a7d22'], logo: true },
  { key: 'melal', fa: 'مؤسسه اعتباری ملل', en: 'Melal Credit Institution', bins: ['606256'], colors: ['#2a2b7a', '#37389a'], logo: true },
  { key: 'noor', fa: 'مؤسسه اعتباری نور', en: 'Noor Credit Institution', bins: ['507677'], colors: ['#0b7f88', '#11b8c7'], logo: true },
  { key: 'tosee', fa: 'مؤسسه اعتباری توسعه', en: 'Tose’e Credit Institution', bins: ['628157'], colors: ['#7a1a14', '#b3261c'], logo: true },
  { key: 'caspian', fa: 'مؤسسه اعتباری کاسپین', en: 'Caspian Credit Institution', bins: ['505809'], colors: ['#0c3f73', '#1763ad'], logo: true },
  { key: 'venezuela', fa: 'بانک ایران ونزوئلا', en: 'Iran-Venezuela Bank', bins: ['581874'], colors: ['#24276f', '#3437a1'], logo: true },
  { key: 'markazi', fa: 'بانک مرکزی', en: 'Central Bank of Iran', bins: ['636795'], colors: ['#1c2b3a', '#34506b'], logo: true },
]

export const UNKNOWN_BANK: Bank = { key: 'unknown', fa: 'بانک', en: 'Bank', bins: [], colors: ['#2b2b30', '#4a4a52'], logo: false }

const BY_BIN = new Map<string, Bank>()
const BY_PREFIX8 = new Map<string, Bank>()
const BY_KEY = new Map<string, Bank>()
for (const bank of BANKS) {
  BY_KEY.set(bank.key, bank)
  for (const bin of bank.bins) BY_BIN.set(bin, bank)
  for (const prefix of bank.prefixes8 ?? []) BY_PREFIX8.set(prefix, bank)
}

export function panDigits(value: string | null | undefined): string {
  return toEnglishDigits(String(value ?? '')).replace(/\D/g, '')
}

export function luhnValid(pan: string): boolean {
  const digits = panDigits(pan)
  if (digits.length !== 16) return false
  let sum = 0
  for (let i = 0; i < 16; i++) {
    let n = Number(digits[15 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

export function detectBank(pan: string): Bank | null {
  const digits = panDigits(pan)
  if (digits.length < 6) return null
  return (digits.length >= 8 ? BY_PREFIX8.get(digits.slice(0, 8)) : undefined) ?? BY_BIN.get(digits.slice(0, 6)) ?? null
}

export function bankByKey(key: string | null | undefined): Bank {
  return (key ? BY_KEY.get(key) : undefined) ?? UNKNOWN_BANK
}

export type CardInputState = 'empty' | 'typing' | 'invalid' | 'unknown-bank' | 'ok'

/** One answer for the add-card form while the owner types. */
export function inspectCard(pan: string): { digits: string; bank: Bank | null; state: CardInputState } {
  const digits = panDigits(pan)
  const bank = detectBank(digits)
  let state: CardInputState = 'typing'
  if (!digits.length) state = 'empty'
  else if (digits.length === 16) state = !luhnValid(digits) ? 'invalid' : bank ? 'ok' : 'unknown-bank'
  else if (digits.length > 16) state = 'invalid'
  return { digits, bank, state }
}

/** «6037 9975 1234 5678» */
export function formatPan(pan: string): string {
  return panDigits(pan).replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** «603799******5678» for lists and logs. */
export function maskPan(bin: string, last4: string): string {
  return `${bin}******${last4}`
}

export function bankLogoUrl(bank: Pick<Bank, 'key' | 'logo'>, variant: 'color' | 'mono' = 'color'): string | null {
  return bank.logo ? `/brands/banks/${bank.key}${variant === 'mono' ? '-mono' : ''}.svg` : null
}
