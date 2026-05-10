## 2026-05-10 - [Hardcoded Secrets and Default Credentials]
**Vulnerability:** Discovered hardcoded Firebase API keys in `config.ts` and a default admin bootstrap password in `services/authService.ts`.
**Learning:** Legacy configuration patterns and "convenience" features often leave hardcoded secrets that bypass environment variable checks if they are not strictly enforced.
**Prevention:** Always use environment variable lookups and throw errors or disable features if required security credentials are not provided. Never provide "fallback" secrets in the source code.
