## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma Optional Filtering and IDOR]
**Vulnerability:** Insecure Direct Object Reference (IDOR) via unauthenticated access to single resource endpoints.
**Learning:** Using `optionalAuth` combined with Prisma's behavior of ignoring `undefined` values in `where` clauses can lead to authorization bypass. If `req.user?.id` is `undefined`, Prisma may strip the `userId` filter entirely, exposing all records.
**Prevention:** Enforce mandatory `authenticate` middleware for all resource-specific endpoints (e.g., `GET /:id`). Always ensure the `where` clause contains a non-nullable owner identifier for private resources.
