import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PromptDialog } from '../components/PromptDialog'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'
import type { Category } from '../types'

export function CategoriesScreen() {
  const { settings, updateSettings } = useApp()
  const [newCategory, setNewCategory] = useState('')
  const [renaming, setRenaming] = useState<Category | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  if (!settings) return null

  function add() {
    if (!settings) return
    const name = newCategory.trim()
    if (!name) return
    if (settings.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNewCategory('')
      return
    }
    updateSettings({ ...settings, categories: [...settings.categories, { id: uuid(), name }] })
    setNewCategory('')
  }

  function rename(name: string) {
    if (!settings || !renaming) return
    const trimmed = name.trim()
    if (!trimmed) return
    updateSettings({
      ...settings,
      categories: settings.categories.map((c) => (c.id === renaming.id ? { ...c, name: trimmed } : c)),
    })
    setRenaming(null)
  }

  function remove(id: string) {
    if (!settings) return
    updateSettings({ ...settings, categories: settings.categories.filter((c) => c.id !== id) })
    setPendingDelete(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <p className="text-sm muted">Every expense must pick one of these — no free-text categories.</p>

      <div className="card divide-y divider">
        {settings.categories.length === 0 ? (
          <p className="p-4 text-sm muted">No categories yet.</p>
        ) : (
          settings.categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span>{c.name}</span>
              <span className="flex gap-4 text-sm">
                <button className="text-indigo-600" onClick={() => setRenaming(c)}>
                  Rename
                </button>
                <button className="text-red-500" onClick={() => setPendingDelete(c.id)}>
                  Delete
                </button>
              </span>
            </div>
          ))
        )}
        <div className="flex gap-2 p-3">
          <input
            className="input"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-primary" onClick={add} disabled={!newCategory.trim()}>
            Add
          </button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          message="Delete this category? Existing expenses keep working but show “(deleted)”."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {renaming && (
        <PromptDialog
          title="Rename category"
          defaultValue={renaming.name}
          confirmLabel="Save"
          onSubmit={rename}
          onCancel={() => setRenaming(null)}
        />
      )}
    </div>
  )
}
