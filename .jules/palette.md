## 2026-05-01 - [Micro-UX Accessibility & Keyboard Productivity]
**Learning:** Adding semantic ARIA roles (e.g., `role="switch"`) and labels to custom toggles not only improves accessibility but also provides more robust locators for automated tests like Playwright, preventing flaky tests that rely on fragile text/parent traversal.
**Action:** Always prefer `getByLabel` or ARIA-based locators over fragile `locator('text=...').locator('..')` patterns.

## 2026-05-01 - [Keyboard Shortcut Hinting]
**Learning:** When adding keyboard shortcuts like Cmd/Ctrl+Enter, updating both the `title` and `aria-label` of the associated action button ensures that both power users (via tooltips) and screen reader users are aware of the shortcut.
**Action:** Consistently apply shortcut hints to tooltips and ARIA labels for primary actions.
