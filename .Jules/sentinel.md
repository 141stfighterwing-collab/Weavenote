## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.
