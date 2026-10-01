import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.[jt]sx$/.test(entry.name) ? [path] : []
  })
}

describe('localized date picker UI contract', () => {
  it('keeps Solar Hijri and Gregorian calendars in the same responsive sheet', () => {
    const picker = read('components/ui/localized-date-picker.tsx')
    // Picker styles ship with the picker, not in the site-wide stylesheet.
    const styles = read('components/ui/localized-date-picker.css')

    expect(picker).toContain('<MobileBottomSheet')
    expect(picker).toContain('mobileOnly={false}')
    expect(picker).toContain('<div className="vigent-calendar-stage">')
    expect(picker).toContain('<DoranCalendar')
    expect(picker).toContain('<GregorianDayPicker')
    expect(picker).toContain("import './localized-date-picker.css'")
    expect(read('app/globals.css')).not.toContain('.vigent-calendar-stage')
    expect(styles).toContain('.vigent-calendar-stage')
    expect(styles).toContain('.vigent-date-calendar .rdp-week')
    expect(styles).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))')
    expect(styles).toContain('aspect-ratio: 1')
    expect(styles).toContain('max-width: none')
  })

  it('uses the shared picker on every editable date surface', () => {
    // Booking date surfaces: the new/move dialog and the service closures.
    const bookingDialog = read('components/bookings/booking-dialog.tsx')
    const serviceEditor = read('components/bookings/service-editor.tsx')
    const improvements = read('components/agents/improvement-center.tsx')

    expect(bookingDialog.match(/<LocalizedDatePicker/g)).toHaveLength(1)
    expect(serviceEditor.match(/<LocalizedDatePicker/g)).toHaveLength(1)
    expect(improvements.match(/<LocalizedDatePicker/g)).toHaveLength(1)

    const nativeDateInput = /type\s*=\s*["'](?:date|datetime-local|month|week)["']/
    const offenders = [...sourceFiles('app'), ...sourceFiles('components')]
      .filter((path) => nativeDateInput.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
