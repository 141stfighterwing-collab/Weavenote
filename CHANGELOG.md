# Changelog

All notable changes to this project are documented in this file.

## [1.6.4] - 2024-04-11

### Added
- Sidebar accessibility: added ARIA labels and focus states for folders and notes.

## [1.6.3] - 2024-03-25

### 🔧 Firebase DB Routing + On-Prem Spinoff Profile

### Added
- Added support for `VITE_FIREBASE_DATABASE_URL` in frontend runtime config and app config.
- Added `docker-compose.onprem.yml` override profile for 100% on-prem deployment (no Firebase/Gemini vars).
- Added `SPINOFF_ONPREM.md` with Firebase mapping and on-prem run instructions.

### Changed
- Updated Settings quick-add templates to include Firebase Realtime Database URL variable.
