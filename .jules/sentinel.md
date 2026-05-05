## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma IDOR Vulnerability with Undefined Values]
**Vulnerability:** Prisma `where` clauses ignore `undefined` values, leading to IDOR vulnerabilities when `userId` is missing (e.g., guest sessions) and not explicitly handled.
**Learning:** In routes that support optional authentication, using `{ where: { id, userId } }` allows any user (or guest) to access any resource by ID because `userId` being `undefined` causes Prisma to only filter by `id`.
**Prevention:** Always use `userId: userId || null` or a similar pattern to force Prisma to match against a non-undefined value, ensuring that unauthenticated requests do not accidentally bypass ownership checks.
