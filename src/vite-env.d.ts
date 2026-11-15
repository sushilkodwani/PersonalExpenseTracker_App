/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public VAPID key for Web Push. Set as the VAPID_PUBLIC_KEY repo variable for deploys. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}
