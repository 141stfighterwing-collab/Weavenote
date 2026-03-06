# Changelog

All notable changes to this project are documented in this file.

## [1.4.1] - 2026-03-06

### Fixed
- Hardened task checkbox toggling so only valid markdown task list markers are toggled, improving data integrity and avoiding accidental bracket replacements in normal text.
- Fixed checkbox index synchronization across detail and notebook views so multiple checkboxes toggle the correct item consistently.

---

## [1.4.0] - 2026-03-05

### Added
- Expanded the User Analytics tab with a new **Growth Signals** panel that tracks weekly/monthly activity, average note length, tag coverage, and peak writing day.

---

## [1.3.0] - 2026-03-05

### Added
- Added a new **Performance** button in Mindmap view to boost Web Weaver neural link rendering throughput on capable hardware.
- Performance mode now persists between sessions using localStorage (`ideaweaver_neural_performance`).

### Changed
- Neural map force simulation and link styling now tune dynamically when performance mode is enabled for denser, faster stabilization in large graphs.

---

## [1.2.1] - 2026-03-05

### Fixed
- Selected/open note views now reliably render sanitized inline images (including `data:` image sources) when present in note content.
- Compact note cards continue to suppress inline image rendering for cleaner previews.

### Documentation
- Added repository-scoped `AGENTS.md` workflow and versioning guidance for agent-based maintenance.

---

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

Current version: **1.4.1**.
