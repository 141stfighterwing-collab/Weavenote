## 2024-04-27 - [Keyboard Shortcuts for Inputs]
**Learning:** Adding keyboard shortcuts (like Cmd/Ctrl + Enter) to input-heavy components significantly improves productivity and "flow" for power users. However, these shortcuts must respect the same component state (e.g., loading/processing) as the visual buttons they represent to avoid race conditions or duplicate submissions.
**Action:** Always include state-checking logic in shortcut handlers to mirror the 'disabled' behavior of associated UI buttons.
