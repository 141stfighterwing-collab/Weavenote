#!/usr/bin/env bash
set -euo pipefail

# Helper script to run migration in two modes:
#  - --use-docker-socket : uses host docker (requires /var/run/docker.sock mounted) and will spin up a temporary MongoDB container.
#  - Without socket: script expects --mongodb-uri or MONGODB_URI env set and will run migration directly.

# Usage examples:
#   bash scripts/docker-run-migration.sh --use-docker-socket --creds /tmp/service-account.json
#   bash scripts/docker-run-migration.sh --mongodb-uri mongodb://user:pass@host:27017/dbname

show_help() {
  echo "Usage: $0 [--use-docker-socket] [--mongodb-uri URI] [--creds PATH]"
}

USE_SOCKET=0
MONGODB_URI=""
CREDS_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --use-docker-socket)
      USE_SOCKET=1; shift;;
    --mongodb-uri)
      MONGODB_URI="$2"; shift 2;;
    --creds)
      CREDS_PATH="$2"; shift 2;;
    -h|--help)
      show_help; exit 0;;
    *)
      echo "Unknown arg: $1"; show_help; exit 2;;
  esac
done

# If creds provided, make them available to migration script at /tmp/service-account.json
if [[ -n "$CREDS_PATH" ]]; then
  echo "Using creds: $CREDS_PATH"
  # Ensure the creds file exists
  if [[ ! -f "$CREDS_PATH" ]]; then
    echo "Credentials file not found: $CREDS_PATH" >&2; exit 3
  fi
  cp "$CREDS_PATH" /tmp/service-account.json
fi

# If requested, attempt to use docker socket and start temporary MongoDB
TEMP_CONTAINER_NAME="weavenote-temp-mongo-$$"
CLEANUP_ON_EXIT=0

if [[ "$USE_SOCKET" -eq 1 ]]; then
  if [[ ! -S "/var/run/docker.sock" ]]; then
    echo "Docker socket requested but /var/run/docker.sock is not present. Aborting." >&2; exit 4
  fi

  echo "[INFO] Starting temporary MongoDB container via host docker (container: $TEMP_CONTAINER_NAME)"
  # Run ephemeral mongo container with no persistent storage
  docker run --rm -d --name "$TEMP_CONTAINER_NAME" -p 27017:27017 mongo:6 || { echo "Failed to start mongo container" >&2; exit 5; }
  CLEANUP_ON_EXIT=1

  # Wait for Mongo to be available (simple retry loop)
  echo "Waiting for MongoDB to accept connections on localhost:27017"
  for i in {1..30}; do
    if nc -z localhost 27017; then
      echo "MongoDB is listening"
      break
    fi
    sleep 1
  done

  if ! nc -z localhost 27017; then
    echo "MongoDB did not start in time" >&2
    docker logs "$TEMP_CONTAINER_NAME" || true
    docker rm -f "$TEMP_CONTAINER_NAME" || true
    exit 6
  fi

  # Set MONGODB_URI to the temporary container
  MONGODB_URI="mongodb://localhost:27017/weavenote_migration"
  echo "Temporary Mongo started; using MONGODB_URI=$MONGODB_URI"
fi

# Ensure MONGODB_URI is available
if [[ -z "$MONGODB_URI" ]]; then
  if [[ -n "${MONGODB_URI:-}" ]]; then
    MONGODB_URI="$MONGODB_URI"
  fi
fi

if [[ -z "$MONGODB_URI" ]]; then
  echo "No MONGODB_URI available. Provide --mongodb-uri or run without socket but set MONGODB_URI env." >&2
  if [[ "$CLEANUP_ON_EXIT" -eq 1 ]]; then
    docker rm -f "$TEMP_CONTAINER_NAME" || true
  fi
  exit 7
fi

# Run the Node migration script with MONGODB_URI injected; capture exit code and cleanup
export MONGODB_URI

# Optional: pass SOURCE_JSON_PATH if a local export exists
if [[ -f "/tmp/source_export.json" ]]; then
  export SOURCE_JSON_PATH=/tmp/source_export.json
fi

echo "Launching migration script"
node migration/migrate_realtime_to_mongo.js || MIG_EXIT_CODE=$?
MIG_EXIT_CODE=${MIG_EXIT_CODE:-0}

echo "Migration process exited with code: $MIG_EXIT_CODE"

if [[ "$CLEANUP_ON_EXIT" -eq 1 ]]; then
  echo "Stopping temporary MongoDB container: $TEMP_CONTAINER_NAME"
  # attempt a graceful stop - container was run --rm so removing it will stop and remove
  docker rm -f "$TEMP_CONTAINER_NAME" || true
fi

exit $MIG_EXIT_CODE
