# OPs Finance Portal — React + Vite + Supabase

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Custom (stored in Supabase `accounts` table)
- **Email + Drive**: Google Apps Script (`doPost` only)
- **State**: Zustand + TanStack React Query
- **Charts**: Recharts
- **Hosting**: Vercel / Netlify (free)

---

## Quick Start

### Step 1 — Clone & Install
```bash
git clone <your-repo>
cd ops-finance
npm install
```

### Step 2 — Supabase Setup
1. Go to https://supabase.com → New Project
2. Open **SQL Editor** → paste contents of `supabase_schema.sql` → Run
3. Copy your **Project URL** and **anon public key** from Settings → API

### Step 3 — GAS Setup
1. Go to https://script.google.com → New Project
2. Paste contents of `Code.gs`
3. Update `DRIVE_FOLDER_ID` with your Google Drive folder ID
4. Deploy → **New Deployment** → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL

### Step 4 — Environment Variables
```bash
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

### Step 5 — Run Locally
```bash
npm run dev
# Open http://localhost:3000
# Default login: admin / admin123
```

### Step 6 — Build & Deploy
```bash
npm run build

# Deploy to Vercel (recommended)
npx vercel --prod

# Or Netlify
npx netlify deploy --prod --dir=dist
```

---

## Migrating Data from Google Sheets

### Export from GSheets
1. Open each sheet (RequestSheet, SbarSheet, StaffSheet, etc.)
2. File → Download → CSV

### Import to Supabase
1. Supabase Dashboard → Table Editor → Select table
2. Click **Import data** → Upload CSV
3. Map columns accordingly

### Column mapping reference:

**RequestSheet → requests table**
| GSheets | Supabase |
|---|---|
| Column A (ID) | req_id |
| Column B (Type) | type |
| Column C (Beneficiary) | beneficiary |
| Column D (Date) | date_req |
| Column E (Title) | title |
| Column F (Desc) | description |
| Column G (Amount) | amount |
| Column H (Uploader) | uploader_info |
| Column I (Ops Info) | ops_info |
| Column J (Fin Info) | fin_info |
| Column K (Status) | status |
| Column L (FileID) | file_id |
| Column M (ReqID) | req_id |
| Column N (Remarks) | remarks |

**StaffSheet → staff table**
| GSheets | Supabase |
|---|---|
| Column A (ID) | id |
| Column B (Last Name) | last_name |
| Column C (First Name) | first_name |
| Column E (Position) | position |
| Column F (Email) | email |
| Column G (Branch Code) | branch_code |
| Column H (Branch Name) | branch_name |
| Column I (Area) | area |
| Column J (Region) | region |
| Column K (Division) | division |
| Column L (Operation) | operation |

**BranchInfo → branches table**
| GSheets | Supabase |
|---|---|
| Column A | code |
| Column B | name |
| Column C | area (if available) |
| Column D | region |
| Column E | division |
| Column F | operation |
| Column G | email |

---

## Project Structure
```
ops-finance/
├── src/
│   ├── lib/
│   │   ├── supabase.js      ← Supabase client
│   │   ├── gas.js           ← GAS email + drive
│   │   └── utils.js         ← Shared utilities
│   ├── store/
│   │   ├── authStore.js     ← Auth state (Zustand)
│   │   └── uiStore.js       ← UI state (sidebar, dark mode)
│   ├── hooks/
│   │   ├── useRealtime.js   ← Supabase realtime
│   │   ├── useBranches.js
│   │   ├── useStaff.js
│   │   ├── useRequests.js
│   │   ├── useSbar.js
│   │   ├── useExpenses.js   ← IT + AT + Comms
│   │   ├── useAccounts.js
│   │   └── useDashboard.js
│   ├── components/
│   │   ├── layout/          ← Layout, Sidebar, TopBar
│   │   ├── shared/          ← Reusable components
│   │   └── dashboard/       ← Charts + Insights
│   └── pages/               ← All page components
├── supabase_schema.sql      ← Run this first in Supabase
├── Code.gs                  ← Deploy to Google Apps Script
└── .env.example             ← Copy to .env
```

---

## Features
- ✅ Dashboard with filters (Op/Div/Region/Area/Branch)
- ✅ Real-time updates via Supabase Realtime
- ✅ Request Letters CRUD + batch process
- ✅ SBAR / Budget Transfer
- ✅ IT / Aircon & Toilet / Comms Expenses
- ✅ Send Email with auto-suggest + Auto CC rules
- ✅ File upload to Google Drive via GAS
- ✅ Employee Directory with cascading filters
- ✅ User Account Management
- ✅ Audit Logs
- ✅ System Settings (maintenance mode + titles)
- ✅ Dark Mode
- ✅ Column sorting on all tables
- ✅ CSV Export
- ✅ Notification bell (realtime)
- ✅ Per-page Op/Div/Region/Area/Branch filters

---

## Default Login
```
Username: admin
Password: admin123
```
⚠️ Change immediately after first login!

---

## GAS CORS Note
If you get CORS errors calling GAS from React:
- The GAS deployment must be set to **Anyone** access
- React fetch to GAS works as a POST with no-cors mode
- GAS always returns JSON with `success: true/false`

To handle no-cors in development, update `gas.js`:
```js
async function callGAS(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors', // add this for CORS issues
    body: JSON.stringify(payload),
  })
  // With no-cors, response is opaque — use try/catch
}
```

---

## Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
# VITE_GAS_URL
```

Add `vercel.json` for SPA routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
