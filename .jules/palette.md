## 2025-05-22 - Shortcut & Accessibility Hardening in NoteInput

**Learning:** Enhancing single-letter formatting buttons (B, I, U, S) with descriptive ARIA labels and titles significantly improves screen reader clarity and discoverability. Combining these with a `Cmd/Ctrl + Enter` shortcut for the primary save action provides a cohesive power-user experience that remains accessible.

**Action:** Always pair icon-only or single-letter UI elements with both `aria-label` and `title`. For primary forms, implement the `Cmd/Ctrl + Enter` shortcut consistently across all sub-inputs (Title, Body, Tags) to allow a seamless "finish" interaction.
