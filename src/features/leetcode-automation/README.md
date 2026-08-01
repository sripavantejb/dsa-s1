# LeetCode Streak Automation

Isolated module inside DSA Tracker that helps maintain a LeetCode streak via **reminders** (safe default) or optional **Playwright submissions** of solutions the user already saved.

> **Warning:** Automated submissions may violate LeetCode’s Terms of Service. Use only with your own account, at your own risk. The default engine never submits — it only notifies you.

## Features

| Area | What you get |
|------|----------------|
| Dashboard | Status, today’s run, next run, streak, success rate, recent activity |
| Solutions | CRUD library with search, filters, favorites, pagination |
| Scheduler | Time, timezone, rotation (random / sequential / specific), retry, pause |
| Logs | Result, timing, retries, failure reason, optional screenshot |
| Settings | Encrypted session connect, engine choice, notification channels |
| Worker | Pluggable engines behind `AutomationEngine` |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  TrackerApp  (tab: automation)                           │
│    └─ AutomationPanel                                    │
│         ├─ Dashboard / Solutions / Scheduler / Logs /    │
│         │  Settings UI                                   │
│         └─ hooks → /api/{automation,solutions,scheduler, │
│                          logs,session}                   │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  services/                                               │
│    automation · dashboard · settings · session ·         │
│    solution · log · notification                         │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  workers/                                                │
│    runner → engineFactory → ReminderEngine (default)     │
│                          └→ PlaywrightEngine (opt-in)    │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  models (MongoDB)                                        │
│    AutomationSettings · StoredSolution · SubmissionLog · │
│    BrowserSession   (+ existing User, Notification)      │
└──────────────────────────────────────────────────────────┘
```

The module lives under `src/features/leetcode-automation` so it can be disabled, swapped for reminder-only, or deleted without touching the sheet / revise / chat code.

## Installation

```bash
npm install
cp .env.example .env.local   # fill required vars (see below)
npm run dev
```

Open the **Automation** tab (flame icon) in the header.

### Optional Playwright engine

```bash
npm install playwright
npx playwright install chromium
```

Then set `AUTOMATION_ALLOW_PLAYWRIGHT=true` in `.env.local`.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | yes | Existing Mongo connection |
| `JWT_SECRET` | yes | Existing auth |
| `AUTOMATION_ENCRYPTION_KEY` | recommended | AES-256-GCM key for browser sessions (falls back to `JWT_SECRET`) |
| `AUTOMATION_CRON_SECRET` | recommended | Shared secret for scheduled ticks |
| `AUTOMATION_ALLOW_PLAYWRIGHT` | no | Must be `"true"` to enable browser submissions |
| `RESEND_API_KEY` | no | Email notifications via Resend |
| `AUTOMATION_EMAIL_FROM` | no | From-address for emails |

## Cron / scheduled runs

Call the automation tick every few minutes (e.g. Vercel Cron):

```http
POST /api/automation
x-cron-secret: <AUTOMATION_CRON_SECRET>
```

Example `vercel.json`:

```json
{
  "crons": [{ "path": "/api/automation", "schedule": "*/5 * * * *" }]
}
```

Note: Vercel Cron sends `GET` by default on some plans — if needed, wrap with a thin GET handler or use an external cron that POSTs with the secret header. The included `vercel.json` uses a route that accepts the secret on POST; for Vercel native crons you can also hit a dedicated cron proxy.

This repo’s `/api/automation` POST accepts `x-cron-secret`. For Vercel Cron (GET), configure an external scheduler (GitHub Actions / cron-job.org) to POST instead.

## Connecting a session (no passwords)

1. Log into LeetCode in your browser.
2. Export a Playwright `storageState` JSON (cookies + local storage) for `leetcode.com`.
3. Paste it into **Settings → Connect account**.
4. Passwords are rejected; the payload is encrypted with AES-256-GCM before storage.

## Engines

| Engine | Behavior |
|--------|----------|
| `reminder` (default) | Picks a stored solution and notifies you to submit manually |
| `playwright` | Loads encrypted session, opens the problem, pastes code, submits |

`engineFactory` always falls back to `ReminderEngine` if Playwright is requested but not available.

## API

All routes reuse existing JWT cookie auth + per-user rate limits.

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/automation` | Dashboard; actions (`run-now`, `enable`, `disable`, `pause`, `resume`); cron tick |
| GET/PUT | `/api/scheduler` | Read / update settings |
| GET/POST/DELETE | `/api/session` | Session status / connect / disconnect |
| GET/POST/PATCH/DELETE | `/api/solutions` | Solution library CRUD |
| GET/DELETE | `/api/logs` | List / clear submission logs |

## Folder map

```
src/features/leetcode-automation/
  constants.js
  types/
  hooks/          apiClient, useAutomation
  lib/            http, crypto, validation, rateLimit, time
  lib/playwright/ leetcodeClient
  services/       automation, dashboard, settings, session, solution, log, notification
  workers/        AutomationEngine, reminder, playwright, engineFactory, runner

src/components/leetcode/
  AutomationPanel, AutomationDashboard, SolutionsLibrary,
  SchedulerPanel, SubmissionLogs, AutomationSettings, ToSWarning, ui

src/lib/models/
  AutomationSettings, BrowserSession, StoredSolution, SubmissionLog

src/app/api/
  automation, solutions, scheduler, logs, session
```

## Security notes

- Never stores passwords.
- Session data encrypted at rest (`AUTOMATION_ENCRYPTION_KEY`).
- Decrypted storageState never returned by APIs.
- Every mutation validates input; rate-limited per user.
- Cron endpoint gated by shared secret.

## Disabling the module

1. Remove the Automation nav button / panel mount in `TrackerApp.jsx`, **or**
2. Keep UI but leave engine on `reminder` and never set `AUTOMATION_ALLOW_PLAYWRIGHT`.

Deleting `src/features/leetcode-automation` + related API routes + models + `components/leetcode` fully removes the feature.
