/// <reference types="vite/client" />

/** Build id of the code in this page (see vite.config.ts). */
declare const __APP_VERSION__: string
declare const __APP_BUILT_AT__: string

interface ImportMetaEnv {
  /** Public VAPID key for Web Push. Set as the VAPID_PUBLIC_KEY repo variable for deploys. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}
