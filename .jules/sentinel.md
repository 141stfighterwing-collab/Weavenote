## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-24 - [Prisma IDOR via Undefined Filter]
**Vulnerability:** IDOR vulnerability in `notes.js` and `templates.js` routes.
**Learning:** In Prisma `where` clauses, `undefined` values are silently ignored. If `req.user.id` is undefined (e.g., in `optionalAuth` routes), the query filter for `userId` is omitted, causing the database to return all records or exposure of private data.
**Prevention:** Always ensure filter variables are explicitly handled. Use the pattern `userId: userId || null` to force a specific value (or a mismatch for guests) so Prisma doesn't ignore the filter.
