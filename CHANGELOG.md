# Changelog

All notable changes to this project are documented in this file.

## [1.2.0] - 2026-03-05

### Added
- Left-sidebar **Quick References** panel with collapsible workflow templates and one-click **Use Template** insertion into the editor.
- Built-in **BEC Incident Response** workflow template to provide a ready-to-use security playbook example.
- Template creation UX for custom title, note type selection, and line-by-line workflow steps.

### Changed
- Note composer now accepts selected templates from the sidebar and pre-fills title/content immediately.
- Added persistent quick-reference storage in browser localStorage (`ideaweaver_quick_templates`).

---

## [1.1.0] - 2026-03-05

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

This project now uses **Semantic Versioning (SemVer)**:

- **MAJOR** version for incompatible changes.
- **MINOR** version for backward-compatible features.
- **PATCH** version for backward-compatible bug fixes.

Current version: **1.2.0**.
