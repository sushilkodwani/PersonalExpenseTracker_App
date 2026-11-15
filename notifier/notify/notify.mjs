// Expense Tracker change notifier — runs in the PRIVATE DATA repo via
// .github/workflows/notify.yml (copied from notifier/ in the app repo).
//
// What it does
// 1. Finds the data commits since the last run (marker in push/state.json).
// 2. Groups them by who made them (the "Actor: <email>" trailer the app adds).
// 3. Works out the net change per expense / ledger entry, so add-then-edit
//    becomes one line and add-then-delete disappears.
// 4. Sends one Web Push per person to everyone EXCEPT that person.
// 5. Drops dead subscriptions and records the new marker.
//
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… or https://…)
// Optional: ACTOR_NAMES (JSON {"email": "Name"}), TEST_MESSAGE (manual test run),
//           DRY_RUN=1 (print instead of sending/committing), BEFORE_SHA (fallback start).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const DRY_RUN = process.env.DRY_RUN === '1'
const SUBS_PATH = 'push/subscriptions.json'
const STATE_PATH = 'push/state.json'
const WATCHED = ['data', 'ledger.json']
const MAX_COMMITS = 100
const MAX_LINES = 4
const PEOPLE = { sush: 'Sush', khush: 'Khush' }

// ---------- git helpers ----------

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

function tryGit(...args) {
  try {
    return git(...args)
  } catch {
    return null
  }
}

/** JSON content of `path` at `rev`, or null if it didn't exist there. */
function jsonAt(rev, path) {
  const text = tryGit('show', `${rev}:${path}`)
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

// ---------- formatting ----------

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const fmt = (n) => `₹${inr.format(Number(n) || 0)}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(id) {
  const [y, m] = id.split('-').map(Number)
  return `${MONTHS[m - 1] ?? '?'} ${y}`
}

const actorNames = readJsonEnv('ACTOR_NAMES', {})
function readJsonEnv(name, fallback) {
  try {
    return process.env[name] ? JSON.parse(process.env[name]) : fallback
  } catch {
    return fallback
  }
}
function actorName(email) {
  if (!email) return 'Someone'
  const named = Object.entries(actorNames).find(([k]) => k.toLowerCase() === email)
  if (named) return named[1]
  const local = email.split('@')[0].replace(/[._\d]+/g, ' ').trim()
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : email
}

// ---------- flattening files into comparable keyed values ----------

/** Month file → Map(key → value). Items keyed by id; month-level fields as pseudo keys. */
function flattenMonth(month) {
  const out = new Map()
  if (!month) return out
  out.set('exists', true)
  if (month.locked) out.set('locked', true)
  for (const [person, pm] of Object.entries(month.people ?? {})) {
    out.set(`salary:${person}`, pm.salary ?? 0)
    for (const section of pm.sections ?? []) {
      for (const item of section.items ?? []) {
        out.set(`item:${item.id}`, { person, sectionId: section.sectionId, item })
      }
    }
  }
  return out
}

function flattenLedger(ledger) {
  const out = new Map()
  if (!ledger) return out
  for (const c of ledger.contacts ?? []) out.set(`contact:${c.id}`, c)
  for (const e of ledger.entries ?? []) out.set(`entry:${e.id}`, e)
  return out
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// ---------- collect net changes ----------

/** actor → file → key → { before, after } */
function collectChanges(range) {
  const commits = git('log', '--reverse', `--max-count=${MAX_COMMITS}`, '--format=%H', range, '--', ...WATCHED)
    .split('\n')
    .filter(Boolean)
  const byActor = new Map()

  for (const sha of commits) {
    const body = git('show', '-s', '--format=%B', sha)
    const actor = (body.match(/^Actor:\s*(\S+)/m)?.[1] ?? '').toLowerCase()
    const files = git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha, '--', ...WATCHED)
      .split('\n')
      .filter((f) => f === 'ledger.json' || /^data\/\d{4}-\d{2}\.json$/.test(f))

    for (const file of files) {
      const flatten = file === 'ledger.json' ? flattenLedger : flattenMonth
      const before = flatten(jsonAt(`${sha}^`, file))
      const after = flatten(jsonAt(sha, file))
      const keys = new Set([...before.keys(), ...after.keys()])

      if (!byActor.has(actor)) byActor.set(actor, new Map())
      const files = byActor.get(actor)
      if (!files.has(file)) files.set(file, new Map())
      const changes = files.get(file)

      for (const key of keys) {
        const b = before.get(key)
        const a = after.get(key)
        if (same(a, b)) continue
        const prev = changes.get(key)
        // Keep the earliest "before" and the latest "after" → net change.
        changes.set(key, { before: prev ? prev.before : b, after: a })
      }
    }
  }
  return { commits, byActor }
}

// ---------- describing changes ----------

function describeMonth(changes, names) {
  const lines = []
  const exists = changes.get('exists')
  if (exists && !exists.before && exists.after) lines.push('Started the month')
  if (exists && exists.before && !exists.after) return ['Deleted the month']

  const locked = changes.get('locked')
  if (locked) lines.push(locked.after ? '🔒 Locked the month' : 'Unlocked the month')

  for (const [key, { before, after }] of changes) {
    if (key.startsWith('salary:') && before != null && after != null) {
      lines.push(`${PEOPLE[key.slice(7)] ?? key.slice(7)} salary ${fmt(before)} → ${fmt(after)}`)
    }
  }

  // A brand-new month arrives pre-filled from the template; don't list every item.
  if (exists && !exists.before) {
    const n = [...changes.keys()].filter((k) => k.startsWith('item:')).length
    if (n) lines.push(`${n} expense${n === 1 ? '' : 's'} carried in / pre-filled`)
    return lines
  }

  for (const [key, { before, after }] of changes) {
    if (!key.startsWith('item:')) continue
    const where = (v) => `${PEOPLE[v.person] ?? v.person} · ${names.section(v.sectionId)}`
    if (!before && after) {
      const t = after.item.isTransfer ? ' (T)' : ''
      lines.push(`+ ${after.item.name} ${fmt(after.item.amount)}${t} — ${where(after)}`)
    } else if (before && !after) {
      lines.push(`− Removed ${before.item.name} ${fmt(before.item.amount)} — ${where(before)}`)
    } else if (before && after) {
      const b = before.item
      const a = after.item
      const bits = []
      if (b.amount !== a.amount) bits.push(`${fmt(b.amount)} → ${fmt(a.amount)}`)
      if (b.name !== a.name) bits.push(`renamed from “${b.name}”`)
      if (before.person !== after.person || before.sectionId !== after.sectionId) bits.push(`moved to ${where(after)}`)
      if (b.categoryId !== a.categoryId) bits.push(`category → ${names.category(a.categoryId)}`)
      if (b.isTransfer !== a.isTransfer) bits.push(a.isTransfer ? 'now pass-through' : 'no longer pass-through')
      if (b.carryToNextMonth !== a.carryToNextMonth) bits.push(a.carryToNextMonth ? 'carries over' : 'no longer carries over')
      if (b.paid !== a.paid) bits.push(a.paid ? 'paid ✓' : 'marked unpaid')
      if (bits.length) lines.push(`${a.name}: ${bits.join(', ')}`)
    }
  }
  return lines
}

function describeLedger(changes, contactsNow) {
  const lines = []
  const contactName = (id) => contactsNow.get(id) ?? changes.get(`contact:${id}`)?.before?.name ?? 'someone'
  const sideText = (e) => (e.type === 'take' ? 'they owe' : 'you owe')
  for (const [key, { before, after }] of changes) {
    if (key.startsWith('contact:')) {
      if (!before && after) lines.push(`Added ${after.name} to People`)
      else if (before && !after) lines.push(`Removed ${before.name} from People`)
      else if (before && after && before.name !== after.name) lines.push(`Renamed ${before.name} → ${after.name}`)
      continue
    }
    const note = (e) => (e.note ? ` (${e.note})` : '')
    if (!before && after) lines.push(`${contactName(after.contactId)}: ${fmt(after.amount)} ${sideText(after)}${note(after)}`)
    else if (before && !after) lines.push(`${contactName(before.contactId)}: removed ${fmt(before.amount)} entry`)
    else if (before && after) {
      const bits = []
      if (before.amount !== after.amount) bits.push(`${fmt(before.amount)} → ${fmt(after.amount)}`)
      if (before.type !== after.type) bits.push(`now ${sideText(after)}`)
      if ((before.note ?? '') !== (after.note ?? '')) bits.push('note edited')
      if (before.date !== after.date) bits.push(`date → ${after.date}`)
      if (bits.length) lines.push(`${contactName(after.contactId)}: ${bits.join(', ')}`)
    }
  }
  return lines
}

function buildPayload(actor, files, names, contactsNow) {
  const sections = [] // { label, lines }
  const monthIds = []
  let touchedLedger = false

  for (const [file, changes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (file === 'ledger.json') {
      const lines = describeLedger(changes, contactsNow)
      if (lines.length) {
        touchedLedger = true
        sections.push({ label: 'People', lines })
      }
    } else {
      const id = file.slice('data/'.length, -'.json'.length)
      const lines = describeMonth(changes, names)
      if (lines.length) {
        monthIds.push(id)
        sections.push({ label: monthLabel(id), lines })
      }
    }
  }
  if (!sections.length) return null

  const who = actorName(actor)
  const onlyOne = sections.length === 1
  const title = onlyOne ? `${who} updated ${sections[0].label}` : `${who} updated Expense Tracker`
  const all = onlyOne ? sections[0].lines : sections.flatMap((s) => s.lines.map((l) => `${s.label}: ${l}`))
  const shown = all.slice(0, MAX_LINES)
  if (all.length > shown.length) shown.push(`…and ${all.length - shown.length} more`)

  const payload = { title, body: shown.join('\n') }
  if (monthIds.length === 1 && !touchedLedger) {
    payload.monthId = monthIds[0]
    payload.tag = `month-${monthIds[0]}`
  } else if (touchedLedger && !monthIds.length) {
    payload.view = 'people'
    payload.tag = 'people'
  }
  return payload
}

// ---------- sending ----------

async function send(subscriptions, recipients, payload, webpush) {
  const dead = new Set()
  for (const sub of recipients) {
    const label = `${sub.email} (${sub.device})`
    if (DRY_RUN) {
      console.log(`[dry-run] → ${label}\n${JSON.stringify(payload, null, 2)}`)
      continue
    }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: 'normal',
        // Lets the push service collapse undelivered updates for the same month.
        ...(payload.tag ? { topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
      })
      console.log(`sent → ${label}`)
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        console.log(`expired → ${label}, removing`)
        dead.add(sub.endpoint)
      } else {
        console.error(`failed → ${label}: ${e.statusCode ?? ''} ${e.body ?? e.message}`)
      }
    }
  }
  return dead
}

async function loadWebPush() {
  if (DRY_RUN) return null
  const { default: webpush } = await import('web-push')
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT secrets.')
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return webpush
}

function commitState(head, deadEndpoints) {
  if (DRY_RUN) {
    console.log(`[dry-run] would set marker to ${head}, remove ${deadEndpoints.size} subscription(s)`)
    return
  }
  git('config', 'user.name', 'github-actions[bot]')
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
  for (let attempt = 0; attempt < 3; attempt++) {
    // Re-apply on top of the latest tip each attempt (the app may have just saved).
    const subs = readJson(SUBS_PATH, { subscriptions: [] })
    if (deadEndpoints.size) {
      writeJson(SUBS_PATH, { subscriptions: subs.subscriptions.filter((s) => !deadEndpoints.has(s.endpoint)) })
    }
    writeJson(STATE_PATH, { lastNotifiedSha: head, updatedAt: new Date().toISOString() })
    git('add', STATE_PATH, ...(existsSync(SUBS_PATH) ? [SUBS_PATH] : []))
    // `diff --quiet` succeeds only when nothing is staged.
    if (tryGit('diff', '--cached', '--quiet') !== null) return
    git('commit', '-m', 'Notifier state [skip ci]')
    if (tryGit('push') !== null) return
    git('reset', '--hard', 'HEAD~1')
    git('pull', '--rebase')
  }
  console.error('Could not record notifier state; the next run may repeat these notifications.')
}

// ---------- main ----------

async function main() {
  const subscriptions = readJson(SUBS_PATH, { subscriptions: [] }).subscriptions ?? []
  const webpush = await loadWebPush()

  if (process.env.TEST_MESSAGE) {
    const dead = await send(subscriptions, subscriptions, { title: 'Expense Tracker', body: process.env.TEST_MESSAGE }, webpush)
    if (dead.size) commitState(git('rev-parse', 'HEAD'), dead)
    return
  }

  const head = git('rev-parse', 'HEAD')
  const marker = readJson(STATE_PATH, {}).lastNotifiedSha
  const fallback = process.env.BEFORE_SHA && !/^0+$/.test(process.env.BEFORE_SHA) ? process.env.BEFORE_SHA : null
  const start = [marker, fallback].find((sha) => sha && tryGit('cat-file', '-e', `${sha}^{commit}`) !== null)
  // No known starting point (very first run): look at the latest commit only,
  // rather than announcing the whole history.
  const range = start ? `${start}..${head}` : `${head}^!`

  const { commits, byActor } = collectChanges(range)
  console.log(`range ${range}: ${commits.length} data commit(s), ${byActor.size} author(s)`)

  const settings = readJson('settings.json', { sections: [], categories: [] })
  const names = {
    section: (id) => settings.sections?.find((s) => s.id === id)?.name ?? 'section',
    category: (id) => settings.categories?.find((c) => c.id === id)?.name ?? 'category',
  }
  const contactsNow = new Map((readJson('ledger.json', { contacts: [] }).contacts ?? []).map((c) => [c.id, c.name]))

  const dead = new Set()
  for (const [actor, files] of byActor) {
    const payload = buildPayload(actor, files, names, contactsNow)
    if (!payload) continue
    // Everyone except whoever made the change. Unknown author (old app version,
    // edit on github.com) → tell everyone.
    const recipients = subscriptions.filter((s) => !actor || s.email.toLowerCase() !== actor)
    console.log(`${actor || '(unknown)'} → ${recipients.length} recipient(s)`)
    for (const endpoint of await send(subscriptions, recipients, payload, webpush)) dead.add(endpoint)
  }

  commitState(head, dead)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
