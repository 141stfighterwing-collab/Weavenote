## 2025-05-15 - Hardcoded Credentials in Authentication Logic
**Vulnerability:** Hardcoded admin password and Firebase configuration secrets.
**Learning:** Legacy bootstrap logic often contains hardcoded "backdoor" credentials for initial setup that are easily forgotten.
**Prevention:** Always use environment variable lookups for any form of credential or configuration secret, even for bootstrap/admin accounts.
