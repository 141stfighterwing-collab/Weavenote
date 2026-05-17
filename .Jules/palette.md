## 2024-05-17 - [Keyboard-First Productivity in NoteInput]
**Learning:** Implementing `Cmd/Ctrl + Enter` in `NoteInput.tsx` significantly improves the "flow" for power users by allowing them to save without leaving the keyboard; this handler should be bound to all text-entry sub-components (title, editor, tags) to ensure consistent behavior.
**Action:** Always include a `handleKeyDown` listener on `contentEditable` editors and primary inputs to capture standard save/submit shortcuts.
