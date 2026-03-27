## 2024-05-24 - [Secure Defaults and Configuration]
**Vulnerability:** Hardcoded secrets (JWT_SECRET and admin bootstrap password) in configuration files.
**Learning:** Default fallbacks for security secrets often end up in production, leading to predictable keys.
**Prevention:** Remove hardcoded fallbacks for secrets. Implement "fail-fast" checks at startup to ensure essential security environment variables are defined.

## 2024-05-24 - [SQL Injection Defense in Depth]
**Vulnerability:** Insufficient escaping of backslashes in manually constructed SQL queries for exports.
**Learning:** Escaping only single quotes can sometimes be bypassed depending on database configuration if backslashes are not also handled.
**Prevention:** Always escape both single quotes and backslashes by doubling them (`'` to `''` and `\` to `\\`) when manually building SQL strings for export or external use.
