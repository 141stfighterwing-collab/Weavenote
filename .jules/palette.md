# Palette Journal - Weavenote

This journal tracks critical UX and accessibility learnings for the Weavenote project.

## 2025-05-15 - Improving Accessibility for Hover-Only Actions
**Learning:** Elements that only appear on hover (like action buttons in NoteCards) are completely inaccessible to keyboard users unless they have explicit focus states that also trigger their visibility.
**Action:** Always implement `focus-visible` rings and ensure focusable elements within hover-containers remain visible when they receive keyboard focus. Add ARIA labels to all icon-only buttons.
