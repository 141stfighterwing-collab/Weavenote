# Weavenote Migration Helper (onprem)

This repository addition provides a small migration helper service designed for on-premise or restricted environments to help migrate realtime/exported data into MongoDB.

Key features
- Two operational modes:
  - docker-socket mode: when /var/run/docker.sock is mounted, the helper can create a temporary MongoDB container for the migration run.
  - no-socket mode: the helper runs without Docker control and uses an externally-provided MONGODB_URI.
- Minimal web UI to upload credential files and trigger migration runs.
- Scripts to start a temporary MongoDB container and execute a Node migration script.
- CI workflow that builds and validates the helper without exposing the Docker socket.

Security considerations (READ CAREFULLY)
- Mounting the Docker socket inside a container is effectively equivalent to providing full root access to the host. A compromised container with socket access can control other containers and the host filesystem.
- DO NOT mount /var/run/docker.sock on any container exposed to untrusted networks or the public internet.
- Prefer running the helper from a secure bastion host or an administrative workstation with limited network exposure.
- Use ephemeral credentials, isolated networks, and strict firewall rules for migration runs.
- Optionally run the helper on a local admin machine rather than on production hosts.

Files added
- Dockerfile: Node-based image with optional docker client to allow socket control.
- docker-compose.yml: Compose file to run the helper and optionally a mongo service for testing.
- app.js: Express UI to upload credentials and trigger migration.
- package.json: Node dependencies.
- migration/migrate_realtime_to_mongo.js: Migration script skeleton and importer.
- scripts/docker-run-migration.sh: Helper to start a temporary MongoDB container and run the migration.
- firebase.json & .firebaserc: simple Firebase hosting scaffolding (optional).
- .github/workflows/ci-migrate.yml: CI workflow to build and test the helper image.

Usage
1) Local docker-socket mode (dangerous, only on secure admin host):
   - Edit docker-compose.yml and uncomment the docker socket volume line OR run the container with -v /var/run/docker.sock:/var/run/docker.sock:ro
   - Start: docker compose up --build
   - Open http://localhost:8080 and upload credentials or provide MONGODB_URI.

2) No-socket mode (recommended for safer operation):
   - Provide a running MongoDB and set MONGODB_URI env var (or provide in the UI form).
   - Start the helper without the docker socket mount.

CI notes
- The included GitHub Actions workflow builds the image and runs basic checks. It intentionally avoids mounting the Docker socket or running privileged containers. To perform migration in CI (not recommended) you must explicitly add a secure secret and accept the risks.

Extending the migration script
- The migration script is a safe scaffold. Implement the connector to your realtime source (e.g., Firebase, file exports) in migration/migrate_realtime_to_mongo.js.
- Always run on a snapshot or staging environment before touching production.

Support
- If you need assistance integrating connectors or adapting the helper to your environment, open an issue or PR with details of the source system and desired migration behavior.
