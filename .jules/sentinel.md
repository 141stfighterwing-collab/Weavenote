## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Sensitive Data Exposure via Prisma Return Values]
**Vulnerability:** The `PATCH /api/users/admin/:id/status` endpoint returned the entire User object, exposing sensitive fields like `passwordHash`.
**Learning:** Prisma's CRUD operations return all model fields by default. This can lead to accidental data exposure when new sensitive fields are added to the schema or when existing ones are overlooked in route handlers.
**Prevention:** Always implement a Prisma `select` clause (allow-listing) for all database operations that return data to the client. This provides a robust defense against sensitive data leakage, even if the underlying model schema changes.
