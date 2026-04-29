## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2026-04-15 - [Prisma Undefined Filter Bypass]
**Vulnerability:** IDOR (Insecure Direct Object Reference) vulnerabilities in `notes.js` and `templates.js` due to Prisma's behavior of ignoring `undefined` values in `where` filters.
**Learning:** In Prisma, if a variable passed to a `where` clause is `undefined` (common when an optional user object is not present), Prisma omits the filter entirely instead of failing or filtering for null. This can lead to guest users inadvertently accessing all records.
**Prevention:** Use the pattern `userId: userId || null` in `where` clauses to ensure that if `userId` is `undefined` or `null`, Prisma explicitly filters for `null` (matching no records or only global ones), rather than ignoring the filter.
