# Palette Journal 🎨

## 2026-04-02 - [Accessibility & Micro-UX Enhancements]
**Learning:** Adding ARIA labels and tooltips to icon-only buttons significantly improves both accessibility for screen readers and usability for sighted users by providing immediate context on hover. Using `role="switch"` for toggles provides better semantic context than simple buttons. Robust test locators should prefer `getByLabel` over DOM hierarchy to remain resilient to UI structural changes.
**Action:** Always include `aria-label` and `title` for new icon-only buttons. Use semantic ARIA roles for custom toggles. Prefer accessible locators in Playwright tests.
