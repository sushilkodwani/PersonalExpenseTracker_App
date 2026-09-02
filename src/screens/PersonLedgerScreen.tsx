import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SwipeRow } from '../components/SwipeRow'
import { UndoSnackbar } from '../components/UndoSnackbar'
import { fmt } from '../lib/compute'
import { balanceFor, entriesFor } from '../lib/ledger'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'
import type { LedgerEntry } from '../types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PersonLedgerScreen({ contactId }: { contactId: string }) {
  const { ledger, updateLedger, canEdit } = useApp()
  const [editing, setEditing] = useState<LedgerEntry | 'new' | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingUndo, setPendingUndo] = useState<{ entry: LedgerEntry; index: number } | null>(null)

  if (!ledger) return null
  const contact = ledger.contacts.find((c) => c.id === contactId)
  if (!contact) return <p className="p-6 text-center text-sm muted">This person was removed.</p>

  const entries = entriesFor(ledger, contactId)
  const balance = balanceFor(ledger, contactId)

  function save(entry: LedgerEntry) {
    if (!ledger) return
    const exists = ledger.entries.some((e) => e.id === entry.id)
    updateLedger({
      ...ledger,
      entries: exists ? ledger.entries.map((e) => (e.id === entry.id ? entry : e)) : [...ledger.entries, entry],
    })
    setEditing(null)
  }

  function remove(id: string) {
    if (!ledger) return
    const index = ledger.entries.findIndex((e) => e.id === id)
    const entry = ledger.entries[index]
    updateLedger({ ...ledger, entries: ledger.entries.filter((e) => e.id !== id) })
    if (entry) setPendingUndo({ entry, index })
    setPendingDeleteId(null)
    setEditing(null)
  }

  function undoDelete() {
    if (!ledger || !pendingUndo) return
    const { entry, index } = pendingUndo
    const entries = [...ledger.entries]
    entries.splice(Math.min(index, entries.length), 0, entry)
    updateLedger({ ...ledger, entries })
    setPendingUndo(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="card p-4 text-center">
        <div className="text-xs muted">Balance with {contact.name}</div>
        {balance === 0 ? (
          <div className="text-2xl font-bold muted">Settled up</div>
        ) : balance > 0 ? (
          <div className="text-2xl font-bold text-red-600">{contact.name} owes you {fmt(balance)}</div>
        ) : (
          <div className="text-2xl font-bold text-emerald-600">You owe {contact.name} {fmt(-balance)}</div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="card p-4 text-sm muted">No entries yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <SwipeRow key={e.id} className="card" disabled={!canEdit} onDelete={() => setPendingDeleteId(e.id)}>
              <button
                className="flex w-full items-center justify-between p-4 text-left active:bg-slate-50 dark:active:bg-slate-800 disabled:active:bg-transparent"
                disabled={!canEdit}
                onClick={() => setEditing(e)}
              >
                <div>
                  <div className={`font-medium ${e.type === 'give' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {e.type === 'give' ? 'You owe' : 'They owe you'}
                  </div>
                  <div className="text-xs muted">
                    {e.date}
                    {e.note && ` · ${e.note}`}
                  </div>
                </div>
                <div className={`font-semibold ${e.type === 'give' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(e.amount)}
                </div>
              </button>
            </SwipeRow>
          ))}
        </div>
      )}

      {canEdit && (
        <button className="btn-secondary" onClick={() => setEditing('new')}>
          + Add entry
        </button>
      )}

      {editing && canEdit && (
        <EntryEditor
          initial={editing === 'new' ? null : editing}
          contactId={contactId}
          onSave={save}
          onDelete={editing !== 'new' ? () => setPendingDeleteId(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          message="Delete this entry?"
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {pendingUndo && (
        <UndoSnackbar message="Entry deleted" onUndo={undoDelete} onDismiss={() => setPendingUndo(null)} />
      )}
    </div>
  )
}

function EntryEditor({
  initial,
  contactId,
  onSave,
  onDelete,
  onClose,
}: {
  initial: LedgerEntry | null
  contactId: string
  onSave: (entry: LedgerEntry) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [type, setType] = useState<'give' | 'take'>(initial?.type ?? 'give')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.date ?? today())

  const valid = Number(amount) > 0 && date

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">{initial ? 'Edit entry' : 'New entry'}</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${
                type === 'give' ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-slate-700'
              }`}
              onClick={() => setType('give')}
            >
              I owe them
            </button>
            <button
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${
                type === 'take' ? 'bg-red-600 text-white' : 'border border-slate-300 dark:border-slate-700'
              }`}
              onClick={() => setType('take')}
            >
              They owe me
            </button>
          </div>
          <label className="text-sm font-medium">
            Amount (₹)
            <input
              className="input mt-1"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </label>
          <label className="text-sm font-medium">
            Date
            <input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Note (optional)
            <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dinner split" />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={!valid}
              onClick={() =>
                onSave({
                  id: initial?.id ?? uuid(),
                  contactId,
                  type,
                  amount: Number(amount),
                  note: note.trim() || undefined,
                  date,
                })
              }
            >
              Save
            </button>
            {onDelete && (
              <button className="btn-secondary text-red-500" onClick={onDelete}>
                Delete
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
