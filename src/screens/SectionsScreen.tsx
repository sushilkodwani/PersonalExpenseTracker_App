import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'
import type { SectionDef, SectionOwner, SectionType } from '../types'
import { PERSON_LABELS, SECTION_TYPE_LABELS } from '../types'

const OWNER_OPTIONS: { value: SectionOwner; label: string }[] = [
  { value: 'sush', label: PERSON_LABELS.sush },
  { value: 'khush', label: PERSON_LABELS.khush },
  { value: 'shared', label: 'Shared' },
]

const TYPE_OPTIONS = (Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((t) => ({
  value: t,
  label: SECTION_TYPE_LABELS[t],
}))

export function SectionsScreen() {
  const { settings, updateSettings } = useApp()
  const [editing, setEditing] = useState<SectionDef | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  if (!settings) return null

  function save(def: SectionDef) {
    if (!settings) return
    const exists = settings.sections.some((s) => s.id === def.id)
    updateSettings({
      ...settings,
      sections: exists ? settings.sections.map((s) => (s.id === def.id ? def : s)) : [...settings.sections, def],
    })
    setEditing(null)
  }

  function remove(id: string) {
    if (!settings) return
    updateSettings({ ...settings, sections: settings.sections.filter((s) => s.id !== id) })
    setPendingDelete(null)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <p className="text-sm muted">
        The master list. New months are pre-filled with sections marked “in template”; others can be added to a month
        on the fly.
      </p>

      <div className="card divide-y divider">
        {settings.sections.length === 0 ? (
          <p className="p-4 text-sm muted">No sections yet.</p>
        ) : (
          settings.sections.map((s) => (
            <button
              key={s.id}
              className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
              onClick={() => setEditing(s)}
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs muted">
                  {OWNER_OPTIONS.find((o) => o.value === s.owner)?.label} · {SECTION_TYPE_LABELS[s.type]}
                  {s.defaultInTemplate && ' · in template'}
                </div>
              </div>
              <span className="text-slate-300">›</span>
            </button>
          ))
        )}
      </div>

      <button className="btn-secondary" onClick={() => setEditing('new')}>
        + Add section
      </button>

      {editing && (
        <SectionEditor
          initial={editing === 'new' ? null : editing}
          onSave={save}
          onDelete={editing !== 'new' ? () => setPendingDelete(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          message="Delete this section? Existing months that use it will show it as “(deleted)”."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

function SectionEditor({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: SectionDef | null
  onSave: (def: SectionDef) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [owner, setOwner] = useState<SectionOwner>(initial?.owner ?? 'sush')
  const [type, setType] = useState<SectionType>(initial?.type ?? 'credit_card')
  const [inTemplate, setInTemplate] = useState(initial?.defaultInTemplate ?? true)

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">{initial ? 'Edit section' : 'New section'}</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Name
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SBI CC" />
          </label>
          <label className="text-sm font-medium">
            Owner
            <select className="input mt-1" value={owner} onChange={(e) => setOwner(e.target.value as SectionOwner)}>
              {OWNER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Type
            <select className="input mt-1" value={type} onChange={(e) => setType(e.target.value as SectionType)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" checked={inTemplate} onChange={(e) => setInTemplate(e.target.checked)} />
            Include in every new month automatically
          </label>
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={!name.trim()}
              onClick={() =>
                onSave({
                  id: initial?.id ?? uuid(),
                  name: name.trim(),
                  owner,
                  type,
                  defaultInTemplate: inTemplate,
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
