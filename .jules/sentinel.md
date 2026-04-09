## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2026-03-15 - [Prisma Undefined Filter Authorization Bypass]
**Vulnerability:** Authorization bypass in `GET /api/templates` and IDOR in `GET /api/notes/:id` when used with `optionalAuth`.
**Learning:** Prisma treats `undefined` values in a `where` clause as if the filter is completely missing. When `req.user.id` is `undefined` (e.g., for guest users), a filter like `{ userId: req.user.id }` is ignored, potentially matching all records or exposing data belonging to other users.
**Prevention:** Always explicitly check for `undefined` or `null` user IDs when using `optionalAuth` before constructing Prisma queries. Use conditional `where` clauses to ensure unauthenticated users are restricted to public/global data only.
