## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Authorization Bypass via Prisma and optionalAuth]
**Vulnerability:** IDOR vulnerability in `GET /api/notes` and `GET /api/notes/:id` because `optionalAuth` allowed `userId` to be `undefined`, which Prisma's `where` clause ignores.
**Learning:** Prisma's default behavior of ignoring `undefined` values in `where` filters can turn an optional ownership check into an unintended bypass if the user is not authenticated.
**Prevention:** Use mandatory `authenticate` middleware for all endpoints that filter by `userId` or perform explicit null checks on the `userId` before passing it to the database query.
