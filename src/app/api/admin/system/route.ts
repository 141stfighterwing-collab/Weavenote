import { NextRequest, NextResponse } from 'next/server';
import { execSync, existsSync, statSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { addLog } from '@/lib/logger';

const startTime = Date.now();

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Recursively compute directory size in bytes.
 * Falls back to 0 on any error (permission denied, etc).
 */
function dirSize(dirPath: string): number {
  try {
    if (!existsSync(dirPath)) return 0;
    let total = 0;
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else if (entry.isFile()) {
        try { total += statSync(full).size; } catch { /* skip */ }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Check the persistence volume status.
 */
function checkEnvVolume(): { exists: boolean; readable: boolean; writable: boolean; keyCount: number; error?: string } {
  const envFile = process.env.WSH_ENV_PATH || '/app/tmp/env/runtime.env';
  const envDir = envFile.substring(0, envFile.lastIndexOf('/'));
  try {
    const dirExists = existsSync(envDir);
    if (!dirExists) {
      return { exists: false, readable: false, writable: false, keyCount: 0, error: 'Directory does not exist' };
    }

    // Try to stat the directory
    const dirStat = statSync(envDir);

    // Try to read the file
    let keyCount = 0;
    const fileExists = existsSync(envFile);
    let readable = true;
    if (fileExists) {
      try {
        const content = readFileSync(envFile, 'utf-8');
        keyCount = content.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
      } catch {
        readable = false;
      }
    }

    // Try to write a test file to check writability
    let writable = false;
    try {
      const testFile = join(envDir, '.wsh-write-test');
      require('fs').writeFileSync(testFile, 'test');
      require('fs').unlinkSync(testFile);
      writable = true;
    } catch {
      writable = false;
    }

    return { exists: true, readable, writable, keyCount, error: writable ? undefined : 'Permission denied — run: docker compose down -v && docker compose up -d' };
  } catch (err) {
    return { exists: false, readable: false, writable: false, keyCount: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── GET: System Info ───────────────────────────────────────────────────────

export async function GET() {
  const uptime = Date.now() - startTime;
  const memUsage = process.memoryUsage();

  // Build version from env (set by Dockerfile), fallback to the current release string.
  const version = process.env.BUILD_VERSION || '4.4.8';

  // Disk sizes
  const appSize = dirSize('/app');
  const uploadSize = dirSize('/app/upload');
  const tmpSize = dirSize('/app/tmp');
  const envSize = dirSize('/app/tmp/env');
  const dbDataSize = dirSize('/app/db');

  // ENV volume diagnostics
  const envVolume = checkEnvVolume();

  // Docker info (if available)
  let dockerVersion = '';
  let containerCreated = '';
  try {
    dockerVersion = execSync('docker --version 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch { /* docker not available inside container */ }
  try {
    const hostname = execSync('hostname 2>/dev/null', { encoding: 'utf-8' }).trim();
    containerCreated = hostname || '';
  } catch { /* ignore */ }

  return NextResponse.json({
    status: 'healthy',
    version,
    uptime: formatUptime(uptime),
    uptimeMs: uptime,
    memory: {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
      rssBytes: memUsage.rss,
    },
    disk: {
      appSize: formatBytes(appSize),
      appSizeBytes: appSize,
      uploadSize: formatBytes(uploadSize),
      uploadSizeBytes: uploadSize,
      tmpSize: formatBytes(tmpSize),
      envSize: formatBytes(envSize),
      dbDataSize: formatBytes(dbDataSize),
    },
    envVolume,
    nodeVersion: process.version,
    platform: process.platform,
    nextjs: '16.x',
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    gitCommit: process.env.GIT_SHA || 'local-dev',
    environment: process.env.NODE_ENV || 'development',
    dockerVersion,
    hostname: containerCreated,
  });
}

// ── POST: Trigger Update ──────────────────────────────────────────────────
// This runs the update script (update.sh or update.ps1) which pulls latest
// code, rebuilds the Docker image, and restarts containers.
// The script is spawned in the background so the HTTP response returns immediately.

export async function POST(request: NextRequest) {
  // Verify admin
  const role = request.headers.get('x-user-role');
  const username = request.headers.get('x-user-username') || 'admin';
  if (role !== 'admin' && role !== 'super-admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'update';

    if (action === 'update') {
      addLog('info', `Update triggered by ${username} — running update script...`, 'system');

      // Spawn the update script in the background
      // The script runs on the HOST, not inside the container.
      // Since we're in a container, we need to communicate to the host.
      // We use a flag file approach: write a marker that the host can watch.
      const flagDir = '/app/tmp';
      const flagFile = join(flagDir, '.update-requested');

      try {
        require('fs').writeFileSync(flagFile, JSON.stringify({
          requestedBy: username,
          timestamp: new Date().toISOString(),
          action: 'update',
        }));
        addLog('info', `Update flag written to ${flagFile} — host script must watch for this`, 'system');
      } catch (err) {
        addLog('error', `Failed to write update flag: ${err instanceof Error ? err.message : String(err)}`, 'system');
      }

      return NextResponse.json({
        success: true,
        message: 'Update requested. The update script must be run from the host machine.',
        hostCommand: process.platform === 'win32' ? '.\\update.ps1' : './update.sh',
        note: 'Run the update command on your host terminal (not inside the container). The app will restart during the update.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    addLog('error', `Update trigger failed: ${message}`, 'system');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
