import { useEffect, useState } from 'react'
import { AccessControlScreen } from './screens/AccessControlScreen'
import { AccessDeniedScreen } from './screens/AccessDeniedScreen'
import { ConflictDialog } from './components/ConflictDialog'
import { monthLabel } from './lib/compute'
import { BudgetsScreen } from './screens/BudgetsScreen'
import { CategoriesScreen } from './screens/CategoriesScreen'
import { ChartsScreen } from './screens/ChartsScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { ImportScreen } from './screens/ImportScreen'
import { MonthListScreen } from './screens/MonthListScreen'
import { MonthView } from './screens/MonthView'
import { NewMonthWizard } from './screens/NewMonthWizard'
import { isSessionUnlocked } from './lib/session'
import { ensureSubscriptionSaved } from './lib/push'
import { loadStoreConfig } from './lib/store'
import { PeopleScreen } from './screens/PeopleScreen'
import { PersonLedgerScreen } from './screens/PersonLedgerScreen'
import { PinGate } from './screens/PinGate'
import { RecurringScreen } from './screens/RecurringScreen'
import { SearchScreen } from './screens/SearchScreen'
import { SectionsScreen } from './screens/SectionsScreen'
import { SettingsScreen, type SettingsSubScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'
import { DataRepoScreen } from './screens/DataRepoScreen'
import { TOKEN_WARN_DAYS, tokenExpiryStatus } from './lib/dates'
import { TokenGateScreen } from './screens/TokenGateScreen'
import { useApp } from './store/AppContext'

type Tab = 'month' | 'people' | 'search' | 'charts' | 'settings'
type SubScreen = SettingsSubScreen | null

const SUB_SCREEN_TITLES: Record<NonNullable<SubScreen>, string> = {
  sections: 'Sections',
  categories: 'Categories',
  recurring: 'Recurring expenses',
  budgets: 'Budgets & goal',
  import: 'Import',
  history: 'History',
  access: 'Access control',
  repo: 'Data repo',
}

export default function App() {
  const {
    ready,
    storeKind,
    settings,
    ledger,
    monthIds,
    months,
    loadMonth,
    saveState,
    error,
    clearError,
    conflict,
    resolveConflict,
    role,
    canEdit,
    isAdmin,
    currentUserEmail,
    tokenExpired,
  } = useApp()
  const [tokenGateDismissed, setTokenGateDismissed] = useState(false)
  const [tab, setTab] = useState<Tab>('month')
  const [showingDetail, setShowingDetail] = useState(false)
  const [subScreen, setSubScreen] = useState<SubScreen>(null)
  const [monthId, setMonthId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [unlocked, setUnlocked] = useState(isSessionUnlocked)

  // Keep a "current" month selected (used by charts) without forcing the detail view open.
  useEffect(() => {
    if (storeKind && monthIds.length > 0 && (!monthId || !monthIds.includes(monthId))) {
      setMonthId([...monthIds].sort().at(-1)!)
    }
  }, [storeKind, monthIds, monthId])

  useEffect(() => {
    if (monthId) void loadMonth(monthId)
  }, [monthId, loadMonth])

  // Tapping a notification opens the app at ?month=YYYY-MM / ?view=people, or —
  // when the app is already open — the service worker posts the same target.
  useEffect(() => {
    function openTarget(target: { monthId?: string | null; view?: string | null }) {
      setSubScreen(null)
      if (target.monthId) {
        setMonthId(target.monthId)
        setShowingDetail(true)
        setTab('month')
      } else if (target.view === 'people') {
        setContactId(null)
        setTab('people')
      }
    }
    const params = new URLSearchParams(window.location.search)
    if (params.has('month') || params.has('view')) {
      openTarget({ monthId: params.get('month'), view: params.get('view') })
      window.history.replaceState(null, '', window.location.pathname)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open') openTarget(e.data)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  // Browsers occasionally rotate push subscriptions; re-save if it changed.
  useEffect(() => {
    const cfg = loadStoreConfig()
    if (storeKind === 'github' && cfg?.kind === 'github' && currentUserEmail) {
      void ensureSubscriptionSaved(cfg, currentUserEmail)
    }
  }, [storeKind, currentUserEmail])

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center muted">Loading…</div>
  }

  // Startup failed because GitHub rejected the token: ask for a new one rather
  // than dropping back to setup (nothing can load without it).
  if (!storeKind && tokenExpired) return <TokenGateScreen />

  if (!storeKind) return <SetupScreen />

  if (role === 'denied') return <AccessDeniedScreen />

  if (settings?.appPin && !unlocked) {
    return <PinGate pin={settings.appPin} onUnlock={() => setUnlocked(true)} />
  }

  const month = monthId ? months[monthId] : null
  const inMonthDetail = tab === 'month' && showingDetail && monthIds.length > 0
  const inPersonDetail = tab === 'people' && !!contactId
  const contactName = contactId ? ledger?.contacts.find((c) => c.id === contactId)?.name : null

  function goToTab(t: Tab) {
    setTab(t)
    setSubScreen(null)
    if (t === 'month') setShowingDetail(false)
    if (t === 'people') setContactId(null)
  }

  function openMonth(id: string) {
    setMonthId(id)
    setShowingDetail(true)
    setSubScreen(null)
    setTab('month')
  }

  function openPerson(id: string) {
    setContactId(id)
    setSubScreen(null)
    setTab('people')
  }

  const headerTitle = subScreen
    ? SUB_SCREEN_TITLES[subScreen]
    : tab === 'charts'
      ? 'Charts'
      : tab === 'search'
        ? 'Search'
        : tab === 'settings'
          ? 'Settings'
          : tab === 'people'
            ? 'People'
            : 'Months'

  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      {/* Header */}
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          {inMonthDetail && !subScreen ? (
            <div className="flex items-center gap-1">
              <button
                className="-ml-1 px-2 text-xl muted"
                onClick={() => setShowingDetail(false)}
                aria-label="Back to months"
              >
                ‹
              </button>
              <select
                className="rounded-lg border-none bg-transparent text-lg font-bold outline-none dark:bg-slate-950"
                value={monthId ?? ''}
                onChange={(e) => setMonthId(e.target.value)}
              >
                {[...monthIds].sort().reverse().map((id) => (
                  <option key={id} value={id}>
                    {monthLabel(id)}
                  </option>
                ))}
              </select>
            </div>
          ) : inPersonDetail && !subScreen ? (
            <div className="flex items-center gap-1">
              <button className="-ml-1 px-2 text-xl muted" onClick={() => setContactId(null)} aria-label="Back to people">
                ‹
              </button>
              <h1 className="text-lg font-bold">{contactName ?? 'Person'}</h1>
            </div>
          ) : subScreen ? (
            <div className="flex items-center gap-1">
              <button className="-ml-1 px-2 text-xl muted" onClick={() => setSubScreen(null)} aria-label="Back">
                ‹
              </button>
              <h1 className="text-lg font-bold">{headerTitle}</h1>
            </div>
          ) : (
            <h1 className="text-lg font-bold">{headerTitle}</h1>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs muted">
              {role === 'view' && <span className="font-medium text-amber-600">👁 View only</span>}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && '✓ Saved'}
              {saveState === 'error' && <span className="text-red-500">Save failed</span>}
            </span>
            {tab === 'month' && !subScreen && canEdit && (
              <button className="rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => setShowWizard(true)}>
                + Month
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="no-print mx-4 mt-3 flex items-start justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          <span>{error}</span>
          <button className="ml-3 font-bold" onClick={clearError}>
            ✕
          </button>
        </div>
      )}

      {/* Token banners: rejected token (after "Not now"), or expiry coming up (admin) */}
      {tokenExpired && tokenGateDismissed ? (
        <button
          className="no-print mx-4 mt-3 block w-[calc(100%-2rem)] rounded-lg bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
          onClick={() => setTokenGateDismissed(false)}
        >
          <b>The access token isn’t working.</b> Changes can’t sync until you enter a new one — tap here.
        </button>
      ) : (
        (() => {
          if (!isAdmin || storeKind !== 'github' || !settings?.tokenExpiresOn || subScreen === 'repo') return null
          const { days, text } = tokenExpiryStatus(settings.tokenExpiresOn)
          if (days > TOKEN_WARN_DAYS) return null
          return (
            <button
              className="no-print mx-4 mt-3 block w-[calc(100%-2rem)] rounded-lg bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              onClick={() => {
                setTab('settings')
                setSubScreen('repo')
              }}
            >
              <b>Access token: {text.toLowerCase()}.</b> Create a new token on GitHub and update it here and on every
              other device.
            </button>
          )
        })()
      )}

      {/* Body */}
      {subScreen === 'sections' && <SectionsScreen />}
      {subScreen === 'categories' && <CategoriesScreen />}
      {subScreen === 'recurring' && <RecurringScreen />}
      {subScreen === 'budgets' && <BudgetsScreen />}
      {subScreen === 'import' && <ImportScreen onDone={() => monthId && openMonth(monthId)} />}
      {subScreen === 'history' && <HistoryScreen onDone={() => monthId && openMonth(monthId)} />}
      {subScreen === 'access' && <AccessControlScreen />}
      {subScreen === 'repo' && <DataRepoScreen />}

      {!subScreen && (
        <>
          {tab === 'month' &&
            (inMonthDetail ? (
              month ? <MonthView month={month} /> : <div className="p-10 text-center muted">Loading month…</div>
            ) : (
              <MonthListScreen onSelect={openMonth} onCreateNew={() => setShowWizard(true)} />
            ))}
          {tab === 'people' &&
            (inPersonDetail ? <PersonLedgerScreen contactId={contactId!} /> : <PeopleScreen onSelect={openPerson} />)}
          {tab === 'search' && <SearchScreen onOpenMonth={openMonth} />}
          {tab === 'charts' && <ChartsScreen monthId={monthId} />}
          {tab === 'settings' && <SettingsScreen onNavigate={setSubScreen} />}
        </>
      )}

      {/* Bottom tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl">
          {(
            [
              ['month', '📒', 'Month'],
              ['people', '🤝', 'People'],
              ['search', '🔍', 'Search'],
              ['charts', '📊', 'Charts'],
              ['settings', '⚙️', 'Settings'],
            ] as [Tab, string, string][]
          ).map(([t, icon, label]) => (
            <button
              key={t}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                tab === t ? 'text-indigo-600' : 'muted'
              }`}
              onClick={() => goToTab(t)}
            >
              <span className="text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {showWizard && (
        <NewMonthWizard
          onCreated={(id) => {
            setShowWizard(false)
            openMonth(id)
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {conflict && <ConflictDialog conflict={conflict} onResolve={resolveConflict} />}

      {/* Token rejected mid-session (a save got 401): ask for the new token over the app. */}
      {tokenExpired && !tokenGateDismissed && <TokenGateScreen onLater={() => setTokenGateDismissed(true)} />}
    </div>
  )
}
