import { describe, expect, it } from 'vitest'
import {
  getDashboardModules,
  getDashboardNavigationModules,
  getDefaultCapabilities,
  legacyCapabilities,
} from '@/lib/verticals/registry'
import { normalizeBusinessProfile, readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import { buildCapabilityReadiness, type ReadinessFacts } from '@/lib/verticals/readiness'

describe('capabilities stored as keys', () => {
  it('each key enables exactly the sections it declares, whatever the business type', () => {
    expect(getDashboardModules(['services'])).toContain('services')
    expect(getDashboardModules(['services'])).not.toContain('products')
    expect(getDashboardModules(['bookings'])).toEqual(expect.arrayContaining(['appointments', 'services']))
    expect(getDashboardModules(['digital-menu'])).toEqual(expect.arrayContaining(['menu', 'products']))
    expect(getDashboardModules(['courses'])).toContain('courses')
    expect(getDashboardModules(['support'])).not.toContain('products')
  })

  it('services link folds into bookings in the menu', () => {
    const nav = getDashboardNavigationModules(['services', 'bookings'])
    expect(nav).toContain('appointments')
    expect(nav).not.toContain('services')
  })

  it('a stored profile reads its keys, not the labels next to them', () => {
    const stored = normalizeBusinessProfile({ businessName: 'کافه رز', capabilities: ['services'], extras: [], locale: 'en' })
    // The English label ("Service catalog…") must not switch products on.
    expect(stored.services).toEqual(['Service catalog & management'])
    const profile = readBusinessProfile(stored, 'FOOD')!
    expect(profile.capabilities).toEqual(['services'])
    // FOOD no longer forces the digital menu once keys are stored.
    expect(getDashboardModules(profile.capabilities)).not.toContain('menu')
  })

  it('the business type only pre-fills defaults', () => {
    expect(getDefaultCapabilities('FOOD')).toEqual(['digital-menu'])
    expect(getDefaultCapabilities('APPOINTMENTS')).toEqual(['bookings'])
    expect(getDefaultCapabilities('CUSTOM')).toEqual([])
  })
})

describe('profiles saved before keys existed keep their menu', () => {
  it('reproduces the sections the type used to force', () => {
    expect(getDashboardModules(legacyCapabilities('FOOD', ['پشتیبانی و پیگیری مشتری']))).toEqual(expect.arrayContaining(['menu', 'products']))
    expect(getDashboardModules(legacyCapabilities('SOCIAL', ['پاسخ دایرکت']))).toEqual(expect.arrayContaining(['instagram', 'products']))
    expect(getDashboardModules(legacyCapabilities('EDUCATION', ['پشتیبانی و پیگیری مشتری']))).toContain('services')
  })

  it('maps labels (fa, en and earlier wording) and old free text', () => {
    expect(legacyCapabilities('SERVICES', ['معرفی و مدیریت خدمات', 'رزرو و نوبت‌دهی'])).toEqual(expect.arrayContaining(['services', 'bookings']))
    expect(legacyCapabilities('COMMERCE', ['Bookings & appointments'])).toContain('bookings')
    // The old courses option opened the bookings workspace; it still does.
    expect(getDashboardModules(legacyCapabilities('SUPPORT', ['دوره، مشاوره و ثبت‌نام']))).toEqual(expect.arrayContaining(['services', 'appointments', 'courses']))
    expect(legacyCapabilities('CUSTOM', ['نوبت‌دهی آنلاین'])).toContain('bookings')
  })

  it('a workspace without a saved profile keeps what its type showed', () => {
    expect(workspaceCapabilities({ businessType: 'COMMERCE', businessProfile: null })).toEqual(['products'])
    expect(workspaceCapabilities({ businessType: 'CUSTOM', businessProfile: null })).toEqual([])
  })

  it('reads an unkeyed profile through the legacy mapping', () => {
    const profile = readBusinessProfile({ businessName: 'سالن', services: ['رزرو و نوبت‌دهی', 'کاشت ناخن'] }, 'APPOINTMENTS')!
    expect(profile.capabilities).toEqual(['bookings'])
    expect(profile.extras).toEqual(['کاشت ناخن'])
  })
})

describe('capability readiness', () => {
  const none: ReadinessFacts = {
    activeProducts: 0, storeConnected: false, activeServices: 0, bookableServices: 0, chatLinkLive: false,
    instagramConnected: false, publishedCourses: 0, scheduledCourses: 0, knowledgeSources: 0, handoffAgents: 0, primaryAgentId: 'a1',
  }

  it('is off, setting up or ready from real data', () => {
    const map = buildCapabilityReadiness(['bookings'], { ...none, activeServices: 1 })
    expect(map.products.state).toBe('off')
    expect(map.bookings.state).toBe('setup')
    expect(map.bookings.next?.key).toBe('hours')
    expect(buildCapabilityReadiness(['bookings'], { ...none, activeServices: 1, bookableServices: 1 }).bookings.state).toBe('ready')
  })

  it('a connected store counts as a catalog', () => {
    expect(buildCapabilityReadiness(['products'], { ...none, storeConnected: true }).products.state).toBe('ready')
  })
})
