## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma Optional Filter IDOR]
**Vulnerability:** Insecure Direct Object Reference (IDOR) in `GET /api/notes/:id` due to `optionalAuth` providing an `undefined` userId.
**Learning:** Prisma ignores filters in `where` clauses if their value is `undefined`. When using middleware like `optionalAuth` that might leave `req.user` undefined, any query relying on `userId` for ownership verification will silently drop that filter, resulting in an authorization bypass.
**Prevention:** Always explicitly check for the presence of authentication data (like `userId`) before executing queries that rely on it for access control, especially when using "optional" authentication middleware.
