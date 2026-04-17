## 2025-05-14 - NoteInput and Settings Accessibility Polish
**Learning:** Common interactive elements like toolbar buttons and custom toggles often lack ARIA labels and semantic roles, making them inaccessible to screen readers. Providing keyboard shortcut hints in tooltips significantly improves power-user discoverability.
**Action:** Always ensure icon-only buttons have `aria-label` and `title`. Use `role="switch"` and `aria-checked` for custom toggles.
