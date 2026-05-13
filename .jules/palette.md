## 2025-05-13 - [Accessibility and Keyboard Productivity]
**Learning:** Icon-only buttons in the NoteInput and NoteCard components lacked ARIA labels and titles, making them inaccessible to screen readers and providing no tooltips for sighted users. Additionally, the lack of a "Save" shortcut (Cmd/Ctrl + Enter) was a missed opportunity for a "delight" feature in a productivity app.
**Action:** Always include `aria-label` and `title` for icon-only buttons. Implement standard productivity shortcuts like `Cmd/Ctrl + Enter` for primary actions to improve UX for power users.
