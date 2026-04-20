# Palette's UX & Accessibility Journal 🎨

## 2026-04-20 - [Accessibility: ContentEditable & Icon Buttons]
**Learning:** ContentEditable divs are invisible to screen readers unless they have a `role="textbox"` and `aria-multiline="true"`. Similarly, icon-only buttons require both `title` (for mouse users) and `aria-label` (for screen readers) to be fully accessible.
**Action:** Always apply semantic roles and descriptive labels to interactive non-standard elements like contentEditable editors and icon-only toolbar buttons.

## 2026-04-20 - [Productivity: Global Keyboard Shortcuts]
**Learning:** Users in note-taking apps expect `Ctrl+Enter` to save or submit content. Implementing this at a container level allows the shortcut to work across multiple input fields (Title, Content, Tags) via event bubbling.
**Action:** Implement container-level keyboard listeners for primary actions to provide a cohesive shortcut experience across complex forms.
