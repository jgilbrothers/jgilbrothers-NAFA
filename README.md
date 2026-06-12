# NAFA Ledger — Personal Financial Workstation

A secure, offline-first, professional personal financial intelligence workstation. NAFA Ledger is designed for individual auditing, transaction tracking, document organization, and balance analysis in family law, accounting, and general division of assets workflows.

## 🌟 Project Overview

NAFA Ledger facilitates transparent, self-contained financial review of multiple combined bank statements, credit card logs, and paystubs. It allows users to ingest records, resolve duplicates, verify category rules, split transaction line-items dynamically (such as separating groceries from individual medical lines), and compile beautiful, print-ready final timeline reports.

## 🚀 Key Features

- **Personal Statement Dashboard**: Visualizes high-level assets vs. liabilities, monthly flows, and dynamic net asset distribution cards.
- **Unified Document Registry**: Manages parsed bank files, paystubs, or receipts with direct audit linkage indexes to original statement materials.
- **Granular Category Splitting**: Divides credit/debit rows into flexible line-item slices (e.g. splitting an expensive department store bill into Groceries vs. Essential Kids items).
- **Automated Duplicate & Transfer Flags**: Flags potential internal transfers or duplicated records across statements with simple unilateral resolves.
- **Contextual Workstation Chat**: Interrogates local metrics and filters balances via natural queries.
- **Command Palette Action Center (`Ctrl+K`)**: Drills down into navigation routes or exports data with responsive keyboard shortcuts.
- **Encrypted Workspace Backup**: Restores or exports your entire spreadsheet state in reproducible flat JSON bundles.
- **Interactive Reports Sandbox**: Compiles print-ready summaries, Exhibits indices, chronological timeline breakdowns, and co-signatory sign-off forms.

---

## 🔒 Privacy & Offline-First Philosophy

NAFA Ledger is built from the ground up as a **100% offline-ready, client-side workstation**:
- **Data Privacy**: No transaction values, personal names, account numbers, or documentation contents are ever transmitted to external cloud systems. All records live strictly within the sandbox environment of your browser storage.
- **No Heavy Backends**: Entirely client-contained React state leveraging persistent browser `localStorage`.
- **Local Analytics**: Chronological analysis, transfer detection, duplicate resolution, and visual chart rendering happen instantly inside the client browser.

---

## 🛠️ Installation & Setup

Ensure you have Node.js (v18+) and npm installed on your machine.

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd nafa-ledger

# Install required npm packages
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Open `.env` and configure appropriate overrides:
```env
# Optional: Setup Google Gemini API Key for smart reasoning (otherwise uses rich local templates)
GEMINI_API_KEY="YOUR_API_KEY"

# Optional: Override the brand name displayed in header
VITE_APP_NAME="Nafa Ledger"
VITE_APP_VERSION="1.0.0"
```

### 3. Local Development Start
```bash
# Start local Vite development server
npm run dev
```
Open browser to `http://localhost:3000` to interact with your workstation sandbox.

### 4. Code Quality & Formatting
Verify typescript files compile cleanly:
```bash
npm run lint
```

### 5. Build for Production
To output the static distribution package:
```bash
npm run build
```
This compiles the application assets and deposits them into the `dist/` workspace folder.

---

## 📁 Project Structure

```
nafa-ledger/
├── public/                 # Static public assets
│   ├── manifest.json       # PWA Application manifest configs
│   └── sw.js               # Offline Service Worker shell logic
├── src/
│   ├── assets/             # Internal styles or typography elements
│   ├── components/         # Modular interactive workstation interfaces
│   │   ├── AccountsView.tsx
│   │   ├── AiAnalysisWorkspace.tsx
│   │   ├── DashboardView.tsx
│   │   ├── DocumentsView.tsx
│   │   ├── LedgerView.tsx
│   │   ├── ReportsView.tsx
│   │   ├── ReviewCorrectionsQueue.tsx
│   │   ├── RulesManager.tsx
│   │   └── SettingsView.tsx
│   ├── data/
│   │   └── mockData.ts     # Rich default bank statement seed sets
│   ├── utils/
│   │   ├── aiAnalysisEngine.ts  # Fallback rule narrative builder & Gemini interface
│   │   ├── dataEngine.ts        # Duplicate checking & transfer matching logic
│   │   └── persistence.ts       # Secure JSON backup serialization formats
│   ├── App.tsx             # Main router and controller state
│   ├── main.tsx            # React application entry-point
│   └── types.ts            # Global TypeScript interface definitions
├── .env.example            # Deployment environment parameters reference
├── .gitignore              # Ignored folder settings for clean git history
├── package.json            # Node.js project configuration file
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configurations and HMR rules
```

---

## 🚀 Cloudflare Pages Deployment Instructions

Since NAFA Ledger is a self-contained, statically built Single-Page Application (SPA), it is highly optimized for serverless, zero-maintenance hosts like **Cloudflare Pages**, **GitHub Pages**, or **Netlify**.

### Deploying via Cloudflare Dashboard
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Compute (Workers) > Pages**.
2. Click **Create page** and hook up your project GitHub repository.
3. Choose the build settings:
   - **Framework Preset**: `Vite` (or `None`)
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
4. Under **Environment variables (advanced)**, add:
   - `VITE_APP_NAME` = `"Nafa Ledger Workstation"`
   - `VITE_APP_VERSION` = `"1.0.0"`
   - `GEMINI_API_KEY` = (`Optional: Your private API Key if activating smart cloud analysis`)
5. Click **Save and Deploy**. Cloudflare is now prepared to auto-compile and republish every time you push edits onto your target main branch.

---

## 🧠 Optional Gemini Integration Guide

NAFA Ledger includes an **optional** enhancement layer linking to Google Gemini AI models to provide sophisticated financial audit observations, anomalies descriptions, and custom summaries.

### Dynamic Client-Isolation Loop
1. When a `GEMINI_API_KEY` is not provided, NAFA Ledger defaults to the built-in **Local baseline narrative engines**, analyzing categories, average billing cycles, duplicate risks, and timelines entirely in the browser using precalculated state.
2. When a valid `GEMINI_API_KEY` holds a value, the query-context analyzer bundles the local precalculated mathematics metrics and prompts the lightweight `gemini-3.5-flash` model which generates highly coherent, customized insights without revealing raw database schemas.

---

## 📁 Backup & Restore System
- **Download Workspace Backup (`Ctrl+S`)**: Instantly gathers active ledger state, accounts tables, manual override logs, and chronological audits, packing them into an encrypted single-file `.json` backup.
- **Restore Workspace**: Uploading a backup file parses, verifies the metadata structure, and hot-swaps browser database pools instantly cleanly.

---

## ⚠️ Known Limitations
- **PDF Generation Layout limits**: To avoid external API leakage, PDF compiled reports use native HTML window printing routines rather than external servers. Users must click "Save as PDF" relative to host operating systems inside the browser.
- **LocalStorage Storage Caps**: Browser standard limits allow up to 10MB of indexed values. For databases exceeding 25,000 transaction rows, utilize the `Backup Workspace JSON` feature to safely archive historical years.

---

## 📈 Future Roadmap
- **Wasm OCR Engine Support**: Integrate fully offline WebAssembly optical recognition parses for scanned statement JPEG/PDF objects.
- **Bento Heatmaps Grid**: Interactive weekly budget calendars indicating peak spending dates.
- **Crypto Asset Suffix Matching**: Linking decentralized wallet indices into unified ledger timelines.
