# Sentinel's Journal - Weavenote

This journal tracks critical security learnings for the Weavenote codebase.

## 2025-05-22 - Hardcoded JWT Secret and Missing Fail-Fast Checks
**Vulnerability:** The backend had a hardcoded default `JWT_SECRET` in `config/index.js`, which would be used if the environment variable was missing.
**Learning:** Hardcoded defaults for sensitive secrets often persist into production environments because the application "just works" even without proper configuration, leading to significant security risks.
**Prevention:** Always implement "fail-fast" patterns for security-critical configuration. If a mandatory secret like `JWT_SECRET` is missing, the application should terminate immediately with a clear error message during the startup sequence.
