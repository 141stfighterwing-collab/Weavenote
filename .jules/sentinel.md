## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma ORM Authorization Bypass Pattern]
**Vulnerability:** Passing `undefined` to a filter property in a Prisma 5 `where` clause (e.g., `{ userId: undefined }`) causes that filter to be ignored. Inside an `OR` array, this results in an empty filter `{}` which matches all records, leading to authorization bypasses in routes using `optionalAuth`.
**Learning:** `optionalAuth` middleware that sets `req.user` to `undefined` for guests is dangerous when paired with Prisma's default behavior of ignoring `undefined` fields in filters.
**Prevention:** Always explicitly check for the presence of `userId` (or any ownership identifier) before constructing Prisma queries, especially when using `OR` conditions or `optionalAuth`. Provide explicit fallback filters (e.g., `{ userId: null }`) for unauthenticated contexts.
