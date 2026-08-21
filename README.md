# Expense Tracker

Mobile-first PWA for monthly salary & expense tracking (Sush + Khush), replacing a manual Apple Notes workflow. See [../PLAN.md](../PLAN.md) for the full design.

## How it works

- **Start a month** → enter both salaries → your template sections (from Settings) are created automatically, plus any unpaid carry-over items from last month.
- **Add expenses** under a section — category is a dropdown from Settings (no free text). Totals, remaining salary, and savings are always computed, never typed.
- **Pass-through (T)** — money that flows through a card but is reimbursed (e.g. Mobile Prachi). Shows on the card, excluded from your spend.
- **Carry to next month** — paid from savings, owed back; auto-appears in the next month you create.
- **Charts** — monthly category/section breakdown, Sush vs Khush, and financial-year (Apr–Mar) trends.

## Data storage

Two modes, chosen on first launch:

1. **GitHub sync** (recommended): data lives as JSON in a **private** GitHub repo you own (`settings.json`, `data/YYYY-MM.json`). Create the private repo, then a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) scoped to only that repo with **Contents: Read and write**. Every save is a git commit — free edit history. The token is stored in your browser's localStorage only.
2. **Local only**: everything in this browser's localStorage. No sync, zero setup.

## Development

```bash
npm install
npm run dev
```

## Deploying to GitHub Pages

1. Push this `app/` folder as a repo to GitHub (public repo for free Pages).
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.
4. On your iPhone, open the deployed URL in Safari → Share → **Add to Home Screen** to install it like an app.

Note: keep the **data** repo separate and **private** — this code repo is public.
