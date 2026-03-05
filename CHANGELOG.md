# Changelog

All notable changes to this project are documented in this file.

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

Current version: **1.1.0**.
