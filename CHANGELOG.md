# Changelog

All notable changes to this project are documented in this file.

## [1.6.2] - 2026-03-25

### 🔧 Firebase DB Routing + On-Prem Spinoff Profile

### Added
- Added support for `VITE_FIREBASE_DATABASE_URL` in frontend runtime config and app config.
- Added `docker-compose.onprem.yml` override profile for 100% on-prem deployment (no Firebase/Gemini vars).
- Added `SPINOFF_ONPREM.md` with Firebase mapping and on-prem run instructions.

### Changed
- Updated Settings quick-add templates to include Firebase Realtime Database URL variable.

---

## [1.6.1] - 2025-03-25

### 🛠️ Patch Release - Enhanced Text Formatting & Validation

This patch adds comprehensive text formatting tools and ensures all note types work correctly.

### Added

#### ✍️ Enhanced Text Formatting Toolbar
- **Strikethrough**: New "S" button for strikethrough text
- **Superscript**: New "X²" button for superscript text (e.g., H₂O, E=mc²)
- **Subscript**: New "X₂" button for subscript text (e.g., CO₂, chemical formulas)
- **Formatting Toolbar Updates**: Available in both NoteInput and EditNoteModal

#### ✅ Validation & Testing
- Verified all 6 note types function correctly:
  - **Quick Notes**: Color picker, GIF picker, image insertion, text formatting
  - **Notebook Notes**: Highlighting tool, page navigation, fullscreen mode
  - **Deep Notes**: List view with expandable details
  - **Code Notes**: Dual-panel editor with matrix theme code box
  - **Project Notes**: Objectives, deliverables, progress slider
  - **Document Notes**: File upload for PDF/TXT/MD with 20MB limit

### Changed

- Toolbar button labels updated for clarity (B/I/U/S instead of symbols)
- Added range checking for superscript/subscript operations

### Technical Details

| Component | Changes |
|-----------|---------|
| NoteInput.tsx | Added strikethrough, superscript, subscript buttons |
| EditNoteModal.tsx | Added strikethrough, superscript, subscript buttons |

---

## [1.6.0] - 2025-03-25

### 🎨 Major Feature Release - GIF Support, Enhanced Colors & Image Improvements

This release brings comprehensive GIF support from Giphy and Tenor, expanded color options with full customization, image thumbnails in note cards, and increased file upload limits.

### Added

#### 🎬 GIF & Image Support
- **Giphy & Tenor Integration**: Insert GIFs directly from Giphy and Tenor with one-click popular GIF picker
- **Image URL Insertion**: Insert images from any URL with optional width control for resizing
- **Image Resizing**: Set custom width for images (e.g., 300px, 100%) when inserting
- **GIF Badge**: Visual indicator showing "GIF" badge on animated images in note cards
- **Image Thumbnails**: Quick notes now display image/GIF thumbnails directly on the card (up to 3 images)
- **Click to Expand**: Click any thumbnail to view the full-size image in the image viewer

#### 🎨 Enhanced Color Picker
- **Full Text Color Spectrum**: All main colors now available for text including:
  - Black and White
  - Red, Orange, Yellow, Green, Teal, Blue, Indigo, Purple, Magenta, Gray
- **Full Highlight Color Spectrum**: All main colors now available for highlights including:
  - Black and White
  - Light variants of all colors
  - Full saturation colors for vibrant highlights
- **Custom Color Picker**: Native color picker input for unlimited color choices
- **Hover Effects**: Color buttons now have hover scale effects for better UX
- **Color Tooltips**: Hover over colors to see hex values

#### 📦 File Upload Improvements
- **20MB Document Upload**: Increased from 10MB to 20MB maximum file size for document uploads
- **File Size Validation**: Clear error messages when files exceed size limits
- **Backend Support**: Updated API limits to handle larger payloads

#### 🔒 Security Updates
- **CSP Frame Sources**: Added Giphy and Tenor to Content Security Policy frame sources
- **Image Domain Support**: Expanded allowed image sources for better flexibility
- **Sanitization Updates**: Enhanced HTML sanitization to support image styling attributes

### Changed

#### Security Schema
- Extended `customSanitizeSchema` to include `iframe` tags for embedded content
- Added `style` and `class` attributes to img tags for image sizing support
- Added `isAllowedImageUrl` helper function for URL validation

#### Backend Configuration
- Body parser limits increased to 20MB for JSON and URL-encoded data
- CSP frame-src directive updated to allow Giphy and Tenor embeds

### Technical Details

| Component | Changes |
|-----------|---------|
| NoteInput.tsx | Added GIF picker, image URL dialog, width controls |
| NoteCard.tsx | Added image thumbnail extraction and display |
| security.ts | Extended sanitization schema, added URL validation |
| documentParser.ts | Added 20MB file size limit with validation |
| backend/index.js | Updated body limits and CSP headers |

---

## [1.5.0] - 2025-03-18

### 🎉 Major Release - Docker, PostgreSQL & Enterprise Features

This release transforms WeaveNote into a production-ready, self-hosted application with enterprise-grade features including Docker deployment, PostgreSQL backend, comprehensive backup/migration tools, and one-click installation.

### Added

#### 🐳 Docker Deployment
- Multi-stage Dockerfile for optimized frontend builds
- Backend API container with Node.js/Express/Prisma
- PostgreSQL 16 database container with persistent volumes
- Nginx reverse proxy for production-ready serving
- Docker Compose orchestration for one-command deployment
- Health checks for all services
- Automatic database migrations on startup

#### 🗄️ PostgreSQL Backend
- Complete PostgreSQL database schema with 17 tables
- Prisma ORM for type-safe database operations
- Full ACID compliance for data integrity
- Proper indexing for optimized queries
- Cascading deletes for referential integrity
- Audit logging for compliance tracking

#### ⚙️ ENV Settings UI (Admin)
- Web-based environment variable management
- AES-256-GCM encryption for sensitive values
- Variable categorization (API, Database, Firebase, Security, General)
- Quick-add templates for common variables
- Import/Export .env files directly from UI
- Real-time validation and error handling

#### 📦 Version Control System
- Built-in versioning with patch tracking
- Version history with timestamps
- Breaking change indicators
- Rollback capability (Super Admin)
- API endpoints for version management

#### 🔧 One-Click Installation
- PowerShell installer script (`install-weavenote.ps1`)
- Windows batch launcher (`install-weavenote.bat`)
- Automatic prerequisite checking
- Secure credential generation
- Progress logging with visual output
- Comprehensive error handling and recovery
- Deployment mode selection (Local/NPM/Custom Reverse Proxy)

#### 🌐 Nginx Proxy Manager Integration
- Complete NPM setup documentation
- Port exposure guidelines
- Docker network configuration
- SSL/HTTPS with Let's Encrypt
- Domain configuration instructions

#### 💾 Backup & Migration Tool
- Interactive backup-migration.ps1 script
- Local backup: SQL, JSON, CSV, Custom dump formats
- Cloud backup: AWS S3, Google Cloud Storage, Azure Blob, Dropbox, SFTP
- Migration from: Firebase Firestore, Supabase, MongoDB, Notion
- JSON import with custom field mapping
- Pre-flight checks (database status, disk space)
- Database restore with safety warnings
- Automated backup scheduling instructions

#### 📸 Playwright Screenshots
- Automated screenshot generation
- Screenshot tests for all UI components
- HTML report generation
- Screenshots integrated into README

#### 🔍 SEO Optimization
- Comprehensive meta tags
- Keywords and hashtags documentation
- Open Graph support
- Search engine optimized content structure

### Changed

#### Documentation
- Completely rewritten README with comprehensive how-to guide
- Added detailed installation methods
- Added troubleshooting section
- Added FAQ with 15+ Q&As
- Added credits section with contributor recognition
- Added production deployment checklist

#### Security
- Environment files (.env) are now gitignored
- Sensitive variables encrypted in database
- Values masked in UI list views
- CORS configuration for production domains

### Technical Details

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL 16 |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx (reverse proxy) |
| AI | Google Gemini API |
| Testing | Playwright |

### Migration Guide

If upgrading from a previous version:

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Install new dependencies**
   ```bash
   npm install
   cd backend && npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start with Docker**
   ```bash
   docker-compose up -d --build
   ```

5. **Run the installer (Windows)**
   ```bash
   .\install-weavenote.bat
   ```

---

## [1.4.1] - 2025-03-06

### Fixed
- Hardened task checkbox toggling so only valid markdown task list markers are toggled, improving data integrity and avoiding accidental bracket replacements in normal text.
- Fixed checkbox index synchronization across detail and notebook views so multiple checkboxes toggle the correct item consistently.

---

## [1.4.0] - 2025-03-05

### Added
- Expanded the User Analytics tab with a new **Growth Signals** panel that tracks weekly/monthly activity, average note length, tag coverage, and peak writing day.

---

## [1.3.0] - 2025-03-05

### Added
- Added a new **Performance** button in Mindmap view to boost Web Weaver neural link rendering throughput on capable hardware.
- Performance mode now persists between sessions using localStorage (`ideaweaver_neural_performance`).

### Changed
- Neural map force simulation and link styling now tune dynamically when performance mode is enabled for denser, faster stabilization in large graphs.

---

## [1.2.1] - 2025-03-05

### Fixed
- Selected/open note views now reliably render sanitized inline images (including `data:` image sources) when present in note content.
- Compact note cards continue to suppress inline image rendering for cleaner previews.

### Documentation
- Added repository-scoped `AGENTS.md` workflow and versioning guidance for agent-based maintenance.

---

## [1.2.0] - 2025-03-05

### Added
- Left-sidebar **Quick References** panel with collapsible workflow templates and one-click **Use Template** insertion into the editor.
- Built-in **BEC Incident Response** workflow template to provide a ready-to-use security playbook example.
- Template creation UX for custom title, note type selection, and line-by-line workflow steps.

### Changed
- Note composer now accepts selected templates from the sidebar and pre-fills title/content immediately.
- Added persistent quick-reference storage in browser localStorage (`ideaweaver_quick_templates`).

---

## [1.1.0] - 2025-03-05

### Added
- Admin **Cloud Setup** tab now includes a **Database Export** card with one-click downloads.
- New export formats for note database backups:
  - JSON
  - SQL
  - CSV
- Export utility in `services/storageService.ts`:
  - Timestamped filenames for easier backup tracking.
  - SQL-safe string escaping for generated SQL inserts.
  - Shared browser file-download helper for consistent export behavior.

### Documentation
- Added usage documentation for Admin database export.
- Added project versioning and release tracking guidance.

---

## Versioning

This project uses **Semantic Versioning (SemVer)**:

- **MAJOR** version for incompatible changes.
- **MINOR** version for backward-compatible features.
- **PATCH** version for backward-compatible bug fixes.

## [1.6.4] - 2026-04-01

### 🎨 Palette: Accessibility and Productivity Enhancements

### Added
- **Keyboard Shortcuts**: Added `Ctrl+Enter` (Windows/Linux) and `Cmd+Enter` (macOS) to save notes quickly from the editor, title, and tag inputs.
- **Enhanced Accessibility**: Added `aria-label` and `title` attributes to all icon-only buttons in the editor toolbar and note cards to improve screen reader support and provide better tooltips.
- **UX Tooltips**: Added keyboard shortcut hints to primary action buttons.

### Changed
- Improved tag management with ARIA labels on remove buttons.

Current version: **1.6.4**.

---

## [1.6.3] - 2026-04-01

### 🛡️ Sentinel: Security Hardening

### Added
- Implemented "fail secure" pattern in the backend: the server now terminates immediately if the `JWT_SECRET` environment variable is missing or empty.

### Changed
- Removed hardcoded admin bootstrap password ("Zaqxsw12gobeavers") in `services/authService.ts`.
- Administrative bootstrap now requires an explicitly defined and non-empty `ADMIN_SETUP_PASS` environment variable.
- Removed insecure default fallback for `JWT_SECRET` in backend configuration.
