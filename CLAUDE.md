# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Guidelines

### Code Style
- Plain React with hooks (no state management library)
- Hebrew strings throughout UI (RTL support)
- Consistent naming: camelCase for variables, PascalCase for components
- No linter or formatter configured; manual code quality
- **Mobile-first responsive design**: Every new UI element must be fully usable on mobile screens in both portrait and landscape orientations. Use CSS media queries in `.module.scss` files, flexible layouts (flexbox/grid), and avoid fixed pixel widths that break on small screens.
- **No inline styles**: All styling must go in `.module.scss` or `.scss` files. Never use `style={{}}` attributes in JSX.
- **SCSS only**: All styling files must use `.scss` extension. Never create `.css` files; convert any existing `.css` files to `.scss`.

### Architecture
- **Backend**: Single-file Express app (server.js, 700+ lines) with PostgreSQL database
- **Frontend**: React 18 + Vite, tab-based UI without routing
- **Database**: PostgreSQL; schema initialized on startup via db.js
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

### Data Management
- **No hardcoded business data**: All business data (job titles, employment types, special days, site groups, shift types, etc.) must live in the database and be served via `/api/config`. Never hardcode business values in source files.

### Conventions
- **Date Format**: All dates displayed in the UI must use `dd/mm/yyyy` format. Never display dates as `yyyy-mm-dd` or any other format to the user.
- **Name Order**: Person names must always appear as family name followed by first name (שם משפחה לפני שם פרטי) throughout the entire project — in lists, cards, headers, modals, and confirmation messages.
- ID Number as Username: Worker's `id_number` becomes login username
- Worker ↔ User Sync: Editing worker auto-updates linked user
- Shift Types: `morning`, `evening`, `oncall`
- Preference Types: `can`, `prefer`, `cannot`
- Hebrew Defaults: Job titles, employment types, honorifics seeded in Hebrew
- No Soft Deletes: All deletions permanent
- Port: Backend on 5001 (not 5000 as previously documented)
- **Language mirroring**: If the user writes in Hebrew, respond in Hebrew. If in English, respond in English.

Potential pitfalls:
- Hardcoded JWT secret; use .env for production
- Email config required for password reset; fails silently if missing
- No form validation on frontend; relies on backend
- Stale data possible if config changes during modal use

## Known Issues
- `WorkerForm.jsx` lines 68 and 75 reference undefined variables `JOBS` and `EMP_TYPES`. Use local `jobs` and `empTypes` from `config` prop.
- Security: No rate limiting on auth endpoints
- Data: Direct DB edits bypass sync logic
