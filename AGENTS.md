# AGENTS.md (Repository Scope: `/workspace/Weavenote`)

This file provides agent-facing workflow guidance for this repository.

## Core workflow

1. Read this file before making changes.
2. Keep code changes small and focused.
3. Update docs and version metadata for user-visible behavior changes.
4. Run at least one validation command (build or tests) before finishing.
5. Include file+line citations in final status updates when your runtime requires them.

## Versioning + docs policy

When a change affects behavior visible to users:

- Bump `package.json` version using SemVer.
- Keep `metadata.json` version in sync.
- Keep top-level `package-lock.json` root package versions in sync.
- Add an entry in `CHANGELOG.md`.
- Update the version references in `README.md`.

## Notes UX rule

- Note cards are compact previews and should not render inline images.
- Selected/open note views (for example detail modal and notebook selected note) should render images when content contains valid markdown image syntax or supported HTML image tags.

## Testing

Preferred quick validation:

```bash
npm run build
```

If tests are present and fast, run them too.
