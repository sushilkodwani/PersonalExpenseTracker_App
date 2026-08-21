import type { Month, Settings } from '../types'
import { PEOPLE, PERSON_LABELS } from '../types'
import { monthLabel } from './compute'

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function monthsToCsv(monthIds: string[], months: Record<string, Month>, settings: Settings): string {
  const sectionName = (id: string) => settings.sections.find((s) => s.id === id)?.name ?? '(deleted)'
  const categoryName = (id: string) => settings.categories.find((c) => c.id === id)?.name ?? '(deleted)'

  const lines = [
    ['Month', 'Person', 'Section', 'Expense', 'Category', 'Amount', 'Paid', 'Pass-through', 'Carries over']
      .map(csvCell)
      .join(','),
  ]

  for (const id of [...monthIds].sort()) {
    const month = months[id]
    if (!month) continue
    for (const person of PEOPLE) {
      for (const section of month.people[person].sections) {
        for (const item of section.items) {
          lines.push(
            [
              monthLabel(id),
              PERSON_LABELS[person],
              sectionName(section.sectionId),
              item.name,
              categoryName(item.categoryId),
              item.amount,
              item.paid ? 'Yes' : 'No',
              item.isTransfer ? 'Yes' : 'No',
              item.carryToNextMonth ? 'Yes' : 'No',
            ]
              .map(csvCell)
              .join(','),
          )
        }
      }
    }
  }

  return lines.join('\n')
}

/** Everything the app knows, in one file — settings plus every loaded month. */
export function fullBackupJson(settings: Settings, months: Record<string, Month>): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      settings,
      months,
    },
    null,
    2,
  )
}

export interface BackupFile {
  settings: Settings
  months: Record<string, Month>
}

export function parseBackupJson(text: string): BackupFile {
  const parsed = JSON.parse(text) as Partial<BackupFile>
  if (!parsed.settings || !parsed.months) throw new Error('Not a valid backup file — missing settings or months.')
  return { settings: parsed.settings, months: parsed.months }
}
