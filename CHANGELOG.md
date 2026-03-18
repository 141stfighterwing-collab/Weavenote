# Changelog

All notable changes to this project are documented in this file.

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

Current version: **1.5.0**.
