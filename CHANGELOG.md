# Changelog

All notable changes to the WSH (WeaveNote Self-Hosted) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.4.8] - 2026-06-15

### Added
- **Resizable images in notes** — Images inserted into notes now support an explicit initial width control for URL-based inserts and are rendered with resize-friendly styling so users can make images smaller or larger directly inside note content.

### Changed
- **Image attachments in notes are compressed client-side before insertion** — Large attached images are resized down to a saner maximum dimension and re-encoded before being embedded into note HTML, reducing note payload size and making note load/save/render faster.
- **Version bumped to 4.4.8** for the image-handling performance and usability patch.

---

## [4.4.7] - 2026-06-15

### Security
- **CRITICAL FIX — JWT runtime now refuses insecure fallback secrets** — `src/lib/auth.ts` no longer falls back to the hardcoded placeholder `change-me-in-production`. The app now throws immediately if `JWT_SECRET` is missing or still set to the default placeholder value, preventing accidental deployment with a forgeable session secret.
- **CRITICAL FIX — Admin bootstrap seeding no longer falls back to `admin` / `admin123` defaults** — `docker-entrypoint.sh` now requires explicit `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_EMAIL`, and `ADMIN_DEFAULT_PASSWORD` values for first-run admin seeding when no admin exists. If no admin exists and the bootstrap variables are not fully set, the entrypoint refuses to seed an insecure default account.

### Changed
- **Bootstrap behavior tightened** — If an admin or super-admin already exists, the entrypoint now skips bootstrap seeding cleanly without depending on hardcoded default credentials.
- **Version bumped to 4.4.7** for the first security-hardening patch in the WeaveNote public exposure remediation sequence.

---

## [4.4.6] - 2026-06-12

### Added
- **Algorithmic synthesis for Generate Tags** — The `/api/synthesis` route now supports a deterministic local tag-generation pipeline that strips editor HTML, removes stop words, ranks repeated keywords, detects technical terms/acronyms, and returns 4–8 relevant hashtags as a JSON array without requiring an LLM backend.
- **Algorithmic synthesis for Create Outline** — The `/api/synthesis` route now supports a deterministic local outline generator that scores sentences, extracts high-signal topics, and returns a structured markdown outline with `Overview`, `Key Topics`, and `Suggested Next Steps` sections when enough content is available.

### Changed
- **Hybrid synthesis architecture** — `tags` and `outline` now run as local algorithms and return `provider: local-algorithm` with `tokensUsed: 0`, while `summarize`, `expand`, and `improve` remain LLM-backed.
- **Daily AI limit scope tightened** — The AI daily limit now applies only to LLM-backed synthesis actions, not local algorithmic actions.
- **README updated** — Documented the hybrid synthesis behavior, local algorithm path, API response differences, and new version references.
- **Version bumped to 4.4.6** across core files and deployment metadata.

---

## [4.4.6] - 2026-04-21

### Fixed
- **CRITICAL FIX — Docker build fails silently (npm install error hidden by pipe)** — The Dockerfile piped `npm install` output through `tail -5` (`npm install 2>&1 | tail -5`). In shell, the exit code of a pipeline is the exit code of the LAST command, so when `npm install` failed (non-zero exit), `tail`'s success (exit 0) replaced it. The build continued with ZERO packages installed, causing every subsequent step to fail with confusing errors. Fixed by removing all `| tail` pipes on `npm install` commands so errors are visible and the build stops immediately on failure.
- **CRITICAL FIX — npm install fails: `react-devtools-inline@4.4.1` yanked from npm** — The `package-lock.json` pinned `react-devtools-inline` to version 4.4.1, which was yanked/unpublished from npm. This transitive dependency (of `@codesandbox/sandpack-react`) caused `npm install` to fail with `ETARGET No matching version found`. The lock file has been regenerated, resolving to `react-devtools-inline@4.4.0`.
- **docker-entrypoint.sh used non-existent prisma path** — The entrypoint still referenced `node /app/node_modules/prisma/build/index.js` (from the v4.4.2 fix) which doesn't exist in Docker. Updated to use `./node_modules/.bin/prisma` (standard npm bin path) consistent with the Dockerfile.

### Changed
- **Regenerated `package-lock.json`** — Old lock file had a yanked dependency version. Fresh generation resolves to valid versions.
- **Version bumped to 4.4.6** across all core files.

---

## [4.4.3] - 2026-04-21

### Fixed
- **Docker build fails with stale cache — prisma binary not found** — The v4.4.2 fix used `node node_modules/prisma/build/index.js generate` which is an internal path within the prisma npm package. When Docker uses stale layer cache (from a previous build), this file may not exist, causing `MODULE_NOT_FOUND` error. Fixed by:
  - Using `./node_modules/.bin/prisma generate` (the standard npm bin wrapper path)
  - Adding a self-healing fallback: if the prisma binary is missing from node_modules, the build automatically runs `npm install prisma@^6` before generating. This makes the Docker build resilient to stale cache issues without requiring `--no-cache`.

### Changed
- **Version bumped to 4.4.3** across all core files.

---

## [4.4.2] - 2026-04-21

### Fixed
- **CRITICAL FIX — Docker build failure (Prisma v7.x incompatibility)** — The Dockerfile used `npx prisma generate` which downloads the latest Prisma CLI from npm. Since Prisma 7.x was released, `npx` downloads v7.7.0 which has breaking changes: the `datasource.url` property is no longer supported in schema files. This caused the Docker build to fail with error P1012 during `prisma generate`. Fixed by replacing `npx prisma generate` with `node node_modules/prisma/build/index.js generate` (direct node invocation) in both the builder and runner stages of the Dockerfile. This ensures the locally-installed Prisma v6.x CLI is always used, never a downloaded v7.x.

### Changed
- **Version bumped to 4.4.2** across all core files.

---

## [4.4.1] - 2026-04-21

### Fixed
- **New notes now respect active folder** — Creating a Quick, Code, Deep, or any note type while a folder is selected automatically assigns the note to that folder (was hardcoded to null)

### Added
- **Drag-and-drop notes into folders** — Note cards in the grid are now draggable; drag any note onto a folder pill or sidebar folder to move it
- **Drop targets on folder pills** — NotesGrid folder filter pills accept dragged notes with visual feedback (dashed border highlight)
- **Drop targets on sidebar folders** — Folders component in the left sidebar accepts dragged notes
- **"Drop on a folder to move" hint** — Animated hint text appears when dragging a note
- **Folder badge on note cards** — Notes assigned to a folder show a small folder name badge in the card header
- **Drag handle on note cards** — Subtle grip icon appears on hover to indicate cards are draggable

### Technical
- Uses existing `updateNote(id, { folderId })` store function and `PUT /api/notes` endpoint (no new API needed)

---

## [4.4.0] - 2026-04-21

### Added
- **Document folder organization** — Documents can now be organized into folders, just like Notes
- **Folder filter bar** in Library tab — Filter documents by folder with clickable pills (All, Unfiled, or any folder)
- **Folder assignment dropdown** — Move any document to a folder or unfile it via the folder button on each document row
- **Drag-and-drop to folders** — Drag documents from the list and drop them onto folder pills to organize quickly
- **Inline folder creation** — Create new folders directly from the Library tab with the + button
- **PUT /api/documents/[id]** endpoint — Update document metadata (folder assignment, title) via API
- **Folder ID index** on Document model for fast folder-based queries

### Changed
- **Prisma schema** — Added `folderId` relation to Document model, added `documents` to Folder model
- **GET /api/documents** — Now supports `?folderId=` query param for folder filtering, returns `folder` relation
- **DELETE /api/folders** — Now also unlinks documents when a folder is deleted
- **Document records** now include `folderId` and `folder` fields in API responses
- **Version bumped to 4.4.0** across all 14 core files

### Technical
- Database migration required: `npx prisma db push` to apply new `folderId` column on `Document` table

---

## [4.3.9] - 2026-04-21

### Fixed
- **PDF embedding in Documents tab** — Fixed blob URL memory leak in DocumentViewer that prevented proper cleanup of object URLs
- **View button always visible** — Documents can now be viewed/embedded regardless of text extraction status; View button shows for all viewable file types (PDF, images, text)
- **Processing failure resilience** — Documents with failed text extraction are now marked as 'ready' for viewing instead of 'error', with an informational message
- **Image file upload support** — Server upload whitelist now includes PNG, JPG, JPEG, GIF, WEBP image types (previously accepted by client but rejected by server)
- **Binary file handling** — Image and binary file types (DOCX, DOC, RTF) now skip text extraction entirely, preventing processing errors
- **File serving MIME types** — Added image MIME type mappings (image/png, image/jpeg, image/gif, image/webp) to file serving route
- **Loading state improvements** — Enhanced document viewer loading states with progress messages for better UX during file fetch

### Changed
- **Version bumped to 4.3.9** across all 14 core files.

---

## [4.3.8] - 2026-04-21

### ✨ Added

- **Things to do Today — Manual Todo Checklist** — A new interactive todo checklist component in the right sidebar that lets users manually enter tasks, check them off when done, and clear completed items. Features:
  - Text input with Enter-to-add and Escape-to-cancel
  - Checkbox toggle (amber empty → green completed) for each item
  - Completed items shown with strikethrough and reduced opacity
  - Progress bar showing completion percentage (amber→green gradient)
  - "Clear done" button to remove all completed items at once
  - Delete button on hover for individual items
  - Auto-reset at midnight (todos from previous days are automatically cleared)
  - localStorage persistence (`wsh-todo-today` key, `wsh-todo-date` for day tracking)
  - Empty state with icon and instructional text
  - Amber (#F59E0B) color theme with `ListTodo` icon
  - Scrollable list with max-height to prevent sidebar overflow
  - `crypto.randomUUID()` fallback for non-secure contexts

### 🔧 Changed

- **Version bumped to 4.3.8** across all 14 core files: `package.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `test-env.sh`, `test-env.ps1`, `/api/health`, `/api/admin/system`, `CHANGELOG.md`, `README.md`.

- **RightSidebar layout updated** — The new `TodoChecklist` component is now the second panel in the right sidebar (after Live Clock, before Today's Things), giving it prominent placement.

---

## [4.3.6] - 2026-04-17

### ✨ Added

- **Automated ENV persistence test scripts** — Added `test-env.sh` (Linux/macOS) and `test-env.ps1` (Windows) that verify the full lifecycle of environment variable persistence. The scripts run 10 automated checks:
  1. Health check (app running, version, database)
  2. Login & JWT authentication with admin credentials
  3. AI provider availability baseline
  4. Save test API key via POST /api/admin/env
  5. Verify key active in memory via GET /api/synthesis
  6. Verify key exists on disk (runtime.env inside container)
  7. Soft restart the app container
  8. Verify key persists after restart (GET /api/synthesis)
  9. Verify runtime.env still on disk after restart
  10. Admin ENV GET endpoint confirms key is configured
  The test script automatically cleans up the test key at the end. Usage: `chmod +x test-env.sh && ./test-env.sh` or `.\test-env.ps1`. Configurable via env vars: `ADMIN_USER`, `ADMIN_PASS`, `TEST_KEY`, `WSH_PORT`.

- **Test ENV example file (`.env.test`)** — Added a comprehensive `.env.test` file containing example/test values for every environment variable. This file is for reference and testing purposes only — not for production use. Includes commented sections for all variable categories (application, database, auth, AI, storage, logging) with realistic format examples showing the expected key format for each AI provider.

### 📝 Documentation

- **DOCS.md: New "Soft Restart vs. Full Update" section** — Comprehensive comparison of soft restart (`restart.sh` / `restart.ps1`) vs full update (`update.sh` / `update.ps1`), including when to use each, what each preserves, and the key difference in behavior.

- **DOCS.md: New "ENV Persistence Testing" section** — Complete documentation for running the test scripts, including what the 10 tests check, how to configure custom credentials, and troubleshooting steps for common test failures.

- **DOCS.md: AI Synthesis ENV vars updated** — Added `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `OPENAI_BASE_URL` to the Environment Variables Reference table. Fixed stale `glm-4-flash` model reference.

### 🔧 Changed

- **Version bumped to 4.3.6** across all 15 core files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`, `CHANGELOG.md`.

---

## [4.3.5] - 2026-04-17

### 🐛 Fixed

- **CRITICAL FIX — AI API keys lost on container restart** — The `POST /api/admin/env` handler only set `process.env` in-memory. When the update script ran `docker compose down && docker compose up -d`, the container restarted fresh and all runtime env changes (including API keys) were wiped. The fix completely rewrites the env persistence system:
  - `POST /api/admin/env` now writes key-value pairs to a `runtime.env` file on disk (at `/app/tmp/env/runtime.env`)
  - `docker-entrypoint.sh` loads this file on every container boot, exporting all saved variables before the Node.js server starts
  - A new `wsh-env` Docker volume is mounted at `/app/tmp/env` so the file persists across `docker compose down`, `docker compose restart`, and `update.sh`
  - Save confirmation message updated: "persisted to disk" instead of "runtime only"

- **New soft restart scripts** — Added `restart.sh` (Linux/macOS) and `restart.ps1` (Windows) that restart only the `weavenote` application container WITHOUT rebuilding the Docker image. This is the correct way to test if API keys are persisting:
  - Usage: `./restart.sh` or `.\restart.ps1`
  - Restarts container in ~2 seconds (vs ~3-5 minutes for full update)
  - Waits for health check to pass
  - Shows version confirmation from `/api/health`
  - Optional `--logs` flag to stream container logs after restart
  - Preserves all volume data including the persistent env file

### 🏗️ Architecture

- **`/app/tmp/env/runtime.env`** — New persistent environment file written by the env POST handler and read by docker-entrypoint.sh. Mounted via the `wsh-env` Docker named volume.

- **Env key allowlisting** — The POST handler now uses a positive allowlist system (`ALLOWED_PREFIXES`) instead of just blocking sensitive keys. Only keys starting with `AI_`, `ANTHROPIC_`, `OPENAI_`, `GEMINI_`, `LOG_LEVEL`, `MAX_UPLOAD_SIZE`, `NEXT_PUBLIC_`, `STORAGE_TYPE`, or `BACKUP_INTERVAL` can be written. A `BLOCKED_KEYS` list still prevents overriding critical keys like `JWT_SECRET`, `DATABASE_URL`, etc.

### 🔧 Changed

- **Version bumped to 4.3.5** across all 15 core files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`, `CHANGELOG.md`.

---

## [4.3.4] - 2026-04-17

### 🐛 Fixed

- **CRITICAL FIX — Admin > System Logs still returns empty after v4.3.3 patch** — The v4.3.3 commit fixed the missing auth headers on the frontend but did not add a `requireAdmin` role guard to the server-side route. Any authenticated user (not just admins) could access logs. Additionally, the uncommitted working changes that added the `requireAdmin` guard accidentally deleted the `MAX_LOGS = 500` constant, causing a `ReferenceError` crash at runtime whenever `addLog()` was called. This made the logs route return 500 on every request. The fix restores the `MAX_LOGS` constant and adds the `requireAdmin` guard to both GET and DELETE handlers in `/api/admin/logs`.

- **CRITICAL FIX — AI API Key cannot be saved from Settings** — The Settings > AI Engine tab allowed selecting a provider and model but had no input field for entering the actual API key. Users had no way to configure their Claude/OpenAI/Gemini key through the UI. The fix adds:
  - A password-masked API key input field in the Settings > AI Engine tab, dynamically labeled with the correct env var name (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`) based on the selected provider
  - A "Save Key" button that POSTs the key to `/api/admin/env` for immediate runtime activation
  - Automatic refresh of provider availability status after saving a key
  - Clear error messaging for save failures (e.g., non-admin users get a 403 explanation)
  - Persistence reminder: keys are runtime-only and must be added to `.env` for survival across restarts

- **CRITICAL FIX — Admin > ENV Settings missing AI API key entries** — The default env vars list in `EnvSettingsSection.tsx` did not include `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`. Admins could not see or edit these values through the ENV management UI. All three keys are now included in the default list under the "AI" category.

- **Admin ENV and Logs routes now enforce admin role** — Both `/api/admin/env` (GET and POST) and `/api/admin/logs` (GET and DELETE) now check the `x-user-role` header (set by middleware) and return 403 if the user is not `admin` or `super-admin`. Previously these routes were accessible to any authenticated user.

- **Synthesis error messages now actionable** — The NoteEditor synthesis error handler previously showed raw server error text (e.g., "No AI provider configured. Set ANTHROPIC_API_KEY..."). Now it maps HTTP status codes to user-friendly guidance: 401 → "Session expired — please log out and log back in", 400 → "No AI provider configured — set an API key in Settings > AI Engine", 429 → "Daily AI usage limit reached". The synthesis route's no-provider error message also now references the Settings UI path.

### 🏗️ Architecture

- **New `src/lib/sanitize.ts`** — Centralized HTML sanitization module using DOM-based approach (browser only) with fallback regex stripping for SSR. Removes `script`, `iframe`, `object`, `embed`, `form`, `svg`, `base` elements and strips `on*` event handlers, `javascript:` URIs, and `data:` URIs. Replaces the inline `sanitizeHtml()` function that was previously duplicated in `NoteEditor.tsx`.

- **Zustand store logout now clears all panel states** — `logoutUser()` now resets `aiUsageCount`, `settingsOpen`, `analyticsOpen`, `loginOpen`, `adminPanelOpen`, `trashOpen`, `mindMapOpen`, `notebookOpen`, and `dbViewerOpen` in addition to the existing note/folder/editor state cleanup. This prevents stale UI state from leaking between user sessions on shared devices.

- **Unused imports removed** — `PromptLibrary.tsx` no longer imports unused icons (`X`, `MoreHorizontal`) from lucide-react.

### 🔧 Changed

- **Version bumped to 4.3.4** across all 15 core files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`, `CHANGELOG.md`.

---

## [4.3.3] - 2026-04-17

### 🐛 Fixed

- **CRITICAL FIX — Admin > System Logs shows empty, all filter buttons return nothing** — The `LogsSection` component called `fetch('/api/admin/logs')` without an `Authorization` header. The middleware protects all `/api/*` routes (except the public paths list), so it returned 401. The response was parsed as JSON but was actually an error object, resulting in `data.logs` being `undefined`, falling back to `[]`. Both the GET (fetch logs) and DELETE (clear logs) calls now include the JWT Bearer token from `localStorage`.

- **CRITICAL FIX — Admin > ENV Settings "Save Changes" button does nothing** — The `handleSaveEnv` function was a no-op: it called `await new Promise((r) => setTimeout(r, 800))` — a fake 800ms delay with no actual server communication. Editing values and clicking Save appeared to work but changes were never persisted anywhere. The fix:
  - Added `useEffect` on mount to fetch real env values from `GET /api/admin/env` and populate the table
  - Replaced the fake `handleSaveEnv` with a real implementation that POSTs each env var to `POST /api/admin/env`
  - Added a save confirmation message showing "Saved N variables (runtime)" or "Saved N, M blocked (restart required)"
  - Added auth headers to all fetch calls in the component

- **Added POST handler to `/api/admin/env`** — The route only had a GET handler. Added a POST handler that updates `process.env` at runtime for the current server process. Sensitive keys (`JWT_SECRET`, `ADMIN_DEFAULT_PASSWORD`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `POSTGRES_USER`) are blocked from runtime modification and return 403. All other keys (including `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_SYNTHESIS_MODEL`) can be updated at runtime and take effect immediately for AI synthesis requests.

- **Synthesis GET/POST 401 errors** — Related to the auth header issue above. The Settings panel's AI Engine tab fetches `GET /api/synthesis` to check provider availability. This call includes auth headers (fixed in a prior patch), but the 401 on synthesis GET was caused by the same missing-token issue when the token was not yet loaded. The env save fix resolves this because AI keys can now be configured through the admin panel.

### 🔧 Changed

- **Version bumped to 4.3.3** across all 15 files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`.

---

## [4.3.2] - 2026-04-17

### ✨ Added

- **Component Testing Checklist (`CHECKLIST.md`)** — A comprehensive 16-section testing checklist covering all key WSH components. Use it as a reference before and after modifying code to catch regressions early. Sections include: Zustand Store (8 checks), Calendar (7), NotesGrid (5), NoteEditor (9), SettingsPanel (7), Middleware (4), Synthesis API (7), Authentication (5), XSS/Sanitization (6), Timezone/Date (5), CSS/Themes (4), API Routes (5), Admin Panel (3), Docker (4), Pre-commit Quick Scans (6 commands), and Post-deploy Smoke Test (17 browser checks). Total: ~80 individual check items.

### 📝 Documentation

- **README: Complete AI provider documentation** — Removed all `z-ai-web-dev-sdk` references (SDK was removed in a prior release). Replaced with comprehensive documentation covering:
  - New "Configuring AI (Optional)" Quick Start subsection with step-by-step setup for Claude (Anthropic), OpenAI, and Gemini
  - Auto-detection priority explanation: checks `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → `GEMINI_API_KEY` in order
  - Custom LLM setup guide for self-hosted models (Ollama, LM Studio, vLLM, Azure OpenAI) via `OPENAI_BASE_URL`
  - Available models per provider table (Claude: 4 models, OpenAI: 4 models, Gemini: 3 models)
  - Updated Environment Variables table with 6 new AI-related variables: `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_BASE_URL`, `AI_SYNTHESIS_MODEL`
  - Added `GET /api/synthesis` endpoint documentation showing provider availability response format
  - Updated `POST /api/synthesis` request body docs with optional `provider` and `model` fields
  - Updated AI Synthesis Engine feature description: multi-provider, auto-detect, per-user model selection, custom endpoints, no external SDK
  - Updated Tech Stack table: `Anthropic / OpenAI / Gemini (native fetch)` replaces `z-ai-web-dev-sdk`

### 🔧 Changed

- **Version bumped to 4.3.2** across all 13 core files: `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`.

---

## [4.3.1] - 2026-04-11

### 🐛 Fixed

- **CRITICAL FIX — Quick References edit/delete buttons invisible and non-functional** — The Quick References panel in the left sidebar had multiple severe usability issues that made the edit, delete, and add features practically unusable:

  - **Invisible action buttons** — The Edit and Delete buttons were rendered as tiny 13px icon-only elements colored `#555` (dark gray on a dark background), making them nearly impossible to see or tap, especially on touch devices. Replaced with clearly labeled text buttons ("Use", "Edit", "Delete") each with distinct icons (`Zap`, `Edit3`, `Trash2`) and proper padding (`px-2.5 py-1`) for adequate touch targets.

  - **No delete functionality** — There was no way to remove a reference from the list. Added a full Delete button with a two-step confirmation flow: clicking Delete shows a red confirmation bar ("Delete 'title'?") with "Yes, Delete" and "Cancel" buttons, preventing accidental deletions. The confirmation bar uses `bg-red-500/10` with `border-red-500/30` styling for clear visual distinction.

  - **No edit functionality** — The Edit button existed but did nothing when clicked. Implemented a complete inline edit mode: clicking Edit transforms the reference into an editable form with name, description, and content (markdown) fields, plus Save and Cancel buttons. Edits are persisted to `localStorage` immediately on save.

  - **No add functionality** — Users could not create new custom references. Added a blue "+ Add" button in the section header that creates a new reference, expands it, and immediately enters edit mode with pre-filled default values.

  - **Bookmark icons dim gray on dark background** — The `FileText` icon was colored `text-pri-400` which rendered as a dim gray on the dark sidebar background. Replaced with `BookmarkCheck` icon colored `text-blue-500` (#3b82f6) for high visibility and better semantic meaning.

  - **No hover differentiation** — Edit and Delete buttons looked identical with no visual hint of their destructive vs. constructive nature. Added distinct hover states: Edit button highlights blue (`hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30`), Delete button highlights red (`hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30`).

  - **`crypto.randomUUID()` crash in non-secure contexts** — When running in environments without a secure context (HTTP instead of HTTPS, or certain embedded browsers), `crypto.randomUUID()` throws a `TypeError`. Added a try-catch fallback that generates IDs using `Date.now().toString(36) + '-' + Math.random().toString(36)` when `crypto.randomUUID()` is unavailable.

  - **Click event bubbling** — Action button clicks bubbled up to the parent toggle button, causing the reference to collapse when clicking Edit, Delete, or Use. Added `event.stopPropagation()` on every action button handler to prevent accidental collapse.

  - **Templates were hardcoded** — The four default templates (Daily Standup, Meeting Notes, Project Brief, Code Review) were hardcoded as a const array and could not be modified, added to, or removed. Converted to dynamic state managed via `useState` with `localStorage` persistence (`wsh-quick-references` key). References are loaded from localStorage on mount and saved automatically whenever changes occur. The four defaults are used as the initial seed only when no stored data exists.

### ✨ Added

- **localStorage persistence for Quick References** — All references are saved to `localStorage` under the `wsh-quick-references` key. Changes (add, edit, delete) persist across page reloads and browser restarts. The storage layer uses try-catch for resilience against quota errors and parse failures.

- **Empty state display** — When all references have been deleted, the panel shows a centered message with a faded `FileText` icon and "No references yet. Click '+ Add' to create one." text, preventing a confusing blank space.

- **Custom event dispatch on Use** — Clicking "Use" fires a `wsh:use-quick-ref` custom event on `window` with the full reference object as `detail`, allowing the NoteEditor or other components to receive and process the template content.

### 🏗️ Architecture

- **Complete rewrite of `QuickReferences.tsx`** — Expanded from 97 lines to ~300 lines. The component now manages its own state for references, expanded/collapsed state, editing state, delete confirmation state, and new-reference creation. All handlers use `useCallback` for memoization. The component is fully self-contained with helper functions (`generateId`, `loadRefs`, `saveRefs`) extracted outside the component for testability.

### 🔧 Changed

- **Version bumped to 4.3.1** across all 13 files: `package.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `update.ps1`, `update.sh`, `install.ps1`, `install.sh`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, `README.md`, `DOCS.md`.

### 📝 Documentation

- **DOCS.md version references updated** — Stale `4.1.2` references in `DOCS.md` (container details table, manual recovery commands, Docker Safety section) updated to `4.3.1`.

---

## [4.3.0] - 2026-04-10

### ✨ Added

- **Document Upload & Processing Pipeline** — Complete PDF/document upload system with server-side file storage, per-page text extraction, and automatic chunking. Uploaded files are saved to disk (`upload/documents/`), metadata is stored in the `Document` table, and extracted text is split into page-based chunks in `DocumentChunk` for efficient search indexing. The processing pipeline runs inline during upload: extract text per page → split long pages into chunks (2000 chars with 200 char overlap, breaking at sentence/paragraph boundaries) → insert all chunks into the database → mark document as "ready". Supports PDF, TXT, MD, DOCX, CSV, JSON, XML, YAML, and more. Files up to 50MB accepted.

- **Full-Text Document Search** — Powerful full-text search across all uploaded documents using PostgreSQL native full-text search. Four search modes supported:
  - **Full Text**: Search individual words separated by spaces (e.g., `firewall incident compliance`). Uses PostgreSQL `to_tsvector`/`to_tsquery` with English configuration.
  - **Phrase Search**: Search for exact phrases (e.g., `"firewall configuration"`). Matches the phrase directly in document text.
  - **Boolean Search**: Use `AND`, `OR`, `NOT` operators (e.g., `firewall AND access`, `vpn OR policy`, `backup NOT cloud`).
  - **Fuzzy Search**: Partial and typo-tolerant matching using PostgreSQL `pg_trgm` extension (e.g., `config*`, `securty*`).

- **Document Library Management** — View all uploaded documents with expandable chunk previews. Each document shows status (processing/ready/error), file size, page count, chunk count, and upload date. Documents can be expanded to view individual chunks with page numbers and content. Cascade delete removes chunks and file from disk.

- **PostgreSQL Full-Text Search Infrastructure** — Automatic setup of `pg_trgm` extension and two GIN indexes during Docker startup: one for full-text search (`to_tsvector`) and one for trigram/fuzzy search (`gin_trgm_ops`). Built via `docker-entrypoint.sh` for immediate search availability after deployment.

- **New Prisma Models** — `Document` (file metadata, ownership, status tracking) and `DocumentChunk` (per-page/chunk text with `pageNumber`, `chunkIndex`, `content`, `charCount`). Cascade delete ensures chunks are removed when a document is deleted.

- **DocumentManager UI Component** — Replaced the old `DocumentEditor` (in-memory text extraction only) with a full-featured component featuring three sub-tabs: **Upload** (drag-and-drop with processing pipeline visualization), **Library** (document list with expandable chunk previews and delete), **Search** (four-mode search with document source, page number, and highlighted snippets with search tips).

### 🔧 Changed

- **Document tab completely redesigned** — The "Document" note type now opens the DocumentManager instead of the old in-memory text extraction editor. Documents are persisted to the database with full-text search indexes.

- **New API routes** — `POST /api/documents/upload` (FormData, JWT auth), `GET /api/documents` (list), `GET/DELETE /api/documents/[id]` (single document with chunks), `POST /api/documents/search` (full-text/phrase/boolean/fuzzy with snippet generation).

### 🏗️ Architecture

- `src/lib/pdfProcessor.ts` — PDF and text extraction utility with per-page extraction, chunk splitting, file I/O
- `src/app/api/documents/upload/route.ts` — Upload endpoint with validation, processing pipeline
- `src/app/api/documents/route.ts` — Document listing endpoint
- `src/app/api/documents/[id]/route.ts` — Single document retrieval and deletion
- `src/app/api/documents/search/route.ts` — Full-text search with four modes, snippet generation
- `src/components/wsh/editors/DocumentManager.tsx` — New document management UI component
- `prisma/schema.prisma` — Added `Document` and `DocumentChunk` models with indexes

---

## [4.2.1] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — Notes lost on page refresh or browser data clear** — Notes were stored **only** in the browser's `localStorage` and were never synced to the PostgreSQL database. This meant any browser update, privacy cleanup, incognito session close, or manual site data clear would permanently erase all notes. The app has a fully-defined `Note` and `Folder` model in Prisma but no code to read/write from them. This is now completely fixed with full database-backed note persistence:
  - **New API routes**: `GET/POST/PUT/DELETE /api/notes` and `GET/POST/PUT/DELETE /api/folders` — full CRUD operations with JWT authentication and user ownership verification.
  - **Server sync on login**: When a user logs in, `syncFromServer()` fetches all notes and folders from the database and populates the Zustand store. Local-only notes (created while offline) are merged with server data so nothing is lost.
  - **Server sync on page load**: After the JWT token is verified on startup, notes are fetched from the server. If the server is unreachable, local data from localStorage is used as a fallback.
  - **Auto-save to server**: Every `addNote`, `updateNote`, `deleteNote`, `restoreNote`, `permanentDeleteNote`, `emptyTrash`, `addFolder`, `updateFolder`, and `deleteFolder` action now pushes changes to the database in a fire-and-forget manner. The UI updates immediately from the local store, and the server sync happens in the background.
  - **Merge strategy**: On sync, server data takes priority for notes that exist in both local storage and the database (server is the source of truth). Notes that only exist locally are preserved and uploaded to the server on next save.
  - **Clean logout**: `logoutUser()` now clears the notes/folders arrays (prevents showing another user's data if a different account logs in on the same device).

### 🏗️ Architecture

- **New API routes**: `GET/POST/PUT/DELETE /api/notes` — CRUD for notes with user scoping, ownership checks, and JSON tag serialization.
- **New API routes**: `GET/POST/PUT/DELETE /api/folders` — CRUD for folders with user scoping, ownership checks, and automatic note unlinking on folder deletion.
- **New store action**: `syncFromServer()` — fetches notes and folders from the database, merges with local data, and updates localStorage cache.
- **New store state**: `isSyncing` — boolean flag indicating whether a server sync is in progress.

---

## [4.2.0] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — Editor toolbar buttons (Emoji, Attach File, Font Size, Font Color, Highlight, Insert Image) non-functional** — The toolbar in `NoteEditor.tsx` rendered 6 feature buttons (Paperclip, Smile, Palette, Type, ImageIcon) that had no `onClick` handlers — they were purely decorative and did nothing when clicked. Only basic formatting buttons (Bold, Italic, Underline, etc.) and Indent actually worked. This has been completely reimplemented with full functionality:
  - **Emoji Picker**: Grid-based popup with 170+ emojis across faces, gestures, hearts, hands, nature, and symbols categories. Clicking any emoji inserts it at the cursor position in the editor.
  - **Attach File**: Opens a native file picker. Image files (JPG, PNG, GIF, etc.) are embedded inline as `<img>` tags with base64 data URLs. Non-image files are embedded as styled download link buttons that preserve the filename.
  - **Font Size**: Dropdown with 7 preset sizes (Tiny through Huge) using `execCommand('fontSize', ...)`. Each option displays a live-preview of the actual size.
  - **Text Color / Font Color**: Color palette popup with 10 colors (Red, Orange, Yellow, Green, Blue, Purple, Pink, Black, White, Gray) using `execCommand('foreColor', ...)`.
  - **Highlight Color**: New toolbar button (Highlighter icon) with 8 highlight presets (Yellow, Green, Blue, Pink, Orange, Purple, Red) plus a "Clear" option using `execCommand('hiliteColor', ...)` and `execCommand('removeFormat')`.
  - **Insert Image**: URL input dialog that inserts an `<img>` tag at the cursor position with responsive styling (max-width, auto height, border radius).
  - **Indent / Outdent**: Explicit Indent and Outdent buttons added alongside the existing toolbar formatting buttons using `execCommand('indent')` and `execCommand('outdent')`.
  - All popups close on outside click and use CSS classes (`toolbar-popup`, `toolbar-popup-trigger`) for proper event delegation.

- **CRITICAL FIX — Notebook reader crashes with client-side exception** — The `extractLinks()` function in `NotebookView.tsx` referenced an out-of-scope variable `images` (which was defined only inside `extractImages()`) in its bare URL filtering logic. This caused a `ReferenceError` whenever the Notebook View tried to render any note that contained bare URLs (e.g., `https://example.com`), crashing the entire page with a "client-side exception has occurred" error. The fix extracts image URLs locally within `extractLinks()` using a `Set<string>` for efficient deduplication, making the function self-contained.

- **CRITICAL FIX — Page refresh logs user out (no persistent sessions)** — The Zustand store's `saveToLocalStorage()` and `loadFromLocalStorage()` deliberately excluded all user authentication state (token, username, email, role, isLoggedIn) from localStorage. This meant every page refresh reset the user to logged-out state, forcing re-authentication. The fix implements persistent sessions:
  - User auth state is now stored in a separate `wsh-auth` localStorage key, independent of the main `wsh-state` key used for notes, theme, etc.
  - On page load, `loadFromLocalStorage()` restores the auth state from `wsh-auth` immediately, so the UI shows the logged-in state without a flash of the login screen.
  - A new `/api/admin/users/verify` endpoint validates the stored JWT token against the server on startup, checking that the user still exists and their account is not banned/suspended. If the token is expired or invalid, the user is gracefully logged out.
  - The `logoutUser()` action now explicitly removes the `wsh-auth` key from localStorage to ensure clean logout.
  - The verify endpoint is added to the middleware's `PUBLIC_PATHS` so it doesn't require auth itself.

### ✨ Added

- **New Highlight Color toolbar button** — A Highlighter icon has been added to the editor toolbar, providing text highlighting functionality that was previously missing entirely.
- **New Indent/Outdent toolbar buttons** — Explicit Indent and Outdent icons now appear in the toolbar for better discoverability.

### 🏗️ Architecture

- **New API route: `POST /api/admin/users/verify`** — Validates a JWT token and returns the associated user info if valid. Used by the client on page load to verify restored sessions. Returns 401 if the token is expired, 403 if the user is banned, and 400 if the request is malformed. Falls back to trusting the JWT payload if the database is unavailable (offline tolerance).

---

## [4.1.6] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — Admin "Registered Users" shows "No users found" despite users existing in the database** — The `UsersSection` component was calling `fetch('/api/admin/users')` without an `Authorization` header. The middleware (`middleware.ts`) rejects all non-public API routes that lack a valid JWT, returning 401. Since the component's `catch` block silently set `users` to `[]`, the admin panel always appeared empty even though the DB Viewer confirmed users existed. The fix adds an `authHeaders()` helper that includes the user's JWT token from the Zustand store (`Bearer ${user.token}`), and all 6 fetch calls in `UsersSection` now use it: `fetchUsers`, `handleCreateUser`, `handleUserAction` (PATCH), `handleDeleteUser` (DELETE), `handleChangePassword` (PATCH), and `handleChangeRole` (PATCH). The `useEffect` that triggers `fetchUsers` now also gates on `user.isLoggedIn && user.token` to avoid making unauthenticated requests.

### 🔧 Changed

- **Update scripts now stop containers before rebuilding** — Both `update.ps1` and `update.sh` now run `docker compose down` as a new Step 2 before the Docker image rebuild (Step 3). This prevents Docker DNS resolution failures that occur when the Docker daemon's network state is stale after containers have been running for extended periods. The scripts now have 5 steps instead of 4: (1) Pull code, (2) Stop containers, (3) Rebuild image, (4) Restart containers, (5) Validate.

---

## [4.1.5] - 2026-04-10

### ✨ Added

- **Mathematically precise SVG logo (Logo.tsx)** — Completely rebuilt the logo mark from the ground up using exact geometric coordinates instead of raster images. The new SVG logo consists of four precisely defined layers: (1) a **regular hexagon frame** computed from 6 trigonometric vertices with flat-top orientation, (2) **8 radial spider-web lines** extending from center to edge, (3) **3 concentric web rings** drawn with **quadratic Bézier curves** whose control points are displaced downward to simulate realistic gravity-driven droop (not flat arcs or straight lines), and (4) a **fountain-pen nib** constructed from cubic Bézier curves for the flared outline, with a horizontal band, center slit, and breather hole rendered as separate sub-elements. A 3-stop linear gradient (`#0ea5e9` → `#0284c7` → `#0f172a`) flows top-to-bottom across all elements, matching the teal-to-navy brand identity.

- **Typography lockup in header** — The header now displays a proper brand lockup alongside the SVG logo mark: "WeaveNote" in `text-xl font-extrabold tracking-tight` with "Your Ideas, Connected." tagline in `text-[10px] font-bold uppercase tracking-[0.2em]` beneath it. The text and logo are wrapped in a flex container with `gap-3` for consistent vertical centering at any screen size.

### 🔧 Changed

- **Header height increased from h-16 (64px) to h-20 (80px)** — The taller header gives the logo mark and text lockup proper breathing room without crowding against the top and bottom edges. All header content (view toggles, navigation buttons, search, login, settings) remains properly centered within the increased height.

- **Sign-in page logo replaced with SVG component** — The `LockedOverlay` no longer renders a raster `logo.png` via `next/image` (which produced a visible checkered transparency pattern on the dark background). Instead it uses the inline `<Logo>` component at `size={160}`, which renders the SVG directly with no transparency artifacts. The sign-in page now shows the logo mark + "WeaveNote" text + tagline centered with an ambient glow effect behind it.

- **Sign-in welcome text upgraded** — The "Welcome to WSH" heading now uses `font-extrabold` and displays "WeaveNote" in a gradient (`from-pri-400 to-cyan-400`) instead of plain text. The subtitle paragraph now has `max-w-sm mx-auto` for better line length control.

- **logo.svg in public/ updated** — The SVG file used by README and Open Graph previews now matches the new mathematical design with hexagon, spider web, pen nib, and gradient.

---

## [4.1.4] - 2026-04-10

### 🔧 Changed

- **Logo background made transparent** — The WSH logo now has a fully transparent background (previously white/light gray). This was achieved using flood-fill edge detection from all four image edges with a 45-unit color distance threshold, followed by smooth alpha blending on border pixels for clean anti-aliased edges. The logo renders cleanly on any background color or gradient without visible white boxes or halos.

- **Logo resolution increased to 4× (2140×1732)** — The main logo has been upscaled from 535×433 to 2140×1732 pixels using Lanczos resampling for crisp rendering on high-DPI displays and large format display contexts. The favicon has also been upgraded to 180×180px, and a 32×32 favicon.ico has been generated for legacy browser support.

- **Header logo enlarged from 40px to 64px** — The logo in the top-left header has been increased from `h-10` (40px) to `h-16` (64px) height. This makes the logo text and emblem significantly more readable, especially on smaller screens where the WSH text label is hidden (`hidden sm:inline`).

- **Sign-in page logo dramatically enlarged** — The logo on the locked/sign-in overlay has been increased from a max of `28rem × 14rem` to `42rem × 20rem` on large screens. The container now uses responsive sizing: `w-80 h-48` (mobile) → `w-[28rem] h-64` (sm) → `w-[36rem] h-72` (md) → `w-[42rem] h-80` (lg). The background gradient and border have been removed from the container to let the transparent logo blend with the page. The glow effect behind the logo has been expanded (`-inset-6`, `blur-3xl`).

---

## [4.1.3] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — Notebook reader crashes with React Error #310 ("Objects are not valid as a React child")** — The `NotebookView` component (and `NoteDetailModal`, `NotesGrid`, `TrashModal`, `AnalyticsPanel`, `RightSidebar`) all had `typeColors` and `typeIcons` maps that only covered 6 note types (`quick`, `notebook`, `deep`, `code`, `project`, `document`) but the `NoteType` union includes `ai-prompts`. When a note with `type: 'ai-prompts'` was loaded, `typeIcons['ai-prompts']` returned `undefined` and `typeColors['ai-prompts']?.split(' ')[0]` returned `undefined`, causing cascading render failures. All 6 components now include `ai-prompts` in their type maps with a violet color scheme.

- **CRITICAL FIX — Missing `Brain` icon import in NotebookView** — The `NotebookView` component's `typeIcons` map referenced `<Brain>` for the `ai-prompts` type, but `Brain` was not imported from `lucide-react`. This caused a `ReferenceError: Brain is not defined` crash during server-side rendering, making the entire app fail to build once `ai-prompts` type notes existed. Added `Brain` to the lucide-react import.

- **Defensive type guards for content rendering** — Added `safeString()` and `safeTags()` helper functions to `NotebookView` and `NoteDetailModal`. These ensure that `note.content`, `note.rawContent`, and `note.tags` are always properly typed (string and string[] respectively) before processing. This prevents crashes when data from localStorage or the API contains unexpected types (e.g., ProseMirror JSON objects stored by MdxEditor instead of HTML strings, or non-string tag values).

- **favicon.ico 404 fixed** — Browsers automatically request `/favicon.ico` regardless of HTML metadata. Created a new API route at `/api/favicon` that serves the existing `favicon.png` file with `image/x-icon` content type. Also updated the layout metadata to declare both `/favicon.png` and `/favicon.ico` icon variants.

### ✨ Verified

- Production build passes with zero errors after all fixes
- All 7 note types render correctly across NotebookView, NoteDetailModal, NotesGrid, TrashModal, and AnalyticsPanel

---

## [4.1.2] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — PowerShell `update.ps1` throws `NativeCommandError` and stops** — The `update.ps1` script was missing `$ErrorActionPreference = "SilentlyContinue"`, which `install.ps1` already has. Both `git` and `docker` write progress/info text to **stderr** (not just errors). PowerShell interprets all stderr output from native commands as a `NativeCommandError`, displays it in red, and depending on context, may terminate the script. This caused the update script to show scary red errors from `git pull origin main 2>&1` on every Windows run, and in some PowerShell versions, the script would stop after Step 1. The fix adds `$ErrorActionPreference = "SilentlyContinue"` at the top of `update.ps1`, matching `install.ps1`'s behavior. Real failures are still detected via `$LASTEXITCODE` checks, which remain functional regardless of the ErrorActionPreference setting.

- **Improved error recovery messages in update.ps1** — When git pull fails, the script now shows specific possible causes (local changes, wrong branch, network issues) and provides two fix commands (`git stash && git pull && git stash pop` or `git checkout main && git pull`). Similarly, Docker build and container restart failures now suggest concrete next steps (`.\update.ps1 -NoCache` or `docker compose down && docker compose up -d`).

### 📝 Documentation

- **Added Troubleshooting section to README** — New section covering common update issues: NativeCommandError explanation and fix, git merge conflict resolution, Docker build failures, health check timing, and "already up to date" scenarios. Each issue includes symptom description, root cause explanation, and copy-paste fix commands.

### 🔧 Changed

- **All version references unified to 4.1.2** — Updated across 13 files: `package.json`, `Dockerfile` (header comment + both ARG defaults), `docker-compose.yml` (build arg + image tag), `docker-entrypoint.sh` (header + fallback version), `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, and `README.md`.

---

## [4.1.1] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — Version mismatch across Docker and deployment scripts** — The `Dockerfile` was hardcoded to `BUILD_VERSION=3.9.4` while `docker-compose.yml` passed `BUILD_VERSION=4.0.1`. All install/update scripts (`install.sh`, `install.ps1`, `update.sh`, `update.ps1`) and the `docker-entrypoint.sh` displayed version `4.0.1` in their banners. Meanwhile, `package.json`, the health API, and the system API reported `4.1.0`. This inconsistency meant the Docker image reported a different version than the running application, the VersioningSection in Admin Panel could show conflicting version numbers depending on the data source, and the update script banner was misleading. All version references have been unified to `4.1.1` across every file: `package.json`, `Dockerfile` (both ARG defaults), `docker-compose.yml` (build arg and image tag), `docker-entrypoint.sh`, `install.sh`, `install.ps1`, `update.sh`, `update.ps1`, `/api/health`, `/api/admin/system`, `VersioningSection.tsx`, and `README.md`.

- **TypeScript type error — `NoteType` missing `ai-prompts` variant** — The `NoteType` union in `wshStore.ts` was defined as `'quick' | 'notebook' | 'deep' | 'code' | 'project' | 'document'`, but the `NoteEditor.tsx` component's tab system includes an `AI Prompts` tab that sets `activeNoteType` to `'ai-prompts'`. Since `setActiveNoteType` expects a `NoteType` argument, this created a type mismatch that could cause subtle runtime issues or fail under strict TypeScript compilation. The `ai-prompts` variant has been added to the `NoteType` union.

### 🔧 Changed

- **Docker image tag updated** — The `docker-compose.yml` image tag changed from `weavenote:4.0.1` to `weavenote:4.1.1`. The install scripts' image cleanup lists have been updated to match. Users updating from v4.0.x will get a fresh image build automatically via `update.ps1` / `update.sh`.
- **README image tag references updated** — All references to `weavenote:4.0.0` in the Docker Safety, Docker Configuration, and install script documentation sections have been updated to `weavenote:4.1.1` to reflect the current version.

### ✨ Verified

- **Production build verified** — Confirmed the application builds successfully with zero TypeScript and compilation errors after the type fix and version unification.

---

## [4.1.0] - 2026-04-10

### 🐛 Fixed

- **CRITICAL FIX — JSX syntax error preventing production build** — The `NoteEditor.tsx` status bar section was missing a closing `</div>` tag for the outer status bar container (line 519). This caused Turbopack to fail with "Unexpected token" during every production build, making deployment impossible. The missing `</div>` for the flex container that wraps the engine status indicator and the save/synthesis button group has been added.
- **CRITICAL FIX — `setActiveNoteId` crash when saving new notes** — The `setActiveNoteId` function was used in the `handleSave` callback (line 169) to associate a newly created note with the editor, but it was never destructured from the Zustand store. This caused a `ReferenceError: setActiveNoteId is not defined` crash every time a user tried to save a new note (clicking Save without an active note). The function is now properly included in the store destructuring.
- **Dead code cleanup in `page.tsx`** — Removed an unused `loginAnchorEl` reference in the `LockedOverlay` component that was attempting to read from `globalThis.__wshLoginAnchor` (a global variable that was never set anywhere in the codebase). Also removed the unused `setLoginOpen` destructuring from the same component.

### ✨ Verified

- **3 consecutive production builds passed** — Verified the build completes successfully across 3 independent iterations with zero errors after the JSX fix.
- **All 7 editor tabs render correctly** — Confirmed that Quick, Notebook, Deep, Code, Project, Document, and AI Prompts tabs all render within the NoteEditor component's tab bar. The AI Prompts tab is properly positioned alongside the other note type tabs as requested.
- **Header navigation buttons functional** — Map, Notebook, and Analytics buttons in the header toolbar are present and correctly styled with the unified `text-muted-foreground hover:text-foreground hover:bg-secondary` visual language.
- **Login/Sign Up widget accessible** — The Login button in the header properly opens the LoginWidget popover with tabbed Login/Sign Up modes.
- **Admin button visibility gated by role** — The Admin panel button only renders for users with `admin` or `super-admin` roles, as verified by the `isAdmin` computed property in `Header.tsx`.
- **DB health indicator polling** — The header's green/red DB status dot polls `/api/health` every 30 seconds and displays connection status with latency information.
- **App screenshots captured** — Generated screenshots showing the admin-logged-in state with the AI Prompts tab active and the Quick note editor tab active.

### 📝 Documentation

- Updated version references to 4.1.0 across package.json
- Updated CHANGELOG.md with v4.1.0 release notes
- README reflects current feature set including AI Prompt Library as editor tab

---

## [4.0.1] - 2026-04-10

### 🔧 Changed

- **Official WeaveNote logo and banner applied** — Replaced the auto-generated logo with the official WeaveNote brand assets. The new `logo.png` features the hexagonal spider-web and fountain-pen-nib design with the "WeaveNote" wordmark and "Your Ideas, Connected." tagline on a white background. A separate `banner.png` (transparent background variant) has also been added to the `public/` directory for use in marketing materials or wide-format display.
- **AI Prompts button relocated to navigation group** — The "Prompts" button has been moved from its standalone position in the header into the unified navigation group alongside Map, Notebook, and Analytics. All four buttons now share the same visual style (`text-muted-foreground hover:text-foreground hover:bg-secondary`) for a consistent, clean header layout.

### 📝 Documentation

- Updated version references to 4.0.1 across README and CHANGELOG

---

## [4.0.0] - 2026-04-10

### ✨ Added

- **AI Prompt Library** — A full-featured prompt management system that allows users to save, organize, search, and quickly copy AI prompts for reuse. The library is accessible via a new "Prompts" button in the header toolbar and opens as a full-screen overlay panel. Prompts are persisted to `localStorage` and include support for categories (General, Writing, Code, Analysis, Creative, Business, Research, Education), custom tags, favorites with star toggling, inline editing, one-click copy to clipboard, and sorting by newest, oldest, alphabetical, or recently updated. Five starter prompts are included by default (Summarize Text, Code Review Assistant, SWOT Analysis, Explain Like I'm 5, Blog Post Outline) to help users get started immediately.
- **New WSH logo and favicon** — Replaced the old SVG-only geometric logo with a newly designed, professionally generated app icon. The new logo features a hexagonal woven-thread neural network pattern with a gradient from deep indigo to cyan, reflecting the app's AI-powered knowledge management identity. Both the main `logo.png` (1024x1024) and `favicon.png` have been added to the `public/` directory, along with an updated `logo.svg` for vector use. The Logo component now uses `next/image` for optimized rendering with a rounded corner style.

### 🐛 Fixed

- **CRITICAL FIX — PDF text extraction completely broken** — The `extract-text` API route was passing the raw `Buffer` directly to the `PDFParse` constructor (`new PDFParse(buffer)`), but pdf-parse v2.4.5 expects a `LoadParameters` object (`new PDFParse({ data: buffer })`). This caused every PDF upload to fail with an initialization error, silently falling through to the regex-based fallback which produces very poor results for most PDFs. The fix passes the correct object structure and properly calls `parser.destroy()` after extraction to release resources. The fallback still exists as a safety net for unusual PDF formats.
- **CRITICAL FIX — DOCX text extraction non-functional** — The `extractDocxText()` function was attempting to match `<w:t>` XML tags with regex directly against the raw file buffer. However, DOCX files are ZIP archives — the XML content is compressed inside the archive and cannot be matched by regex on raw bytes. This meant every DOCX upload would either return empty text or garbage. The fix integrates the `mammoth` library, a purpose-built DOCX parser that properly unzips the archive and extracts text from `word/document.xml` with full Unicode support, paragraph structure preservation, and proper handling of embedded formatting. The old regex approach is retained as a last-resort fallback.

### 🔧 Changed

- **Logo component upgraded** — The `Logo.tsx` component now uses `next/image` for optimized, lazy-loaded image rendering instead of an inline SVG. The logo displays with a subtle rounded corner for a modern look.
- **Favicon updated** — The browser tab favicon has been changed from an emoji-based data URI to the new custom `favicon.png`, providing a professional branded appearance in browser tabs and bookmarks.
- **New `mammoth` dependency added** — Added `mammoth` to `package.json` for robust DOCX text extraction. This replaces the broken regex-based approach with a proper OOXML parser.
- **Prompt Library state added to Zustand store** — Added `promptLibraryOpen` and `setPromptLibraryOpen` to the global store for managing the Prompt Library overlay panel visibility.

### 📝 Documentation

- Updated README.md version reference to 4.0.0
- Updated CHANGELOG.md with v4.0.0 release notes

---

## [3.9.4] - 2026-04-09

### ✨ Added

- **Public User Registration (Sign Up)** — Added a full registration UI to the LoginWidget, allowing new users to create accounts directly from the login popover without needing admin intervention. The widget now features a tabbed interface with "Login" and "Sign Up" modes, matching the existing dark theme design language. The registration form includes username, email (optional), password, and confirm password fields with show/hide toggles for each password field. A password requirements hint is displayed below the form for user guidance.
- **Auto-login after registration** — The `/api/admin/users/register` endpoint now issues a JWT token upon successful registration. Users are automatically logged into their new account immediately after signing up, without needing to manually enter their credentials on the login form. If the token is not returned for any reason, the widget gracefully falls back to switching to the login form with the username pre-filled.
- **Password confirmation on registration** — Added `confirmPassword` field validation to the register API endpoint. When the client sends a `confirmPassword` value, the server validates that it matches the `password` field before proceeding with user creation. A clear error message is returned if the passwords do not match.
- **Show/hide password toggles** — Added eye icon toggles to both the login and registration password fields, allowing users to reveal or conceal their passwords as needed. This improves usability and reduces the likelihood of registration errors caused by mistyped passwords.
- **Default admin seed script** — Added `prisma/seed.ts` that creates a default super-admin user on first run using the `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_EMAIL`, and `ADMIN_DEFAULT_PASSWORD` environment variables. The script is idempotent — it checks whether the admin user already exists before attempting creation, and also verifies that the admin email is not already in use by another user. Added `db:seed` script to `package.json` for manual seeding during development.
- **Automated admin seeding in Docker** — The `docker-entrypoint.sh` now runs the admin seed check during first-run database initialization (after `prisma db push`). This ensures that a default admin account is always available immediately after a fresh Docker deployment. The seeding step is non-fatal — if it fails for any reason, the server still starts and admins can be created manually.

### 🔧 Changed

- **LoginWidget redesigned as tabbed auth widget** — The popover now features a "Login" / "Sign Up" tab switcher at the top, replacing the previous login-only interface. The widget width has been increased from `w-72` to `w-80` to accommodate the additional registration fields. Both forms share a common error banner and loading state.
- **Header button text updated** — The header login button now displays "Login / Sign Up" when no user is authenticated (previously just "Login"), making the registration option discoverable without requiring the user to click the button first.
- **Register API response format** — The `/api/admin/users/register` response now includes a `token` field in addition to the existing `user` and `message` fields, enabling auto-login. The `message` has been updated to "Registration successful — logged in automatically".

### 🐛 Fixed

- **CRITICAL FIX — Default admin user never seeded in Docker** — The `docker-entrypoint.sh` seed script used `require('./src/lib/auth.js')` to import the password hashing function, but the Next.js standalone Docker build does not include the `src/` directory (only compiled `.next/standalone/` output is copied). This caused the seed to silently fail on every startup, leaving the User table empty. The fix replaces the import with direct usage of `bcryptjs.hash()` which is available as a production dependency in the Docker image.
- **Seed now runs on every startup** — The admin seed check was previously nested inside the first-run-only block (gated by `.db-initialized` marker). If the seed failed on the first run, it would never retry because the marker was already set. The seed is now gated by its own `.admin-seeded` marker and runs independently of the DB schema push. It also verifies the admin user exists on subsequent starts, and logs a warning if no admin is found.
- **`prisma/seed.ts` import fixed for Docker compatibility** — The development seed script also imported from `../src/lib/auth`, which would fail in environments where the source tree isn't available. Now uses `bcryptjs` directly.

---

## [3.9.3] - 2026-04-09

### 🐛 Fixed

- **pgAdmin email validation failure** — Changed the default `PGADMIN_DEFAULT_EMAIL` and `ADMIN_DEFAULT_EMAIL` from `admin@wsh.local` to `admin@example.com`. The `.local` TLD is a reserved special-use domain (RFC 2606) that is rejected by newer versions of pgAdmin4's email validator, causing a startup crash loop with the error: "The part after the @-sign is a special-use or reserved name that cannot be used with email." This affected both the `docker-compose.yml` defaults and the `.env.example` template.
- **Prisma CLI crash — `Cannot find module 'empathic/package'`** — The Dockerfile previously used manual `COPY` instructions for individual Prisma transitive dependencies (`effect`, `fast-check`, `pure-rand`). Prisma 6.11.1+ introduced new transitive deps (`empathic`, `c12`, `deepmerge-ts`, plus 12+ sub-dependencies of `c12`) that were not included, causing `prisma db push` and `prisma generate` to fail at container startup with `MODULE_NOT_FOUND`. The Dockerfile now uses `npm install --omit=dev` in the runner stage, which automatically resolves the full dependency tree — this is future-proof against further Prisma dependency changes.
- **Removed all remaining `wsh.local` references from application code** — Replaced `@wsh.local` fallback emails in 4 server routes (`db-test`, `admin/db-test`, `admin/users/register`) and 1 UI component (`UsersSection.tsx`) with `@example.com` (RFC 2606 sanctioned example domain). This ensures consistency with the pgAdmin email fix and prevents any future email validation issues with reserved TLDs.
- **UsersSection.tsx fake success on network error** — The `handleCreateUser` catch block previously added a fake user record to local state when the API call failed, misleading admins into thinking the user was created. Now correctly logs an error message without creating phantom records.

### 🐳 Docker

- **Rewrote Dockerfile Prisma dependency installation** — Replaced the fragile per-package `COPY` block (which required manually adding every new transitive dependency) with `npm install --omit=dev` in the runner stage. This installs all production dependencies including `prisma` and its complete transitive dependency tree in one step, with proper file ownership for the non-root `nextjs` user.
- Reordered runner stage: npm install now runs before the standalone Next.js copy, so the Prisma client can be properly regenerated after install
- Removed the manual `prisma` CLI wrapper symlinks (no longer needed — npm install creates them automatically)

### 📝 Documentation

- Updated all references to pgAdmin login credentials across README, DOCS, and CHANGELOG to reflect the new `admin@example.com` default
- Updated environment variable tables to show the new default email addresses
- Updated Docker Safety tables and version references to 3.9.3

### 🔧 Changed

- Changed default port from 3000 to 8883 across all files: `docker-compose.yml`, `install.sh`, `install.ps1`, `.env.example`, `README.md`, `DOCS.md`
- Bumped version from 3.9.2 to 3.9.3 across all files: `package.json`, `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh`, `install.ps1`, `install.sh`, `update.ps1`, `update.sh`, health check endpoint, system info endpoint, VersioningSection component, and all documentation files

---

## [3.9.2] - 2026-04-08

### 🔒 Security

- **CRITICAL FIX — Docker cleanup now scoped to WSH only.** The install and update scripts (`install.sh`, `install.ps1`) previously used broad pattern matching (`grep -iE "postgres|pgadmin|adminer"`) and `docker system prune -af` which could destroy containers, images, volumes, and build cache belonging to other Docker Compose projects or standalone containers on the same host. This has been completely rewritten to use exact name matching and project-scoped cleanup.

### 🐳 Docker

#### What Changed

The cleanup logic in both install scripts was rewritten from the ground up. Here is a detailed comparison of the old and new behavior:

**Old behavior (DANGEROUS):**

| Phase | Old Command | Risk |
|-------|-------------|------|
| Container removal | `grep -iE "wsh\|weavenote\|pgadmin"` | Could match containers from other projects named with "pgadmin" |
| Image removal | `grep -iE "wsh\|weavenote\|adminer\|pgadmin\|postgres"` | Would delete ALL postgres, adminer, and pgadmin images on the system, including those used by other applications |
| Volume removal | `grep -iE "wsh\|weavenote\|postgres\|pgadmin"` | Would destroy database volumes from other projects that contain "postgres" in their name |
| Network removal | `grep -iE "wsh\|weavenote"` | Relatively safe but could match unintended networks |
| Build cache | `docker builder prune -af` | Wiped ALL build cache system-wide, not just WSH's |
| System prune | `docker system prune -af` | **Most dangerous** — removed ALL unused containers, images, networks, and volumes on the entire host |

**New behavior (SAFE):**

| Phase | New Command | Safety |
|-------|-------------|--------|
| Container removal | `docker compose down -v --remove-orphans` + exact name match for `wsh-postgres`, `weavenote-app`, `wsh-dbviewer`, `wsh-pgadmin` | Only touches containers defined in WSH's docker-compose.yml or by exact container_name |
| Image removal | Exact tag match for `weavenote:3.9.2` and `weavenote:latest` | Shared images (`postgres:16-alpine`, `adminer:latest`, `dpage/pgadmin4:latest`) are never touched |
| Volume removal | Exact name match for `postgres-data`, `weavenote-data`, `pgadmin-data` (with project prefix) | Only removes volumes that Docker Compose created for WSH |
| Network removal | Exact name match for `wsh-net` (with project prefix) | Only removes WSH's dedicated bridge network |
| Build cache | `docker builder prune -f --filter "label=com.docker.compose.project=<name>"` | Only prunes build cache tagged with WSH's project label |
| System prune | **REMOVED** | No longer runs. WSH no longer touches system-wide Docker resources |

#### Migration Notes

If you are upgrading from a previous version of WSH (3.9.1 or earlier), the new install scripts are fully backward compatible. Your existing WSH containers, volumes, and data will be cleaned up correctly by the new scripts. The only difference is that the new scripts will no longer destroy other projects' resources.

If you previously relied on the old scripts' aggressive cleanup behavior (e.g., you used `./install.sh` as a general Docker cleanup tool), you should switch to using `docker system prune` manually for that purpose instead.

### 📝 Documentation

- Added comprehensive **Docker Safety** section to README explaining exactly what resources are and are not removed
- Added detailed comparison table of old vs. new cleanup behavior in this CHANGELOG
- Created `DOCS.md` with detailed Docker management documentation, troubleshooting guide, and safety explanation
- Updated README Docker Deployment section to emphasize scoped cleanup behavior
- Clarified that `--clean-only` / `-CleanOnly` flags only affect WSH resources

---

## [3.9.1] - 2026-04-07

### ✨ Added

- Mind Map API endpoint (`GET /api/graph`) for external graph data consumption
- Notebook View — full-screen linear document reader for immersive reading
- Note Detail Modal — full metadata and content viewer for individual notes
- ENV Import/Export buttons in Admin Panel
- Quick Add Common Keys — one-click presets for popular environment variables
- Analytics Panel with Recharts-powered visual statistics
- Settings Panel with dark/light mode toggle and 15 color themes

### 🐛 Fixed

- Improved health check reliability with configurable start_period
- Fixed tag filtering to properly clear when clicking an active tag
- Resolved sidebar scroll tracking in Notebook View
- Fixed inline editing persistence in Web DB Viewer

### 🐳 Docker

- Added `docker-entrypoint.sh` for automated database initialization on first run
- Improved container dependency ordering with `condition: service_healthy`
- Added `start_period` to all health checks for proper initialization delays
- Version-tagged image as `weavenote:3.9.1`

---

## [3.9.0] - 2026-03-30

### ✨ Added

- Initial release of WSH (WeaveNote Self-Hosted)
- AI Synthesis Engine with 5 modes (Summarize, Expand, Improve, Generate Tags, Create Outline)
- Interactive SVG force-directed Mind Map visualization (no D3.js dependency)
- 6 note types: Quick, Notebook, Deep, Code, Project, Document
- Folders & Tags organizational system with drag-and-drop reordering
- Trash Modal with soft-delete and restore functionality
- Admin Panel with 6 sections (ENV, Versioning, Users, Cloud, DB, Logs)
- User Authentication with JWT tokens and role-based access control
- Web DB Viewer (Adminer) on port 5682
- Optional pgAdmin on port 5050 via Docker Compose profiles
- 15 hand-crafted color themes with instant switching
- Multi-stage Docker build (deps → builder → runner)
- Install scripts for Linux/macOS (`install.sh`) and Windows (`install.ps1`)
- Non-destructive update scripts (`update.sh`, `update.ps1`)
- Caddy reverse proxy configuration
- AlertTriangle ENV warning banner in Admin Panel

### 🏗️ Architecture

- Next.js 16 with App Router
- TypeScript 5 with strict mode
- Tailwind CSS 4 with custom theme system
- shadcn/ui + Radix UI component library
- Zustand 5 for global state management
- Prisma ORM with PostgreSQL 16
- Framer Motion for animations
- Lucide React for iconography
- @dnd-kit for drag-and-drop interactions
