import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PromptDialog } from '../components/PromptDialog'
import { SwipeRow } from '../components/SwipeRow'
import { fmt } from '../lib/compute'
import { balanceFor, totalOwedToYou, totalYouOwe } from '../lib/ledger'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'

export function PeopleScreen({ onSelect }: { onSelect: (contactId: string) => void }) {
  const { ledger, updateLedger, canEdit } = useApp()
  const [addingContact, setAddingContact] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  if (!ledger) return null

  function addContact(name: string) {
    if (!ledger) return
    const trimmed = name.trim()
    if (!trimmed) return
    updateLedger({ ...ledger, contacts: [...ledger.contacts, { id: uuid(), name: trimmed }] })
    setAddingContact(false)
  }

  function removeContact(id: string) {
    if (!ledger) return
    updateLedger({
      ...ledger,
      contacts: ledger.contacts.filter((c) => c.id !== id),
      entries: ledger.entries.filter((e) => e.contactId !== id),
    })
    setPendingDelete(null)
  }

  const owedToYou = totalOwedToYou(ledger)
  const youOwe = totalYouOwe(ledger)
  const contactName = ledger.contacts.find((c) => c.id === pendingDelete)?.name

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="text-xs muted">Owed to you</div>
          <div className="text-xl font-bold text-red-600">{fmt(owedToYou)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs muted">You owe</div>
          <div className="text-xl font-bold text-emerald-600">{fmt(youOwe)}</div>
        </div>
      </div>

      {ledger.contacts.length === 0 ? (
        <p className="card p-4 text-sm muted">
          No people yet. Add someone to start tracking what you owe them or they owe you.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ledger.contacts.map((c) => {
            const balance = balanceFor(ledger, c.id)
            return (
              <SwipeRow key={c.id} className="card" disabled={!canEdit} onDelete={() => setPendingDelete(c.id)}>
                <button
                  className="flex w-full items-center justify-between p-4 text-left active:bg-slate-50 dark:active:bg-slate-800"
                  onClick={() => onSelect(c.id)}
                >
                  <span className="font-medium">{c.name}</span>
                  {balance === 0 ? (
                    <span className="text-sm muted">Settled</span>
                  ) : balance > 0 ? (
                    <span className="font-semibold text-red-600">{fmt(balance)}</span>
                  ) : (
                    <span className="font-semibold text-emerald-600">{fmt(-balance)}</span>
                  )}
                </button>
              </SwipeRow>
            )
          })}
        </div>
      )}

      {canEdit && (
        <button className="btn-secondary" onClick={() => setAddingContact(true)}>
          + Add person
        </button>
      )}

      {addingContact && (
        <PromptDialog
          title="Add person"
          placeholder="Name"
          confirmLabel="Add"
          onSubmit={addContact}
          onCancel={() => setAddingContact(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${contactName}?`}
          message="Every entry recorded for this person is deleted too."
          confirmLabel="Remove"
          danger
          onConfirm={() => removeContact(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
