# Weavenote Screenshots Documentation

This document provides visual guides for using Weavenote, including where to configure settings and environment variables.

## Running Screenshot Tests

```bash
# Install Playwright browsers
npx playwright install chromium

# Run screenshot tests
npm run screenshots

# View the HTML report
npm run show-report
```

## Screenshot Index

### 1. Main Interface

| Screenshot | Description |
|------------|-------------|
| `01-homepage.png` | Main application interface showing the note grid, sidebar, and navigation |
| `02-settings-button-location.png` | Location of the settings gear icon (⚙️) in the header |
| `03-settings-panel.png` | Settings panel opened showing all configuration options |

### 2. Settings Navigation

| Screenshot | Description |
|------------|-------------|
| `04-settings-visuals.png` | Visual settings tab for theme and appearance |
| `05-settings-my-security.png` | Security settings for password management |
| `05-settings-ai-engine.png` | AI Engine usage and quota display |
| `05-settings-diagnostics.png` | System diagnostics and health checks |

### 3. Theme & Appearance

| Screenshot | Description |
|------------|-------------|
| `07-theme-selector.png` | Theme selector showing available color themes |
| `08-darkmode-before.png` | Light mode appearance |
| `09-darkmode-after.png` | Dark mode appearance |

### 4. Views

| Screenshot | Description |
|------------|-------------|
| `10-grid-view.png` | Standard grid view for notes |
| `11-mindmap-view.png` | Mindmap visualization of notes |

### 5. Features

| Screenshot | Description |
|------------|-------------|
| `12-search-active.png` | Search functionality in action |
| `13-tab-quick.png` | Quick notes tab |
| `13-tab-deep.png` | Deep notes tab |
| `13-tab-code.png` | Code notes tab |
| `13-tab-project.png` | Project notes tab |

### 6. Admin Settings (Requires Login)

| Screenshot | Description |
|------------|-------------|
| `14-settings-entry-point.png` | Where to access admin settings |
| `15-env-settings.png` | Environment variables management panel |
| `16-add-env-variable.png` | Modal for adding new environment variables |
| `17-versioning.png` | System version history and patching |

## Environment Variables Configuration

### Accessing ENV Settings

1. **Login as Admin** - You must have admin or super-admin privileges
2. **Click the ⚙️ gear icon** in the top-right corner
3. **Select "🔐 ENV Settings"** from the sidebar

### Adding Environment Variables

1. Click **"+ Add Variable"** button
2. Enter the key name (e.g., `GEMINI_API_KEY`)
3. Enter the value
4. Select category (API, Database, Firebase, Security, General)
5. Check "Secret" if the value should be encrypted
6. Click **"Save"**

### Quick Add Templates

Common environment variables can be quickly added using the quick-add buttons:

- `GEMINI_API_KEY` - Google Gemini AI API Key
- `POSTGRES_PASSWORD` - PostgreSQL Database Password
- `JWT_SECRET` - JWT Signing Secret
- `VITE_FIREBASE_API_KEY` - Firebase API Key

### Import/Export

- **Import**: Click "Import .env" and paste your .env file contents
- **Export**: Click "Export .env" to download all variables as a .env file

## Version Control

### Viewing Version Information

1. **Login as Admin**
2. **Click ⚙️ Settings**
3. **Select "📦 Versioning"**

The versioning page shows:
- Current system version
- Application date
- Patch notes
- Version history

### Version History

Each version entry shows:
- Version number
- Breaking change indicators
- Application date
- Patch notes

## Troubleshooting

### Can't See ENV Settings Tab

- Ensure you're logged in as an admin
- Check your user role in User Base settings
- Contact a super-admin to upgrade your role

### Environment Variables Not Taking Effect

1. Save the variable in ENV Settings
2. Restart the Docker containers: `docker-compose restart api`
3. Verify with Diagnostics

### Exported .env File is Empty

- You must be a super-admin to export all variables
- Some variables may be restricted based on role
