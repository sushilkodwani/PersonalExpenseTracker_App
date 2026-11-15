import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './store/AppContext.tsx'
import { ThemeProvider } from './store/ThemeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // updateViaCache 'none': always compare sw.js with the server, never the HTTP
  // cache, so a new deploy is noticed on the next check.
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((reg) => {
      // An installed PWA can sit in the background for days; check for a new
      // version whenever it comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {})
      })
    })
    .catch(() => {})
}
