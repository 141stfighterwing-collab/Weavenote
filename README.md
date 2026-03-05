<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WeaveNote

AI-powered note workspace for capture, synthesis, project planning, and knowledge organization.

---

## 1) Versioning

WeaveNote follows **Semantic Versioning (SemVer)**.

- **Current app version:** `1.2.0` (from `package.json`)
- **Changelog:** see [`CHANGELOG.md`](./CHANGELOG.md)

Version format:

- `MAJOR` → breaking changes
- `MINOR` → backwards-compatible feature additions
- `PATCH` → backwards-compatible fixes

---

## 2) Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Local setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment variables in `.env.local` (recommended)
3. Start development server
   ```bash
   npm run dev
   ```
4. Build production bundle
   ```bash
   npm run build
   ```
5. Type-check/lint
   ```bash
   npm run lint
   ```

---

## 3) Environment Variables & Secrets

> ⚠️ Important: this repo currently includes fallback Firebase values in `config.ts`. For production, move all keys/config to environment variables and avoid hardcoded defaults.

### Required AI key

- `GEMINI_API_KEY` 
  - Used by `services/geminiService.ts`
  - Must be a plain Google AI API key string (not service-account JSON)

### Firebase config

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Optional/admin

- `ADMIN_SETUP_PASS`
  - Used by bootstrap admin login flow in auth service.

---

## 4) Which AI Model(s) WeaveNote Uses

WeaveNote uses **Google Gemini** through `@google/genai`.

Primary model routing (fallback order):

1. `gemini-3.1-pro-preview`
2. `gemini-3-flash-preview`

If the first model fails, the app retries with the second. Response format is constrained to JSON for structured note extraction/formatting.

---

## 5) APIs & External Services Used

1. **Google GenAI API**
   - Used for note structuring/synthesis.
2. **Firebase Authentication**
   - User auth/session.
3. **Firebase Firestore**
   - Cloud persistence for notes/folders/users.
4. **ipapi.co**
   - Fetches client IP + country metadata in auth telemetry.

---

## 6) Where Data/Keys Are Stored

### A) Browser Local Storage (client-side)

Examples of local keys used:

- UI preferences (`ideaweaver_theme`, `ideaweaver_darkmode`, `ideaweaver_reducedmotion`, etc.)
- AI usage and logs (`ideaweaver_usage_YYYY-MM-DD`, `ideaweaver_ai_logs`, `ideaweaver_error_logs`)
- Audit/system logs (`ideaweaver_audit_logs`, `ideaweaver_system_checkpoints`)
- Quick templates (`ideaweaver_quick_templates`)
- Traffic logs and last known client IP (`weavenote_traffic_logs`, `weavenote_last_ip`)

### B) Browser Session Storage (guest mode)

- `ideaweaver_guest_session` (guest notes)
- `ideaweaver_guest_folders` (guest folders)

### C) Firestore collections (authenticated mode)

- `users`
- `notes`
- `folders`

---

## 7) Project Directory Breakdown

```text
Weavenote/
├── App.tsx                     # Main app state, tab routing, filters, modal orchestration
├── components/
│   ├── NoteInput.tsx           # Input/editor and AI/manual note creation UX
│   ├── NoteCard.tsx            # Card rendering in grid mode
│   ├── NotebookView.tsx        # Notebook-style writing interface
│   ├── Sidebar.tsx             # Calendar, tags, templates, folders
│   ├── RightSidebar.tsx        # Context/status panel for expanded note data
│   ├── SettingsPanel.tsx       # Theme/cloud/admin/export settings
│   ├── AnalyticsModal.tsx      # Usage, awards, type distribution, persona analytics
│   ├── TrashModal.tsx          # Soft-deleted note recovery/deletion
│   └── ...
├── services/
│   ├── geminiService.ts        # AI request pipeline + usage accounting
│   ├── storageService.ts       # Local/session + Firestore persistence abstraction
│   ├── authService.ts          # Auth + admin controls + audit/suspension logic
│   ├── firebase.ts             # Firebase initialization
│   └── trafficService.ts       # Request telemetry and log helpers
├── types.ts                    # Shared application type contracts
├── config.ts                   # Runtime environment lookup + Firebase config
├── CHANGELOG.md
└── README.md
```

---

## 8) AGENTS.md / Agent Workflow Notes

This repository is used in an agent-assisted environment with instruction files (`AGENTS.md`) that may exist in parent or nested directories.

If you are using an AI coding agent:

- Always discover and follow the nearest in-scope `AGENTS.md` instructions.
- Nested `AGENTS.md` files override broader instructions.
- Keep commits atomic and tested.
- Include citations in final status updates when required by your automation runtime.

---

## 9) Full Functional Breakdown

## Core Views / Modes

- **Grid View**: card-based note browsing
- **Mindmap View**: graph-style relationship visualization
- **Notebook View**: long-form drafting and editing

## Tabs (Note Types)

WeaveNote supports these note types:

- `quick`
- `notebook`
- `deep`
- `code`
- `project`
- `contact`
- `document`

### Tab-by-tab intent

1. **Quick**
   - Fast capture of short ideas/tasks
   - Best with template-assisted workflows and rapid tagging

2. **Deep**
   - Longer thought processing and structured AI synthesis
   - Good for concepts, research, and strategic notes

3. **Project**
   - Structured project tracking
   - Supports project data: objectives, deliverables, milestones, timeline, and optional workflow graph

4. **Code**
   - Technical notes and snippet-heavy content
   - Useful for debugging logs, implementation notes, API references

5. **Notebook**
   - Free-form writing/canvas-like note authoring
   - Optimized for iterative drafting

6. **Document**
   - Formalized long-form content (specs, docs, reports)

7. **Contact**
   - Contact/relationship-oriented note records

---

## 10) Folders, Hashtags, Templates, Add-ons

### Folders

- Create/delete folders in Sidebar
- Drag-and-drop notes between folders
- Folder filters work with tag/date/search filters

### Hashtags / Tags

- Hashtags are extracted from text and normalized to lowercase
- Sidebar exposes popular tags for one-click filtering

### Templates (Quick References)

- Sidebar includes default + user-created workflow templates
- Templates are persisted in localStorage (`ideaweaver_quick_templates`)
- You can create templates with:
  - Title
  - Target note type
  - Workflow steps
- You can apply a template directly to prefill a new note input
- You can edit existing templates inline (Edit → Save/Cancel)

### Add-ons / Auxiliary Features

- **Analytics modal** (usage and persona insights)
- **Trash modal** (soft-delete restore/permanent delete)
- **Theme & accessibility controls** (dark mode, reduced motion, link preview toggle)
- **Image attachment support** (toggle-enabled)
- **Database export** in JSON/SQL/CSV formats (Settings → Administrator → Cloud Setup)

---

## 11) Database Design & How to Switch Databases

Current architecture uses a repository-style service layer (`services/storageService.ts`) that already centralizes read/write operations. This makes migration straightforward.

### Current persistence flow

- Guest users → sessionStorage
- Authenticated users → Firestore (`notes`, `folders`, `users`)

### Migration strategy to a different DB

To move from Firestore to another backend (Postgres, MongoDB, Supabase, etc.):

1. **Keep the UI/components unchanged**.
2. Replace internals of these functions in `storageService.ts`:
   - `loadNotes`
   - `saveNote`
   - `deleteNote`
   - `loadFolders`
   - `saveFolder`
   - `deleteFolder`
   - `syncAllNotes`
3. Keep return payloads aligned with `types.ts` interfaces.
4. Update auth integration in `authService.ts` if you also migrate auth provider.
5. Maintain export compatibility (`exportDatabase`) to preserve backup/restore behavior.

### Suggested adapter pattern

Create `services/databaseAdapter.ts` with an interface:

- `getNotes(userId)`
- `upsertNote(note, userId)`
- `removeNote(noteId, userId)`
- `getFolders(userId)`
- `upsertFolder(folder, userId)`
- `removeFolder(folderId, userId)`

Then inject Firestore/Postgres implementations without touching UI.

---

## 12) Backup & Export

Admin export supports:

- **JSON** (`WeaveNote_Database_<timestamp>.json`)
- **CSV** (`WeaveNote_Database_<timestamp>.csv`)
- **SQL** (`WeaveNote_Database_<timestamp>.sql`)

This allows moving notes into BI tools, relational databases, or archive systems.

---

## 13) Security Recommendations

1. Move all Firebase fallback values out of source control.
2. Restrict Firestore rules to authenticated ownership checks.
3. Scope Gemini API key and rotate periodically.
4. Add backend proxy/token exchange if you need stronger key protection.
5. Audit localStorage usage if handling sensitive content.

---

## 14) Development Notes

- Stack: React + TypeScript + Vite
- Styling: utility-class driven (Tailwind-style class patterns)
- Build output: `dist/`
- Start static build locally:
  ```bash
  npm run start
  ```

---

## 15) License

Add your license here (MIT/Apache-2.0/Proprietary) as needed.
