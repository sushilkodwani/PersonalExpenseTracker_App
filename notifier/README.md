# Change notifications — setup

When one person saves a change, everyone else who turned notifications on gets a
push, e.g. **"Khush updated Jul 2026 — + Zepto ₹500 — Sush · HDFC CC"**. Tapping it
opens that month.

```
phone saves ──► commit to data repo (with "Actor: <email>")
                     │
                     ▼
        GitHub Action in the DATA repo (this folder)
        waits ~90 s for more edits, diffs since last run,
        sends Web Push to everyone except the actor
                     │
                     ▼
        service worker on each phone shows the notification
```

The files in this folder are **not used by the app repo** — they get copied into
your private data repo.

## One-time setup

### 1. Generate a key pair (on your computer)

```bash
npx web-push generate-vapid-keys
```

Keep the output handy. The **public** key may be public; the **private** key must
only go into the data repo's secrets.

### 2. App repo (this public repo) — public key

GitHub → this repo → **Settings → Secrets and variables → Actions → Variables** →
New repository variable:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |

Then redeploy (push to `main`, or Actions → *Deploy to GitHub Pages* → Run workflow).

### 3. Data repo (private) — workflow, script and secrets

Copy into the data repo:

| From (this folder) | To (data repo) |
|---|---|
| `notify.yml` | `.github/workflows/notify.yml` |
| `notify/notify.mjs` | `notify/notify.mjs` |
| `notify/package.json` | `notify/package.json` |

Then data repo → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `VAPID_PUBLIC_KEY` | the public key (same as step 2) |
| Secret | `VAPID_PRIVATE_KEY` | the private key |
| Secret | `VAPID_SUBJECT` | `mailto:` + an email you own |
| Variable (optional) | `ACTOR_NAMES` | `{"first@example.com":"Sush","second@example.com":"Khush"}` — names shown in notifications; otherwise the email's first part is used |

If the run fails to push its state commit, check **Settings → Actions → General →
Workflow permissions** allows read and write.

### 4. On each phone

1. Open the app **from the Home Screen icon** (on iPhone, push only works there,
   iOS 16.4+).
2. Settings → **Notifications → Turn on**, and allow the prompt.

This writes the phone's subscription to `push/subscriptions.json` in the data repo.

### 5. Test

Data repo → **Actions → Notify on changes → Run workflow**. Every subscribed device
should get the test message.

## How it behaves

- **Batched:** a newer save cancels a run that's still waiting, so a burst of edits
  ends in one notification with the net result (add-then-delete disappears).
  Expect it ~1.5–3 minutes after the last edit.
- **Never notifies you about your own changes** — based on the email you
  connected with. Commits with no `Actor:` line (an older app version still
  cached on a phone, or an edit made on github.com) notify everyone.
- **Settings changes aren't announced**, only months and the People ledger.
- Expired subscriptions are removed automatically. The last processed commit is
  kept in `push/state.json`; neither file triggers the workflow.
- **Cost:** each run is about 2 billed Actions minutes (private repos get 2,000
  free/month).
- If a run is cancelled while it is already sending, the next run may repeat a
  notification.

## Testing the script locally

From a clone of the data repo, without sending anything:

```bash
DRY_RUN=1 BEFORE_SHA=<older commit sha> node notify/notify.mjs
```
