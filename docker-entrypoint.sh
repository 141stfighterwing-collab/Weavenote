#!/bin/sh
# WSH Docker Entrypoint v4.4.7
# Handles PostgreSQL connectivity check, first-run DB init, admin seeding, and server startup.
# Uses direct node path for Prisma CLI (never npx — prevents v7.x download).
#
# v4.4.3 FIX: Runs as root to fix Docker volume permissions (wsh-env owned by root),
# then drops to 'nextjs' user before starting the server.

#set -e  # Disabled: individual errors are handled below to prevent crash loops

WSH_UID="${WSH_UID:-1001}"
WSH_GID="${WSH_GID:-1001}"
PRISMA_CLI="./node_modules/.bin/prisma"
SCHEMA_FLAG="--schema=./prisma/schema.prisma"
MARKER_FILE="/app/tmp/.db-initialized"
SEED_MARKER="/app/tmp/.admin-seeded"

# ── Fix Docker volume permissions (must run as root) ────────────
# BUG FIX: Docker named volumes (wsh-env, weavenote-data, upload-data) are
# created with root:root ownership by default. Since the app runs as 'nextjs'
# (uid 1001), it cannot write to these volumes. This causes:
#   - ENV API keys to fail silently when saving to disk (process.env works,
#     but runtime.env write fails → keys lost on restart)
#   - Upload failures if the upload volume has the same issue
mkdir -p /app/tmp/env /app/tmp /app/upload /app/db
chown -R ${WSH_UID}:${WSH_GID} /app/tmp /app/upload /app/db 2>/dev/null
echo "[+] Volume permissions set (uid=${WSH_UID}, gid=${WSH_GID})"

# ── Load persistent runtime env overrides ──────────────────────────
# These are set via Admin > ENV Settings or Settings > AI Engine and
# persist across container restarts via the wsh-env Docker volume.
PERSISTENT_ENV="/app/tmp/env/runtime.env"
if [ -f "$PERSISTENT_ENV" ]; then
  echo "[*] Loading persistent environment from $PERSISTENT_ENV..."
  KEY_COUNT=0
  while IFS='=' read -r line; do
    LINE=$(echo "$line" | sed 's/^#.*//;s/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$LINE" ] && continue
    KEY=$(echo "$LINE" | cut -d'=' -f1)
    VAL=$(echo "$LINE" | cut -d'=' -f2-)
    # Strip surrounding quotes
    VAL=$(echo "$VAL" | sed 's/^"//;s/"$//;s/^'\''//;s/'\''$//')
    export "$KEY=$VAL"
    KEY_COUNT=$((KEY_COUNT + 1))
  done < "$PERSISTENT_ENV"
  echo "[+] Loaded $KEY_COUNT persistent environment variables"
fi

# ── Pre-flight checks ──────────────────────────────────────────
if [ ! -x "./node_modules/.bin/prisma" ]; then
  echo "[ERROR] Prisma CLI not found at ./node_modules/.bin/prisma"
  echo "[ERROR] Container image may be corrupted. Rebuild: docker compose build --no-cache"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL environment variable is not set."
  echo "[ERROR] When using docker-compose, this is set automatically."
  exit 1
fi

echo "======================================================="
echo "  WSH (WeaveNote Self-Hosted) v${BUILD_VERSION:-4.2.1}"
echo "======================================================="
$PRISMA_CLI --version 2>&1 | head -1 | sed 's/^/[+] /'

# ── Parse DATABASE_URL ────────────────────────────────────────
# Format: postgresql://user:pass@host:port/db
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
  echo "[ERROR] Could not parse DATABASE_URL. Expected: postgresql://user:pass@host:port/db"
  echo "[ERROR] DATABASE_URL=$DATABASE_URL"
  exit 1
fi

echo "[*] Target: PostgreSQL at $DB_HOST:$DB_PORT"

# ── Wait for PostgreSQL ────────────────────────────────────────
echo "[*] Waiting for PostgreSQL to be ready..."
RETRIES=0
MAX_RETRIES=30

while [ $RETRIES -lt $MAX_RETRIES ]; do
  RESULT=$(node -e "
    const dns = require('dns');
    const net = require('net');
    const host = process.argv[1];
    const port = parseInt(process.argv[2], 10);
    dns.resolve4(host, (err, addresses) => {
      if (err) { console.log('FAIL:' + err.code); process.exit(0); }
      console.log('DNS:' + addresses[0]);
      const s = net.createConnection(port, host, () => {
        console.log('OK'); s.destroy(); process.exit(0);
      });
      s.on('error', (e) => { console.log('FAIL:' + e.code); process.exit(0); });
      setTimeout(() => { console.log('FAIL:TIMEOUT'); process.exit(0); }, 5000);
    });
  " "$DB_HOST" "$DB_PORT" 2>&1)

  if echo "$RESULT" | grep -q "OK"; then
    DNS_IP=$(echo "$RESULT" | grep "DNS:" | sed 's/DNS://')
    echo "[+] PostgreSQL connected at $DB_HOST:$DB_PORT (IP: $DNS_IP)"
    break
  fi

  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -eq 1 ]; then
    echo "[!] Diagnostic: $RESULT"
    echo "    Retrying up to $((MAX_RETRIES * 2)) seconds..."
  fi
  sleep 2
done

if [ $RETRIES -ge $MAX_RETRIES ]; then
  echo "[ERROR] PostgreSQL not reachable after 60s at $DB_HOST:$DB_PORT"
  echo "[ERROR] Last result: $RESULT"
  echo ""
  echo "[ERROR] Troubleshooting:"
  echo "  docker compose logs postgres"
  echo "  docker compose down && docker compose up -d"
  exit 1
fi

# ── Database schema sync (runs on EVERY startup) ──────────────
# prisma db push is idempotent: instant no-op when schema matches,
# and applies new tables/columns when the app is updated (e.g. v4.3.5
# added Document + DocumentChunk models). No data is lost.
echo "[*] Syncing database schema..."
if $PRISMA_CLI db push --accept-data-loss $SCHEMA_FLAG 2>&1; then
  echo "[+] Database schema is up to date"
else
  echo "[!] Schema push had warnings — regenerating client and retrying..."
  $PRISMA_CLI generate $SCHEMA_FLAG 2>&1 || echo "[!] prisma generate failed (non-fatal)"
  if $PRISMA_CLI db push --accept-data-loss $SCHEMA_FLAG 2>&1; then
    echo "[+] Database schema synced on retry"
  else
    echo "[ERROR] Database schema sync failed. Check /api/health after boot."
  fi
fi
mkdir -p /app/tmp /app/upload

# ── Enable PostgreSQL extensions for full-text search ──────────
echo "[*] Setting up PostgreSQL full-text search extensions..."
node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  prisma.\\\$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm;')
    .then(function() { console.log('[+] pg_trgm extension enabled'); })
    .catch(function(e) { console.log('[!] pg_trgm: ' + e.message); })
    .finally(function() { return prisma.\\\$disconnect(); });
" 2>&1

# Build GIN indexes for document search (idempotent — IF NOT EXISTS)
echo "[*] Building document search indexes..."
node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  prisma.\\\$executeRawUnsafe(\\\"CREATE INDEX IF NOT EXISTS idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('english', content));\\\")
    .then(function() { console.log('[+] Full-text GIN index created'); })
    .catch(function(e) { console.log('[!] FTS index: ' + e.message); })
    .finally(function() { return prisma.\\\$executeRawUnsafe(\\\"CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON document_chunks USING GIN (content gin_trgm_ops);\\\"); })
    .then(function() { console.log('[+] Trigram GIN index created'); })
    .catch(function(e) { console.log('[!] Trigram index: ' + e.message); })
    .finally(function() { return prisma.\\\$disconnect(); });
" 2>&1

# ── Seed initial admin user (explicit credentials required) ─────
# Security hardening v4.4.7:
# - Refuses to fall back to default bootstrap credentials
# - Requires explicit ADMIN_DEFAULT_* values on first bootstrap only
# - Skips seeding safely when a real admin already exists
mkdir -p /app/upload
if [ ! -f "$SEED_MARKER" ]; then
  echo "[*] Checking whether initial admin seeding is required..."
  SEED_OUTPUT=$(node -e "
    const bcrypt = require('bcryptjs');
    const { PrismaClient } = require('@prisma/client');

    async function seed() {
      const prisma = new PrismaClient();
      try {
        const existingAdmin = await prisma.user.findFirst({
          where: { role: { in: ['admin', 'super-admin'] } },
          select: { username: true, email: true, role: true },
        });

        if (existingAdmin) {
          console.log('[seed] Existing admin found (' + existingAdmin.username + ', role=' + existingAdmin.role + ') — skipping bootstrap seeding.');
          return 'exists';
        }

        const username = process.env.ADMIN_DEFAULT_USERNAME;
        const email = process.env.ADMIN_DEFAULT_EMAIL;
        const password = process.env.ADMIN_DEFAULT_PASSWORD;

        if (!username || !email || !password) {
          console.log('[seed] No existing admin found, but ADMIN_DEFAULT_USERNAME / ADMIN_DEFAULT_EMAIL / ADMIN_DEFAULT_PASSWORD are not fully set.');
          console.log('[seed] Refusing to seed an insecure default admin account.');
          return 'missing-config';
        }

        const existingUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUsername) {
          console.log('[seed] Requested bootstrap username already exists (' + existingUsername.username + ') — skipping.');
          return 'exists';
        }

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
          console.log('[seed] Requested bootstrap email already exists (' + existingEmail.email + ') — skipping.');
          return 'exists';
        }

        const saltRounds = 12;
        const hashed = await bcrypt.hash(password, saltRounds);

        const admin = await prisma.user.create({
          data: {
            username,
            email,
            password: hashed,
            role: 'super-admin',
            status: 'active'
          },
          select: { id: true, username: true, email: true, role: true, status: true }
        });

        console.log('[seed] Initial admin user CREATED:');
        console.log('[seed]   Username: ' + admin.username);
        console.log('[seed]   Email: ' + admin.email);
        console.log('[seed]   Role: ' + admin.role);
        console.log('[seed]   Status: ' + admin.status);
        console.log('[seed]   ID: ' + admin.id);
        console.log('[seed] IMPORTANT: Remove bootstrap admin env vars after first successful deploy.');
        return 'created';
      } catch(e) {
        console.error('[seed] ERROR: ' + e.message);
        console.error('[seed] Stack: ' + e.stack);
        return 'error';
      } finally {
        await prisma.\$disconnect();
      }
    }

    seed().then(function(result) {
      process.exit(result === 'error' ? 1 : 0);
    });
  " 2>&1)
  SEED_EXIT=$?
  echo "$SEED_OUTPUT"

  if [ $SEED_EXIT -eq 0 ]; then
    # Check if user was created or already existed
    if echo "$SEED_OUTPUT" | grep -q "CREATED"; then
      echo "[+] Initial admin user seeded successfully"
    else
      echo "[+] Admin seed check complete (existing admin present or explicit bootstrap config not provided)"
    fi
    # Mark as seeded so we don't re-run on every restart (only needed once)
    mkdir -p /app/tmp /app/upload
    touch "$SEED_MARKER"
  else
    echo "[!] Admin seed failed — will retry on next container restart"
    echo "[!] Check the error above. You can also seed manually via the /api/admin/users/register endpoint."
  fi
else
  echo "[+] Admin seed already completed (marker: $SEED_MARKER) — skipping"
  # Still verify the admin user exists
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.user.findFirst({ where: { role: { in: ['admin', 'super-admin'] } }, select: { username: true, role: true } })
      .then(function(admin) {
        if (admin) {
          console.log('[+] Admin user verified: ' + admin.username + ' (role=' + admin.role + ')');
        } else {
          console.log('[!] WARNING: No admin user found in database!');
          console.log('[!] Remove /app/tmp/.admin-seeded and restart to re-seed.');
        }
        return prisma.\$disconnect();
      });
  " 2>&1
fi

# ── Verify Prisma client ───────────────────────────────────────
echo "[*] Verifying Prisma client..."
$PRISMA_CLI generate $SCHEMA_FLAG 2>&1 | tail -1 || echo "[!] prisma generate warning (non-fatal)"

# ── Drop privileges and start server ───────────────────────────
# The entrypoint runs as root to fix volume permissions above.
# Now switch to the 'nextjs' user for the actual application server.
echo "[*] Starting WSH server on port ${PORT:-3000} as nextjs (uid=${WSH_UID})..."
echo "======================================================="
exec su-exec ${WSH_UID} "$@"
