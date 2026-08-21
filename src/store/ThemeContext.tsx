/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'et.theme'

interface ThemeState {
  pref: ThemePref
  isDark: boolean
  setPref: (p: ThemePref) => void
}

const Ctx = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme outside provider')
  return ctx
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => (localStorage.getItem(KEY) as ThemePref) ?? 'system')
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = pref === 'system' ? systemDark : pref === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#020617' : '#6366f1')
  }, [isDark])

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p)
    setPrefState(p)
  }, [])

  const value = useMemo(() => ({ pref, isDark, setPref }), [pref, isDark, setPref])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
