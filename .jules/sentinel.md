## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2026-04-15 - [Prisma Undefined Filter Bypass]
**Vulnerability:** Passing `undefined` to a property in a Prisma 5 `where` clause causes that property to be ignored. In an `OR` array, this results in an empty filter `{}` which matches all records, leading to authorization bypass.
**Learning:** In routes using `optionalAuth`, `req.user?.id` will be `undefined` for unauthenticated requests. If this is passed directly into an `OR` clause (e.g., `OR: [{ userId }, { userId: null }]`), it inadvertently exposes private data of all users to guests.
**Prevention:** Always explicitly check for the presence of optional identity parameters before including them in Prisma filters. Use a ternary or if-statement to construct the `where` clause rather than relying on object property shorthand with potentially `undefined` variables.
