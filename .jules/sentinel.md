## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2026-04-17 - [Prisma Undefined Filter Authorization Bypass]
**Vulnerability:** Passing `undefined` to a filter property in a Prisma 5 `where` clause (e.g., `{ userId: undefined }`) causes that filter to be ignored. Inside an `OR` array, this results in an empty filter `{}` which matches all records, potentially causing authorization bypasses.
**Learning:** Prisma's default behavior of ignoring `undefined` values can lead to silent authorization bypasses if developers assume that `undefined` or `null` will result in a non-match.
**Prevention:** Always validate that required ownership IDs (like `userId`) are present before querying, or explicitly branch logic to handle guest (unauthenticated) states. Use the `authenticate` middleware instead of `optionalAuth` for routes that must strictly enforce ownership.
