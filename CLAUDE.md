# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Guidelines

### Code Style
- Plain React with hooks (no state management library)
- Hebrew strings throughout UI (RTL support)
- Consistent naming: camelCase for variables, PascalCase for components
- No linter or formatter configured; manual code quality

### Architecture
- **Backend**: Single-file Express app (server.js, 700+ lines) with SQLite database
- **Frontend**: React 18 + Vite, tab-based UI without routing
- **Database**: SQLite with WAL mode; migrations auto-run on startup
- **Auth**: JWT-based with bcrypt hashing; worker creation auto-syncs user accounts
- **Data Flow**: App.jsx orchestrates global state; components handle UI logic

Major components:
- Workers management (CRUD with auto-user creation)
- Shift requests (calendar-based preferences)
- Admin panel (config management)
- Auth flow (login, password reset via email)

### Build and Test
```bash
# Backend (port 5001)
cd backend && npm install && npm run dev    # nodemon auto-reload
npm start                                    # production

# Frontend (port 3000)
cd frontend && npm install && npm run dev   # Vite dev server
npm run build                               # output to dist/
npm run preview
```

No test framework configured. Agents should run build commands to validate changes.

### Conventions
- ID Number as Username: Worker's `id_number` becomes login username
- Worker ↔ User Sync: Editing worker auto-updates linked user
- Shift Types: `morning`, `evening`, `oncall`
- Preference Types: `can`, `prefer`, `cannot`
- Hebrew Defaults: Job titles, employment types, honorifics seeded in Hebrew
- No Soft Deletes: All deletions permanent
- Port: Backend on 5001 (not 5000 as previously documented)

Potential pitfalls:
- Hardcoded JWT secret; use .env for production
- Email config required for password reset; fails silently if missing
- No form validation on frontend; relies on backend
- Stale data possible if config changes during modal use

## Known Issues
- `WorkerForm.jsx` lines 68 and 75 reference undefined variables `JOBS` and `EMP_TYPES`. Use local `jobs` and `empTypes` from `config` prop.
- Security: No rate limiting on auth endpoints
- Data: Direct DB edits bypass sync logic
