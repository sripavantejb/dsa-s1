# DSA Tracker

Next.js + MongoDB Atlas tracker for Tej & Hafsa — sheet, streaks, leaderboard, live toasts.

## Logins

| User  | Password  |
|-------|-----------|
| tej   | tej@dsa   |
| hafsa | hafsa@dsa |

## Local

```bash
npm install
cp .env.example .env.local   # then fill MONGODB_URI + JWT_SECRET
npm run dev
```

Open http://localhost:3000

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables:
   - `MONGODB_URI` — your Atlas connection string (database `dsa-tracker`)
   - `JWT_SECRET` — any long random string
4. In Atlas → Network Access, allow `0.0.0.0/0` (or Vercel IPs)
5. Deploy

Root directory stays `/` (this folder is the Next.js app).

`.env.local` is gitignored — never commit secrets.
