## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma undefined Filter Authorization Bypass]
**Vulnerability:** In `where` clauses, passing `undefined` to a filter property in Prisma 5 (e.g., `{ userId: undefined }`) causes that filter to be silently ignored. In routes using `optionalAuth`, this led to IDOR where unauthenticated users could access private data.
**Learning:** Prisma's behavior of ignoring `undefined` keys in filters can create subtle authorization bypasses if input is not explicitly validated or defaulted (e.g., to `null`).
**Prevention:** Always use the null-coalescing operator (`?? null`) or explicit ternary checks when passing potentially undefined authentication identifiers (like `userId`) into Prisma `where` clauses to ensure the filter is active.
