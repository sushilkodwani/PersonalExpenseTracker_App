import { fmt, monthLabel, personRemaining, personSpend, sectionSpend, sectionTransfers } from '../lib/compute'
import type { Month, Settings } from '../types'
import { PEOPLE, PERSON_LABELS } from '../types'

/**
 * Hidden on screen, visible only to the printer (see the @media print rules in
 * index.css). On iOS this is how a month gets saved as a PDF: Print → share.
 */
export function PrintReport({ month, settings }: { month: Month; settings: Settings }) {
  const sectionName = (id: string) => settings.sections.find((s) => s.id === id)?.name ?? '(deleted)'
  const categoryName = (id: string) => settings.categories.find((c) => c.id === id)?.name ?? '(deleted)'

  return (
    <div className="print-only p-6 text-black">
      <h1 className="text-2xl font-bold">{monthLabel(month.id)} — Expense Report</h1>

      {PEOPLE.map((person) => {
        const pm = month.people[person]
        return (
          <section key={person} className="mt-6 break-inside-avoid">
            <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">{PERSON_LABELS[person]}</h2>
            <p className="mt-1 text-sm">
              Salary {fmt(pm.salary)} · Spent {fmt(personSpend(pm))} · <b>Saved {fmt(personRemaining(pm))}</b>
            </p>

            {pm.sections
              .filter((s) => s.items.length > 0)
              .map((section) => (
                <div key={section.sectionId} className="mt-3">
                  <h3 className="text-sm font-semibold">
                    {sectionName(section.sectionId)} — {fmt(sectionSpend(section))}
                    {sectionTransfers(section) > 0 && ` (+ ${fmt(sectionTransfers(section))} pass-through)`}
                  </h3>
                  <table className="w-full text-xs">
                    <tbody>
                      {section.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-0.5">{item.paid ? '☑' : '☐'}</td>
                          <td className="py-0.5">{item.name}</td>
                          <td className="py-0.5 text-slate-600">{categoryName(item.categoryId)}</td>
                          <td className="py-0.5 text-right">
                            {fmt(item.amount)}
                            {item.isTransfer && ' (T)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}
