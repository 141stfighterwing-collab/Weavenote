## 2025-05-22 - [Prisma Undefined Filter Bypass]
**Vulnerability:** Prisma ignores fields in a `where` clause if their value is `undefined`, which can lead to IDOR if `userId` is missing from a query.
**Learning:** In unauthenticated or optional-auth routes, passing an undefined `userId` to Prisma filters effectively removes the ownership check, exposing data from all users.
**Prevention:** Always use `userId: userId || null` (or a similar pattern) to ensure Prisma receives a concrete value that forces a mismatch for unauthenticated requests, or enforce authentication on all sensitive resource endpoints.

## 2025-05-22 - [Insecure Random Key Fallback]
**Vulnerability:** Falling back to a random encryption key on server restart (`crypto.randomBytes(32).toString('hex')`) when the environment variable is missing.
**Learning:** While this allows the app to start, it causes persistent encrypted data (like stored API keys) to become unreadable after a restart and obscures configuration issues.
**Prevention:** Implement a fail-secure check at the application entry point (`backend/src/index.js`) that terminates the process if critical security variables like `ENCRYPTION_KEY` or `JWT_SECRET` are missing.
