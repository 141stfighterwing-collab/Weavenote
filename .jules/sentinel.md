## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-24 - [Prisma Optional Auth IDOR Risk]
**Vulnerability:** Prisma filters with `undefined` values are ignored, leading to authorization bypass when using `optionalAuth`.
**Learning:** When using `req.user?.id` with Prisma, if the user is unauthenticated, Prisma silently ignores the `userId` filter, potentially exposing all records (IDOR).
**Prevention:** Always implement an explicit presence check for `userId` or use conditional filter spreading when querying records that should be owned by the requester.
