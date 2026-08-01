# DSA Tracker

Next.js + MongoDB Atlas tracker for Tej & Hafsa — sheet, streaks, leaderboard, live toasts, revision, and an optional **LeetCode Streak Automation** module.

## Logins

| User  | Password  |
|-------|-----------|
| tej   | tej@dsa   |
| hafsa | hafsa@dsa |

## Local

```bash
npm install
cp .env.example .env.local   # then fill MONGODB_URI + JWT_SECRET (+ automation vars if used)
npm run dev
```

Open http://localhost:3000

## LeetCode Streak Automation

Isolated feature (header tab **Automation** / flame icon). Safe default is **reminder-only** — it never submits to LeetCode unless you explicitly enable the Playwright engine.

Full docs, architecture diagram, env vars, and cron setup:

→ [`src/features/leetcode-automation/README.md`](./src/features/leetcode-automation/README.md)

Required for session encryption / scheduling:

- `AUTOMATION_ENCRYPTION_KEY`
- `AUTOMATION_CRON_SECRET`

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables:
   - `MONGODB_URI` — your Atlas connection string (database `dsa-tracker`)
   - `JWT_SECRET` — any long random string
   - `AUTOMATION_ENCRYPTION_KEY` / `AUTOMATION_CRON_SECRET` — if using automation
4. In Atlas → Network Access, allow `0.0.0.0/0` (or Vercel IPs)
5. Deploy

Root directory stays `/` (this folder is the Next.js app).

`.env.local` is gitignored — never commit secrets.
