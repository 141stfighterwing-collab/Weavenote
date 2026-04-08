## 2026-04-08 - [Interactive Elements Focus State]
**Learning:** Elements visible only on hover (like the folder delete button) are inaccessible to keyboard users if they don't have corresponding focus-visible states.
**Action:** Always implement focus-visible:opacity-100 and focus rings for hover-only interactive elements.

## 2026-04-08 - [Playwright Interaction with Animated Modals]
**Learning:** CSS animations like 'fadeIn' on containers (e.g., SettingsPanel) can intercept pointer events while the animation is playing, leading to test timeouts in Playwright.
**Action:** Use page.getByLabel() or other accessible locators and ensure stable states or slightly delay interactions if animations are present.
