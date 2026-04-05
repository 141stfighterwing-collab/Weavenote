## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Insecure Prisma Filter with Undefined Values]
**Vulnerability:** Use of `optionalAuth` middleware on the notes retrieval endpoints (`GET /` and `GET /:id`) in `notes.js`.
**Learning:** When `optionalAuth` is used, `req.user?.id` can be `undefined`. If this `undefined` value is passed directly into a Prisma `where` clause (e.g., `{ userId: req.user?.id }`), Prisma may ignore the filter entirely, leading to a data leak where unauthenticated users can access all records.
**Prevention:** Always use `authenticate` middleware for endpoints that retrieve user-specific data. If `optionalAuth` must be used, explicitly check if the `userId` is present before executing the database query, or ensure the query is structured to fail safely when `userId` is missing.
