# Palette's Journal - Critical UX & Accessibility Learnings

## 2026-05-04 - Enhancing Discoverability for Hidden Actions
**Learning:** Components that are only visible on hover (like the folder delete button in this app) are completely inaccessible to keyboard users and screen readers unless they are explicitly forced into visibility on focus.
**Action:** Use `focus-visible:opacity-100` alongside `group-hover:opacity-100` to ensure interactive elements are discoverable. Always pair icon-only buttons with both `title` (for mouse tooltips) and `aria-label` (for assistive tech).
