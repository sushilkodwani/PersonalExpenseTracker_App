/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CommitInfo } from '../lib/github'
import type { ExpenseItem, Ledger, Month, Person, Settings } from '../types'
import { PEOPLE } from '../types'
import { carryItems } from '../lib/compute'
import { defaultSettings, normalizeSettings } from '../lib/defaults'
import { emptyLedger } from '../lib/ledger'
import { uuid } from '../lib/uuid'
import {
  ConflictError,
  createStore,
  loadStoreConfig,
  saveStoreConfig,
  clearStoreConfig,
  type DataStore,
  type StoreConfig,
} from '../lib/store'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface Conflict {
  kind: 'month'
  monthId: string
  remote: Month
  local: Month
}

interface AppState {
  ready: boolean
  storeKind: 'local' | 'github' | null
  settings: Settings | null
  ledger: Ledger | null
  monthIds: string[]
  months: Record<string, Month>
  saveState: SaveState
  error: string | null
  conflict: Conflict | null
  supportsHistory: boolean
  configure: (cfg: StoreConfig) => Promise<void>
  disconnect: () => void
  updateSettings: (next: Settings) => void
  updateLedger: (next: Ledger) => void
  loadMonth: (monthId: string) => Promise<Month | null>
  loadAllMonths: () => Promise<void>
  createMonth: (monthId: string, salaries: Record<Person, number>) => Promise<Month>
  updateMonth: (next: Month) => void
  deleteMonth: (monthId: string) => Promise<void>
  resolveConflict: (choice: 'mine' | 'remote') => Promise<void>
  monthHistory: (monthId: string) => Promise<CommitInfo[]>
  monthAtCommit: (monthId: string, sha: string) => Promise<Month | null>
  restoreMonth: (month: Month) => Promise<void>
  importBackup: (settings: Settings, months: Record<string, Month>) => Promise<void>
  clearError: () => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}

const SAVE_DEBOUNCE_MS = 1200

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DataStore | null>(null)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [monthIds, setMonthIds] = useState<string[]>([])
  const [months, setMonths] = useState<Record<string, Month>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Kept in a ref so persist() always writes the newest version of a month,
  // even when several edits land inside one debounce window.
  const pendingMonths = useRef<Record<string, Month>>({})

  const initFromStore = useCallback(async (s: DataStore) => {
    const loaded = await s.loadSettings()
    let effective: Settings
    if (loaded) {
      effective = normalizeSettings(loaded)
      // Persist newly-introduced fields (e.g. the month-lock password moving out
      // of the code) so the store becomes the single source of truth.
      if (JSON.stringify(effective) !== JSON.stringify(loaded)) {
        await s.saveSettings(effective, true)
      }
    } else {
      effective = defaultSettings()
      await s.saveSettings(effective)
    }
    const loadedLedger = await s.loadLedger()
    const effectiveLedger = loadedLedger ?? emptyLedger()
    if (!loadedLedger) await s.saveLedger(effectiveLedger)

    const ids = await s.listMonths()
    setSettings(effective)
    setLedger(effectiveLedger)
    setMonthIds(ids)
    setMonths({})
    setStore(s)
  }, [])

  // Restore persisted config on first mount.
  useEffect(() => {
    const cfg = loadStoreConfig()
    if (!cfg) {
      setReady(true)
      return
    }
    initFromStore(createStore(cfg))
      .catch((e) => {
        setError(`Could not load data: ${(e as Error).message}`)
        clearStoreConfig()
      })
      .finally(() => setReady(true))
  }, [initFromStore])

  const configure = useCallback(
    async (cfg: StoreConfig) => {
      await initFromStore(createStore(cfg))
      saveStoreConfig(cfg)
    },
    [initFromStore],
  )

  const disconnect = useCallback(() => {
    clearStoreConfig()
    setStore(null)
    setSettings(null)
    setLedger(null)
    setMonthIds([])
    setMonths({})
  }, [])

  const persist = useCallback((key: string, fn: () => Promise<void>) => {
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(async () => {
      setSaveState('saving')
      try {
        await fn()
        setSaveState('saved')
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500)
      } catch (e) {
        if (e instanceof ConflictError) {
          const monthId = key.startsWith('month.') ? key.slice('month.'.length) : ''
          const local = pendingMonths.current[monthId]
          if (monthId && local) {
            setConflict({ kind: 'month', monthId, remote: e.remote as Month, local })
            setSaveState('idle')
            return
          }
        }
        setSaveState('error')
        setError(`Save failed: ${(e as Error).message}`)
      }
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const updateSettings = useCallback(
    (next: Settings) => {
      setSettings(next)
      if (store) persist('settings', () => store.saveSettings(next, true))
    },
    [store, persist],
  )

  const updateLedger = useCallback(
    (next: Ledger) => {
      setLedger(next)
      if (store) persist('ledger', () => store.saveLedger(next, true))
    },
    [store, persist],
  )

  const loadMonth = useCallback(
    async (monthId: string): Promise<Month | null> => {
      if (months[monthId]) return months[monthId]
      if (!store) return null
      const m = await store.loadMonth(monthId)
      if (m) setMonths((prev) => (prev[monthId] ? prev : { ...prev, [monthId]: m }))
      return m
    },
    [store, months],
  )

  const loadAllMonths = useCallback(async () => {
    if (!store) return
    const missing = monthIds.filter((id) => !months[id])
    if (missing.length === 0) return
    const loaded = await Promise.all(missing.map(async (id) => [id, await store.loadMonth(id)] as const))
    setMonths((prev) => {
      const next = { ...prev }
      for (const [id, m] of loaded) if (m && !next[id]) next[id] = m
      return next
    })
  }, [store, monthIds, months])

  const createMonth = useCallback(
    async (monthId: string, salaries: Record<Person, number>): Promise<Month> => {
      if (!store || !settings) throw new Error('Not configured')

      const templateSections = (p: Person) =>
        settings.sections
          .filter((s) => s.defaultInTemplate && (s.owner === p || s.owner === 'shared'))
          .map((s) => ({ sectionId: s.id, items: [] as ExpenseItem[] }))

      const month: Month = {
        id: monthId,
        people: {
          sush: { salary: salaries.sush, sections: templateSections('sush') },
          khush: { salary: salaries.khush, sections: templateSections('khush') },
        },
      }

      const sectionFor = (person: Person, sectionId: string) => {
        let target = month.people[person].sections.find((s) => s.sectionId === sectionId)
        if (!target) {
          target = { sectionId, items: [] }
          month.people[person].sections.push(target)
        }
        return target
      }

      // Fixed monthly expenses (rent, EMIs, maid) come in pre-filled and unpaid.
      for (const rec of settings.recurring ?? []) {
        if (!rec.active) continue
        sectionFor(rec.person, rec.sectionId).items.push({
          id: uuid(),
          name: rec.name,
          amount: rec.amount,
          categoryId: rec.categoryId,
          paid: false,
          isTransfer: false,
          carryToNextMonth: false,
        })
      }

      // Carry forward unpaid flagged items from the latest month before this one.
      const prevId = [...monthIds].sort().reverse().find((id) => id < monthId)
      if (prevId) {
        const prev = months[prevId] ?? (await store.loadMonth(prevId))
        if (prev) {
          for (const p of PEOPLE) {
            for (const { sectionId, item } of carryItems(prev.people[p])) {
              sectionFor(p, sectionId).items.push({
                ...item,
                id: uuid(),
                paid: false,
                carryToNextMonth: false,
              })
            }
          }
        }
      }

      await store.saveMonth(month)
      setMonths((prev) => ({ ...prev, [monthId]: month }))
      setMonthIds((prev) => (prev.includes(monthId) ? prev : [...prev, monthId].sort()))
      return month
    },
    [store, settings, monthIds, months],
  )

  const updateMonth = useCallback(
    (next: Month) => {
      setMonths((prev) => ({ ...prev, [next.id]: next }))
      pendingMonths.current[next.id] = next
      if (store) persist(`month.${next.id}`, () => store.saveMonth(pendingMonths.current[next.id] ?? next))
    },
    [store, persist],
  )

  const deleteMonth = useCallback(
    async (monthId: string) => {
      if (!store) return
      // Cancel any in-flight debounced save so it can't recreate the file.
      clearTimeout(saveTimers.current[`month.${monthId}`])
      delete pendingMonths.current[monthId]

      await store.deleteMonth(monthId)
      setMonths((prev) => {
        const next = { ...prev }
        delete next[monthId]
        return next
      })
      setMonthIds((prev) => prev.filter((id) => id !== monthId))
    },
    [store],
  )

  const resolveConflict = useCallback(
    async (choice: 'mine' | 'remote') => {
      if (!store || !conflict) return
      if (choice === 'remote') {
        setMonths((prev) => ({ ...prev, [conflict.monthId]: conflict.remote }))
        pendingMonths.current[conflict.monthId] = conflict.remote
      } else {
        await store.saveMonth(conflict.local, true)
      }
      setConflict(null)
    },
    [store, conflict],
  )

  const monthHistory = useCallback(
    async (monthId: string) => (store ? store.monthHistory(monthId) : []),
    [store],
  )

  const monthAtCommit = useCallback(
    async (monthId: string, sha: string) => (store ? store.monthAtCommit(monthId, sha) : null),
    [store],
  )

  const restoreMonth = useCallback(
    async (month: Month) => {
      if (!store) return
      await store.saveMonth(month, true)
      setMonths((prev) => ({ ...prev, [month.id]: month }))
      pendingMonths.current[month.id] = month
    },
    [store],
  )

  const importBackup = useCallback(
    async (nextSettings: Settings, nextMonths: Record<string, Month>) => {
      if (!store) return
      const normalized = normalizeSettings(nextSettings)
      await store.saveSettings(normalized, true)
      for (const month of Object.values(nextMonths)) {
        await store.saveMonth(month, true)
      }
      setSettings(normalized)
      setMonths(nextMonths)
      setMonthIds(Object.keys(nextMonths).sort())
    },
    [store],
  )

  return (
    <Ctx.Provider
      value={{
        ready,
        storeKind: store?.kind ?? null,
        settings,
        ledger,
        monthIds,
        months,
        saveState,
        error,
        conflict,
        supportsHistory: store?.supportsHistory() ?? false,
        configure,
        disconnect,
        updateSettings,
        updateLedger,
        loadMonth,
        loadAllMonths,
        createMonth,
        updateMonth,
        deleteMonth,
        resolveConflict,
        monthHistory,
        monthAtCommit,
        restoreMonth,
        importBackup,
        clearError: () => setError(null),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
