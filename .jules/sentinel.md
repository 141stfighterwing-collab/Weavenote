## 2025-05-15 - Hardcoded Secrets & Admin Backdoor

**Vulnerability:** Hardcoded Firebase configuration keys and a default admin bootstrap password ("Zaqxsw12gobeavers") were present in the source code.

**Learning:** Development-time fallbacks for environment variables often persist into production, creating significant security risks if they contain sensitive credentials or administrative bypasses.

**Prevention:** Enforce strict environment variable checks and avoid providing default string values for sensitive configuration keys. Use a unified helper to access environment variables and ensure they are missing if not explicitly set.
