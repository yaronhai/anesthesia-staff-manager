# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anesthesia Workers Manager** — A full-stack Hebrew-language (RTL) web app for managing hospital anesthesia department staff. Data is persisted in Excel files (`.xlsx`) and JSON on disk — there is no database.

## Development Commands

### Backend (port 5000)
```bash
cd backend
npm install
npm run dev     # nodemon auto-reload
npm start       # production
```

### Frontend (port 3000)
```bash
cd frontend
npm install
npm run dev     # Vite dev server
npm run build   # output to dist/
npm run preview # preview production build
```

No test framework or linter is configured.

## Architecture

```
frontend/src/          React 18 + Vite
backend/server.js      Express REST API
backend/data/          File-based persistence
  workers.xlsx         All worker records
  config.json          Job titles & employment types
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`. The backend creates `data/` files on first write if they don't exist.

### Frontend component hierarchy
- **App.jsx** — global state, data fetching, orchestration
  - **WorkerList.jsx** — table + inline `WorkerDetail` modal
  - **WorkerForm.jsx** — add/edit modal; populates dropdowns from `config` prop
  - **AdminPanel.jsx** — manage job titles and employment types via API

### Backend data helpers (server.js)
- `readWorkers()` / `writeWorkers()` — read/write `workers.xlsx` via the `xlsx` package
- `readConfig()` / `writeConfig()` — read/write `config.json`; falls back to hardcoded Hebrew defaults if the file is absent

### API surface
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/api/workers` / `/api/workers/:id` | Worker CRUD |
| GET | `/api/config` | Fetch config |
| POST/DELETE | `/api/config/jobs` / `/api/config/jobs/:value` | Manage job titles |
| POST/DELETE | `/api/config/employment-types` / `/api/config/employment-types/:value` | Manage employment types |

## Known Bug

`WorkerForm.jsx` lines 68 and 75 reference undefined variables `JOBS` and `EMP_TYPES`. They should use the local `jobs` and `empTypes` variables derived from the `config` prop (already defined at lines 6–7). This causes a runtime crash when the form is opened.
