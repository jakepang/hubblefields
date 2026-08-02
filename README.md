# Hubble T5 Substructure Attendance

Project-specific workforce attendance app for CCCC-OBAYASHI JV — T5 Substructure.

## Stack

- Next.js App Router
- Drizzle ORM + libSQL (`data/t5.sqlite` locally, Turso in production)
- Session cookie auth (PBKDF2 passwords)

## Setup

Requires Node 22+ (see `.nvmrc`).

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000/signin](http://localhost:3000/signin).

### Seed admin

- Email: `admin@t5.local`
- Temporary password: `Admin12345!`
- Must change password on first login

### Phone access (LAN)

On the same Wi‑Fi as this Mac, open:

```text
http://10.9.90.176:3000/signin
```

Use a Supervisor account for field check-in. If the page does not load, allow incoming connections to Node/Next in macOS Firewall, and keep `npm run start` (or `npm run dev -H 0.0.0.0`) running.

```bash
npm run start -- -H 0.0.0.0 -p 3000
```


## Offline storage & photo upload

This is a **Next.js web app**. Flutter **Hive** is not used; the equivalent local store is **IndexedDB** (`idb`) with the same behaviours:

- Queue punches + photo blobs offline (`lib/offline/`)
- Sync status: `pending` / `uploading` / `synced` / `failed`
- Auto-sync on app start, on `online`, and every 60s
- Prune synced local photos when count exceeds **500**

Photos are compressed client-side to **≤ 2MB**, then uploaded via:

1. **Firebase Storage** (configure `NEXT_PUBLIC_FIREBASE_*`, use a Singapore / `asia-southeast1` bucket), with resumable uploads; or
2. Dev fallback **`/api/uploads/attendance`** when Firebase env is unset

Attendance API accepts `photoUrl` (preferred) or legacy `photoDataUrl`, validates GPS geofence, and binds the URL on the record. Session cookie **or** `Authorization: Bearer <session token>` is accepted.

Network helper: `lib/http.ts` (`apiRequest`) with timeout + retries.

## Roles

| Role | Capabilities |
|------|----------------|
| Project Admin | Invite/reset users, manage manpower, reports/CSV, check in/out |
| Supervisor (+ Safety Officer, Attendance Admin, Project Manager) | Check in/out, history, read manpower |
| Viewer | Read-only overview / history / manpower |

## Deploy (Vercel + Turso) — 1–2 week field trial

Buy a domain **you fully control** (Cloudflare Registrar / Namecheap / Porkbun). Avoid domains where another party must approve DNS.

### A. Accounts (one-time)

1. [Turso](https://turso.tech) — create DB in Singapore / closest region; copy URL + token  
2. [Vercel](https://vercel.com) — import this GitHub repo (or `npx vercel`)  
3. Optional but recommended: Firebase project + Storage bucket in `asia-southeast1` (photos)

### B. Domain DNS (after purchase)

In the domain’s DNS panel (same registrar is easiest):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `76.76.21.21` (Vercel) |
| CNAME | `www` | `cname.vercel-dns.com` |

Or in Vercel → Project → Settings → Domains → add `yourdomain.com` and follow their exact records.

Wait for DNS (often minutes, sometimes up to a few hours). HTTPS is automatic on Vercel.

### C. Environment variables (Vercel → Settings → Environment Variables)

```text
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_GEOFENCE_MODE=singapore
GEOFENCE_MODE=singapore
GEOFENCE_STRICT=false
GEOFENCE_LABEL=Your Company
GEOFENCE_ADDRESS=Singapore
COOKIE_SECURE=true
```

Plus Firebase `NEXT_PUBLIC_FIREBASE_*` if using photo Storage.

### D. Database setup (run once from your Mac)

```bash
export TURSO_DATABASE_URL=...
export TURSO_AUTH_TOKEN=...
SEED_MANPOWER=0 npm run db:setup
```

`SEED_MANPOWER=0` creates only `admin@t5.local` / `Admin12345!` (change on first login). Add real workers in the app.

Reset admin later: `npm run db:reset-admin` (same Turso env vars).

### E. Deploy

```bash
npx vercel --prod
```

`vercel.json` targets Singapore (`sin1`).

### F. Hand to the site team

1. Open `https://yourdomain.com/signin`  
2. Admin signs in → change password → invite Supervisor  
3. Add manpower → field Check In/Out with GPS + photo  

Photos on Vercel need Firebase; without it, uploads may appear to work then disappear after cold starts.

## Scripts

- `npm run db:migrate` — create tables
- `npm run db:seed` — admin (+ workers unless `SEED_MANPOWER=0`)
- `npm run db:reset-admin` — reset admin temporary password
- `npm run db:setup` — migrate + seed
- `npm run dev` — local development server
- `npm run build` / `npm start` — production build & serve
- `npm run smoke` — API end-to-end check (app must be running)
