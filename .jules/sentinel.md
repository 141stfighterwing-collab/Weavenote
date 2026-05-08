## 2024-05-08 - Hardcoded Admin Password
**Vulnerability:** A hardcoded default password "Zaqxsw12gobeavers" was present in the admin bootstrap logic.
**Learning:** Hardcoded fallbacks in authentication logic are easy to overlook and provide a backdoor if the environment variable is not set.
**Prevention:** Always require explicit environment variables for sensitive credentials and fail closed if they are missing.
