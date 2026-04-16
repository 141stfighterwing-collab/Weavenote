# Palette's UX & Accessibility Journal

## 2026-04-02 - Keyboard Shortcut Discoverability & Editor Accessibility
**Learning:** For web applications with rich text or complex data entry, keyboard shortcuts (like `Cmd/Ctrl + Enter`) are essential for power users, but they must be discoverable. Adding shortcut hints to button `title` attributes and implementing them consistently across all focused elements (Title, Main Editor, Code Editor) creates a "flow state" for the user. Additionally, `contentEditable` divs must be explicitly tagged with `role="textbox"` and `aria-label` to be usable by screen readers.
**Action:** Always include shortcut hints in tooltips for primary actions and ensure all custom input elements have semantic roles.
