import type { Ledger, Month, Settings } from '../types'
import {
  deleteFile,
  getJsonFile,
  getJsonFileAtRef,
  listCommits,
  listDir,
  putJsonFile,
  type CommitInfo,
  type GitHubConfig,
} from './github'

/**
 * Raised when the remote copy changed since this device last read it — i.e. the
 * other device saved in between. Carries the remote version so the UI can offer
 * a choice instead of silently clobbering one side.
 */
export class ConflictError extends Error {
  remote: unknown
  constructor(remote: unknown) {
    super('The data was changed on another device.')
    this.name = 'ConflictError'
    this.remote = remote
  }
}

export interface DataStore {
  readonly kind: 'local' | 'github'
  loadSettings(): Promise<Settings | null>
  saveSettings(settings: Settings, force?: boolean): Promise<void>
  loadLedger(): Promise<Ledger | null>
  saveLedger(ledger: Ledger, force?: boolean): Promise<void>
  listMonths(): Promise<string[]>
  loadMonth(monthId: string): Promise<Month | null>
  saveMonth(month: Month, force?: boolean): Promise<void>
  deleteMonth(monthId: string): Promise<void>
  /** Version history is only meaningful for the git-backed store. */
  supportsHistory(): boolean
  monthHistory(monthId: string): Promise<CommitInfo[]>
  monthAtCommit(monthId: string, sha: string): Promise<Month | null>
}

// ---------- config persistence ----------

const CONFIG_KEY = 'et.storeConfig'

export type StoreConfig = { kind: 'local' } | ({ kind: 'github' } & GitHubConfig)

export function loadStoreConfig(): StoreConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY)
  return raw ? (JSON.parse(raw) as StoreConfig) : null
}

export function saveStoreConfig(cfg: StoreConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export function clearStoreConfig(): void {
  localStorage.removeItem(CONFIG_KEY)
}

export function createStore(cfg: StoreConfig): DataStore {
  return cfg.kind === 'local' ? new LocalStore() : new GitHubStore(cfg)
}

// ---------- local-only store (browser storage) ----------

const LS_SETTINGS = 'et.settings'
const LS_LEDGER = 'et.ledger'
const LS_MONTHS_INDEX = 'et.monthIndex'
const lsMonthKey = (id: string) => `et.month.${id}`

class LocalStore implements DataStore {
  readonly kind = 'local' as const

  async loadSettings(): Promise<Settings | null> {
    const raw = localStorage.getItem(LS_SETTINGS)
    return raw ? (JSON.parse(raw) as Settings) : null
  }

  async saveSettings(settings: Settings): Promise<void> {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
  }

  async loadLedger(): Promise<Ledger | null> {
    const raw = localStorage.getItem(LS_LEDGER)
    return raw ? (JSON.parse(raw) as Ledger) : null
  }

  async saveLedger(ledger: Ledger): Promise<void> {
    localStorage.setItem(LS_LEDGER, JSON.stringify(ledger))
  }

  async listMonths(): Promise<string[]> {
    const raw = localStorage.getItem(LS_MONTHS_INDEX)
    return raw ? (JSON.parse(raw) as string[]) : []
  }

  async loadMonth(monthId: string): Promise<Month | null> {
    const raw = localStorage.getItem(lsMonthKey(monthId))
    return raw ? (JSON.parse(raw) as Month) : null
  }

  async saveMonth(month: Month): Promise<void> {
    localStorage.setItem(lsMonthKey(month.id), JSON.stringify(month))
    const index = await this.listMonths()
    if (!index.includes(month.id)) {
      index.push(month.id)
      index.sort()
      localStorage.setItem(LS_MONTHS_INDEX, JSON.stringify(index))
    }
  }

  async deleteMonth(monthId: string): Promise<void> {
    localStorage.removeItem(lsMonthKey(monthId))
    const index = (await this.listMonths()).filter((id) => id !== monthId)
    localStorage.setItem(LS_MONTHS_INDEX, JSON.stringify(index))
  }

  supportsHistory(): boolean {
    return false
  }

  async monthHistory(): Promise<CommitInfo[]> {
    return []
  }

  async monthAtCommit(): Promise<Month | null> {
    return null
  }
}

// ---------- GitHub-backed store ----------
// settings.json and data/YYYY-MM.json in a private repo. A sha is remembered per
// path; a stale sha means another device wrote first, which surfaces as a
// ConflictError rather than an overwrite (unless the caller forces it).

const SETTINGS_PATH = 'settings.json'
const LEDGER_PATH = 'ledger.json'
const monthPath = (id: string) => `data/${id}.json`

class GitHubStore implements DataStore {
  readonly kind = 'github' as const
  private cfg: GitHubConfig
  private shas = new Map<string, string>()

  constructor(cfg: GitHubConfig) {
    this.cfg = cfg
  }

  private async put(path: string, data: unknown, message: string, force?: boolean): Promise<void> {
    try {
      const newSha = await putJsonFile(this.cfg, path, data, message, this.shas.get(path))
      this.shas.set(path, newSha)
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status !== 409 && status !== 422) throw e

      // Someone else wrote since our last read. Re-read to get the live sha.
      const current = await getJsonFile<unknown>(this.cfg, path)
      if (current) this.shas.set(path, current.sha)
      if (!force && current) throw new ConflictError(current.data)

      const newSha = await putJsonFile(this.cfg, path, data, message, current?.sha)
      this.shas.set(path, newSha)
    }
  }

  async loadSettings(): Promise<Settings | null> {
    const res = await getJsonFile<Settings>(this.cfg, SETTINGS_PATH)
    if (!res) return null
    this.shas.set(SETTINGS_PATH, res.sha)
    return res.data
  }

  async saveSettings(settings: Settings, force?: boolean): Promise<void> {
    await this.put(SETTINGS_PATH, settings, 'Update settings', force)
  }

  async loadLedger(): Promise<Ledger | null> {
    const res = await getJsonFile<Ledger>(this.cfg, LEDGER_PATH)
    if (!res) return null
    this.shas.set(LEDGER_PATH, res.sha)
    return res.data
  }

  async saveLedger(ledger: Ledger, force?: boolean): Promise<void> {
    await this.put(LEDGER_PATH, ledger, 'Update ledger', force)
  }

  async listMonths(): Promise<string[]> {
    const names = await listDir(this.cfg, 'data')
    return names.sort()
  }

  async loadMonth(monthId: string): Promise<Month | null> {
    const res = await getJsonFile<Month>(this.cfg, monthPath(monthId))
    if (!res) return null
    this.shas.set(monthPath(monthId), res.sha)
    return res.data
  }

  async saveMonth(month: Month, force?: boolean): Promise<void> {
    await this.put(monthPath(month.id), month, `Update ${month.id}`, force)
  }

  async deleteMonth(monthId: string): Promise<void> {
    const path = monthPath(monthId)
    // A delete needs the live sha, which we may not have if the month was never
    // opened on this device.
    let sha = this.shas.get(path)
    if (!sha) {
      const current = await getJsonFile<Month>(this.cfg, path)
      if (!current) return
      sha = current.sha
    }
    await deleteFile(this.cfg, path, `Delete ${monthId}`, sha)
    this.shas.delete(path)
  }

  supportsHistory(): boolean {
    return true
  }

  async monthHistory(monthId: string): Promise<CommitInfo[]> {
    return listCommits(this.cfg, monthPath(monthId))
  }

  async monthAtCommit(monthId: string, sha: string): Promise<Month | null> {
    return getJsonFileAtRef<Month>(this.cfg, monthPath(monthId), sha)
  }
}
