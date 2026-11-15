// Web Push subscription management.
//
// The app only *receives* pushes. Sending happens in the data repo's GitHub
// Action (see notifier/ in this repo), which reads the subscriptions this file
// writes to push/subscriptions.json and notifies everyone except the person who
// made a change.

import { GitHubApiError, getJsonFile, putJsonFile, type GitHubConfig } from './github'
import { uuid } from './uuid'

export const SUBSCRIPTIONS_PATH = 'push/subscriptions.json'

/** Public half of the VAPID key pair. Set at build time; safe to be public. */
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? ''

export interface PushSubscriptionRecord {
  deviceId: string
  /** Who this device belongs to — used to skip notifying people about their own changes. */
  email: string
  /** Short human label, e.g. "iPhone", so the subscriptions file is readable. */
  device: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  createdAt: string
}

export interface SubscriptionsFile {
  subscriptions: PushSubscriptionRecord[]
}

export type PushSupport =
  /** Built without a VAPID public key. */
  | 'not-configured'
  /** Service workers only run in production builds of this app. */
  | 'dev'
  /** iPhone/iPad Safari tab — push only works once added to the Home Screen. */
  | 'needs-install'
  | 'unsupported'
  | 'ok'

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  if (!import.meta.env.PROD) return 'dev'
  if (!VAPID_PUBLIC_KEY) return 'not-configured'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Browser'
}

const DEVICE_ID_KEY = 'et.deviceId'
/** Endpoint last written to the repo, so launches don't re-write an unchanged subscription. */
const SAVED_ENDPOINT_KEY = 'et.pushEndpoint'

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Read-modify-write of the subscriptions file. Two phones can enable at the same
 * time, so a stale-sha rejection re-reads and re-applies instead of failing.
 */
async function updateSubscriptions(
  cfg: GitHubConfig,
  message: string,
  change: (subs: PushSubscriptionRecord[]) => PushSubscriptionRecord[],
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await getJsonFile<SubscriptionsFile>(cfg, SUBSCRIPTIONS_PATH)
    const next: SubscriptionsFile = { subscriptions: change(current?.data.subscriptions ?? []) }
    try {
      await putJsonFile(cfg, SUBSCRIPTIONS_PATH, next, message, current?.sha)
      return
    } catch (e) {
      const status = e instanceof GitHubApiError ? e.status : 0
      if (status !== 409 && status !== 422) throw e
    }
  }
  throw new Error('Could not save notification settings — the file kept changing. Try again.')
}

function toRecord(sub: PushSubscription, email: string): PushSubscriptionRecord {
  const json = sub.toJSON()
  return {
    deviceId: deviceId(),
    email: email.trim().toLowerCase(),
    device: deviceLabel(),
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    createdAt: new Date().toISOString(),
  }
}

async function saveRecord(cfg: GitHubConfig, record: PushSubscriptionRecord): Promise<void> {
  await updateSubscriptions(cfg, `Enable notifications (${record.device})`, (subs) => [
    // One entry per device; also drop any stale copy of the same endpoint.
    ...subs.filter((s) => s.deviceId !== record.deviceId && s.endpoint !== record.endpoint),
    record,
  ])
  localStorage.setItem(SAVED_ENDPOINT_KEY, record.endpoint)
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** True when this device is subscribed and allowed to show notifications. */
export async function isPushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false
  return !!(await currentSubscription())
}

/**
 * Must be called straight from a tap: iOS only shows the permission prompt
 * in response to a user gesture.
 */
export async function enablePush(cfg: GitHubConfig, email: string): Promise<void> {
  if (pushSupport() !== 'ok') throw new Error('Notifications are not available on this device.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this app. Allow them in the phone’s Settings → Notifications, then try again.'
        : 'Notification permission was not granted.',
    )
  }
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
  await saveRecord(cfg, toRecord(sub, email))
}

export async function disablePush(cfg: GitHubConfig): Promise<void> {
  const sub = pushSupport() === 'ok' ? await currentSubscription() : null
  const id = deviceId()
  await updateSubscriptions(cfg, 'Disable notifications', (subs) =>
    subs.filter((s) => s.deviceId !== id && (!sub || s.endpoint !== sub.endpoint)),
  )
  await sub?.unsubscribe()
  localStorage.removeItem(SAVED_ENDPOINT_KEY)
}

/**
 * Browsers occasionally rotate a subscription. On launch, re-save it if the
 * endpoint differs from what this device last wrote. Silent on failure — it
 * retries on the next launch.
 */
export async function ensureSubscriptionSaved(cfg: GitHubConfig, email: string): Promise<void> {
  try {
    if (!(await isPushEnabled())) return
    const sub = await currentSubscription()
    if (!sub || localStorage.getItem(SAVED_ENDPOINT_KEY) === sub.endpoint) return
    await saveRecord(cfg, toRecord(sub, email))
  } catch {
    // best effort
  }
}
