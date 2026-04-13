## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma Authorization Bypass via Undefined Filters]
**Vulnerability:** Authorization bypass in `GET /api/templates` where unauthenticated guests could see all private templates.
**Learning:** In Prisma, passing `undefined` to a property in a `where` clause causes that filter to be ignored. In an `OR` array, if `userId` is `undefined` (common for guest users), the filter `{ OR: [{ userId }, { userId: null }] }` collapses into `{ OR: [{}, { userId: null }] }`, which matches all records.
**Prevention:** Always explicitly check for the existence of user IDs before using them in Prisma filters, especially when using `optionalAuth`. Use conditional filter objects to ensure safe fallbacks for unauthenticated requests.
