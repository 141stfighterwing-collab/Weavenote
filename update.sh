#!/usr/bin/env bash
# WSH — Non-destructive Update Script v4.4.7
# Pulls latest code, rebuilds image, and restarts containers.
# Your data (PostgreSQL, volumes) is NEVER destroyed.
#
# Usage:
#   chmod +x update.sh && ./update.sh
#   ./update.sh --no-cache    # Force full rebuild (no layer caching)

set -e

NO_CACHE=""
for arg in "$@"; do
    case "$arg" in
        --no-cache) NO_CACHE="--no-cache" ;;
    esac
done

echo ""
echo "========================================"
echo "  WSH — Update v4.4.7"
echo "  (data-preserving update)"
echo "========================================"
echo ""

# ── Step 1: Pull latest code ─────────────────────────────────
echo -e "\033[33m[1/5] Pulling latest code from GitHub...\033[0m"
git pull origin main 2>&1
echo "  \033[32m[OK] Code updated\033[0m"

# ── Step 2: Stop running containers ──────────────────────────
echo ""
echo -e "\033[33m[2/5] Stopping running containers...\033[0m"
docker compose down 2>&1
echo "  \033[32m[OK] Containers stopped\033[0m"

# ── Step 3: Rebuild Docker image ─────────────────────────────
echo ""
echo -e "\033[33m[3/5] Rebuilding Docker image...\033[0m"
echo "  (this may take 2-4 minutes on first run)"
echo ""

if [ -n "$NO_CACHE" ]; then
    docker compose build --no-cache 2>&1
else
    docker compose build 2>&1
fi

echo ""
echo "  \033[32m[OK] Image built\033[0m"

# ── Step 4: Restart containers ───────────────────────────────
echo ""
echo -e "\033[33m[4/5] Restarting containers (preserving data)...\033[0m"
docker compose up -d --force-recreate 2>&1
echo "  \033[32m[OK] Containers restarted\033[0m"

# ── Step 5: Validate ─────────────────────────────────────────
echo ""
echo -e "\033[33m[5/5] Validating services...\033[0m"
echo "  Waiting 15s for services to start..."
sleep 15

ALL_OK=true
for svc in weavenote-app wsh-dbviewer wsh-postgres; do
    RUNNING=$(docker inspect -f '{{.State.Running}}' "$svc" 2>/dev/null || echo "false")
    if [ "$RUNNING" = "true" ]; then
        echo "  \033[32m[OK] $svc is RUNNING\033[0m"
    else
        echo "  \033[31m[FAIL] $svc is NOT running\033[0m"
        ALL_OK=false
    fi
done

# Health check
PORT=${WSH_PORT:-8883}
if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    VERSION=$(curl -sf "http://localhost:$PORT/api/health" 2>/dev/null | grep -o '"version":"[^"]*"' | head -1)
    echo "  \033[32m[OK] Health check PASSED ($VERSION)\033[0m"
else
    echo "  \033[33m[WARN] Health check not ready yet (container may still be initializing)\033[0m"
fi

echo ""
echo "========================================"
echo "  UPDATE COMPLETE"
echo "========================================"
echo ""
echo "  App:        http://localhost:$PORT"
echo "  DB Viewer:  http://localhost:5682"
echo "  Logs:       docker compose logs -f weavenote"
echo ""
echo "  To do a full clean install:  ./install.sh"
echo ""
