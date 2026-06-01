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
- **Draggable modals**: Every modal/popup window must support drag-and-drop repositioning. Use the pattern from `DailyRoomView.jsx` (`site-detail-modal`): track drag state with `useRef` + `useState(null)` for position, add `onMouseDown` to the modal header to start dragging, listen to `mousemove`/`mouseup` on `window`, apply `top`/`left` inline when dragged (overriding the centered CSS), and switch the overlay to `form-overlay--transparent` while a position is set so it doesn't block the view. Reset position to `null` when the modal closes or reopens.
- **Resizable modals (Windows-style)**: Every modal that benefits from flexible sizing must support resizing from all 8 directions (4 edges + 4 corners), exactly like Windows. Reference implementation: the worker availability modal in `DailyRoomView.jsx`. Pattern:
  1. State: `const [waRect, setWaRect] = useState({ top: null, left: null, width: W, height: H })` and `const waModalRef = useRef(null)`.
  2. `startWaResize(e, dir)` — on `mousedown` on a handle, capture `rect = modal.getBoundingClientRect()`, then on `mousemove` compute new `width`/`height`/`top`/`left` depending on which edges `dir` (e.g. `'nw'`, `'se'`, `'n'`, `'e'`…) contains. West/north edges must update position as well as size. Enforce min-width/min-height. Call `setWaRect(...)` on each move event.
  3. `startWaDrag(e)` — on `mousedown` on the header, compute offset from modal's current `getBoundingClientRect()` and update `top`/`left` on `mousemove`.
  4. Modal style: `position: fixed; width: waRect.width; height: waRect.height;` plus `top`/`left`/`transform:none` when `waRect.top !== null`.
  5. Overlay: `form-overlay--transparent` once the modal has been moved/resized (i.e. `waRect.top !== null`), otherwise standard `form-overlay`.
  6. JSX: render 8 `<div className="wa-resize-handle wa-resize-handle--{dir}">` siblings inside the modal root. CSS for handles lives in `App.scss` under `.wa-resize-handle` with per-direction variants (`&--n`, `&--ne`, etc.) that set absolute positioning, size (≈5px for edges, 10px for corners), and the matching `cursor` value (`n-resize`, `ne-resize`, …).
- **Professional modal appearance**: Every new modal/popup must have a polished, professional look: a styled header with title + close button, a clear body area, and a footer with action buttons. Use `box-shadow: 0 8px 32px rgba(0,0,0,0.18)`, `border-radius: 12px`, and a subtle header background (e.g. `#f8fafc` or a light brand color). Buttons must follow the project's `btn-primary` / `btn-secondary` classes. Never use bare browser-default form elements without styling.
- **Always-on-top modals**: A modal that must remain in front of all other windows must use `z-index: 99999` on the modal element and `z-index: 99998 !important` on its overlay wrapper. Add a unique CSS class to the overlay (e.g. `worker-avail-overlay`) and define these values in `App.scss`. The project's standard overlays top out at 10000–10001, so 99998/99999 guarantees the window is never obscured.
- **Compact modal content**: Modal interiors must use minimum spacing and maximum density. Concretely: header padding ≤ 0.5rem, body padding ≤ 0.5rem, gap between sections ≤ 0.4rem, row padding ≤ 0.2rem vertical, font sizes 0.7–0.82rem for body text. Avoid decorative whitespace — every pixel of space must earn its place. The worker availability modal in `DailyRoomView.jsx` / `App.scss` (`.worker-avail-*`) is the reference for correct density.

- **Help guide updates**: After every significant project change (new feature, changed workflow, new UI element), update `frontend/src/components/helpTranslations.js` in **all 5 languages** (he, en, ar, es, fr) and update `HelpModal.jsx` to render any new fields.

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
- **Time Format**: All times displayed in the UI must use 24-hour format (HH:MM). Never use 12-hour AM/PM format. When using `toLocaleTimeString`, always pass `hour12: false`. Use the `formatTime24()` utility in `DailyRoomView.jsx` as a reference.
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
