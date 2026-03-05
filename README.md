<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WeaveNote

An AI-powered smart note organizer that categorizes ideas, visualizes connections, and helps structure raw thoughts.

## Versioning

This repository now tracks versions using **Semantic Versioning (SemVer)**.

- Current version: **1.1.0**
- Change history: see [CHANGELOG.md](./CHANGELOG.md)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local)
3. Run the app:
   `npm run dev`

## Admin Database Export (JSON / SQL / CSV)

Admins can download note database backups from:

**Settings → Administrator → ☁️ Cloud Setup → Database Export**

Available export buttons:
- **Download JSON**: structured export including metadata (`exportedAt`, `totalNotes`, `userId`, `notes`).
- **Download SQL**: SQL dump with `CREATE TABLE` and `INSERT` statements.
- **Download CSV**: CSV file with headers (`id`, `title`, `content`, `createdAt`, `folderId`, `userId`).

All export files are timestamped to simplify auditing and historical backup tracking.
