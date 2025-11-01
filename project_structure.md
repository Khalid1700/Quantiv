# 🧱 Project Structure for Quantiv (ABT)

This document outlines the current repository layout and the planned modular UI architecture. The tree excludes `node_modules/`, build outputs (e.g., `dist/`), and other transient folders.

## Current Structure (SQLite-only)

```
.
├── Documents/
│   └── Excel_Business_Toolkit_Template.xlsx
├── main.js
├── package-lock.json
├── package.json
├── preload.js
├── project_structure.md
├── public/
│   ├── app.js
│   ├── icons/
│   │   ├── app-16.png
│   │   ├── app-32.png
│   │   ├── app-48.png
│   │   ├── app-64.png
│   │   ├── app-128.png
│   │   ├── app-256.png
│   │   ├── app-512.png
│   │   ├── app.icns
│   │   ├── app.ico
│   │   └── app.png
│   ├── index.html
│   ├── splash.html
│   └── utils/
│       └── dbManager.js
├── server/ (removed)
│   └── —
└── tools/
    └── make-icons.js
```

## Planned Modular Additions (upcoming implementation)

These folders/components will be added to structure the UI and logic cleanly.

- `public/components/`
  - `Sidebar.js` — navigation
  - `Card.js` — KPI tiles
  - `Chart.js` — Chart.js wrapper
  - `Table.js` — inventory table (search/filter/pagination)
  - `Modal.js` — dialogs for CRUD
  - `Toolbar.js` — top actions

- `public/views/`
  - `DashboardView.js`
  - `InventoryView.js`
  - `InvoicesView.js`
  - `ReportsView.js`
  - `FeasibilityView.js`

- `public/styles/`
  - `theme.css` — color tokens, typography, shadows
  - `components.css` — reusable component styles

- `public/assets/`
  - `images/` — branding, illustrations
  - `fonts/` — Inter/Poppins

- `public/state/`
  - `store.js` — lightweight state, event bus, debounced autosave

- `public/utils/`
  - `storage.js` — settings & preferences access via IPC
  - `formatters.js` — currency/date helpers
  - `charts.js` — chart configs and gradients
  - `pdf.js` — jsPDF helpers (invoices/packing lists)
  - `barcode.js` — barcode & serial generation

## IPC and SQLite Integration (current)

- Database:
  - `get-db-path`, `db:create`, `db:listDocs`, `db:setPath`
- Inventory:
  - `db:inventory:list`, `db:inventory:add`, `db:inventory:update`, `db:inventory:delete`
- Settings:
  - `db:settings:get`, `db:settings:set`
- Invoices:
  - `db:invoices:list`, `db:invoices:create`
- Templates and Dashboards:
  - `open-templates`, `set-templates-dir`, `update-dashboards`
- AI Key:
  - `ai:getKey`, `ai:setKey`

## Notes

- The dashboard adopts the new visual identity (primary gradient `#00B894 → #38BDF8`, background `#0B0F16`, text `#E2E8F0`, glass panels).
- All operations are offline-first, persisted in SQLite via `better-sqlite3`.
- Packaging uses `electron-builder` with icons from `public/icons/`.


- 📁 Documents
  - 📄 Excel_Business_Toolkit_Template.xlsx
- 📄 main.js
- 📄 package.json
- 📄 package-lock.json
- 📄 preload.js
- 📄 project_structure.md
- 📁 **public**
  - 📄 app.js
  - 📄 index.html
  - 📄 splash.html
 
