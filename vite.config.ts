import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Stamps every build with one version id, in two places:
 * - baked into the JS as __APP_VERSION__ (the version this page is running), and
 * - written to dist/version.json (the version currently deployed).
 * The app compares the two on launch/resume and asks to update on a mismatch.
 * In CI the id is the commit SHA, so re-deploying the same commit doesn't prompt.
 */
function versionStamp(version: string, builtAt: string): Plugin {
  return {
    name: 'version-stamp',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, builtAt }) })
    },
  }
}

// base './' makes the build work under any GitHub Pages sub-path.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const builtAt = new Date().toISOString()
  const version = (env.GITHUB_SHA ?? '').slice(0, 7) || `local-${Date.now().toString(36)}`
  return {
    plugins: [react(), versionStamp(version, builtAt)],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_BUILT_AT__: JSON.stringify(builtAt),
    },
  }
})
