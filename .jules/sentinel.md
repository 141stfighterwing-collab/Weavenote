## 2025-05-22 - [Hardcoded Secrets and Fail-Secure Pattern]
**Vulnerability:** Hardcoded admin bootstrap password ("Zaqxsw12gobeavers") and a default fallback for JWT_SECRET.
**Learning:** Hardcoded fallbacks in configuration files often persist into production environments if not explicitly blocked.
**Prevention:** Implement "fail-secure" patterns at the application entry point that terminate the process if critical security environment variables (like JWT_SECRET) are missing or empty. Ensure all bootstrap or administrative overrides require explicit, non-empty environment variable values.

## 2025-05-23 - [Prisma ORM Authorization Bypass in OR Clauses]
**Vulnerability:** Passing "undefined" to a filter in a Prisma "where" clause (e.g., inside an OR array) causes that specific filter to be ignored. If all conditions in an OR block are ignored or collapse, it can result in an empty filter "{}" which matches all records.
**Learning:** Prisma 5+ treats "undefined" as "do not filter by this field". In the templates route, "userId: undefined" for guests meant the query matched ALL templates instead of just global ones.
**Prevention:** Use the spread operator or explicit checks to only include filters in the "where" object when the values are defined. Always explicitly filter for "null" when searching for global/public resources.
