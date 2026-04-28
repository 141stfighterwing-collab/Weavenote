## 2026-04-28 - [Keyboard Shortcuts & Accessibility Hardening]
**Learning:** In rich-text editors (`contentEditable`), users expect `Cmd/Ctrl + Enter` to submit/save content. Providing a consistent shortcut across all input fields (Title, Editor, Tags) significantly improves the authoring flow. Additionally, icon-only buttons in complex toolbars are invisible to screen readers unless explicitly labeled with `aria-label`.
**Action:** Always implement a global-style shortcut for primary actions in multi-input components and ensure every icon-button has an `aria-label` and matching `title`.
