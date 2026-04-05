## 2026-04-02 - [Robust Test Locators through Accessibility]
**Learning:** Using semantic roles and aria-labels (like `role="switch"` and `aria-label`) provides robust hooks for Playwright's `getByLabel` and `getByRole` locators, which are less fragile than DOM-traversal locators like `locator('..')`.
**Action:** Always prefer `aria-label` for icon-only or custom toggle components to improve both a11y and test stability.
