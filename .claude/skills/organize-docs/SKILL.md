---
name: organize-docs
description: Keep the repo's documentation tidy. Use when asked to organize/tidy/sort the docs, when stray .md or .txt files have accumulated at the repo root or elsewhere, or after creating new documentation that should be filed. Moves loose docs into the categorized docs/ tree and updates the docs index.
---

# Organize Docs

Keep all project documentation under `docs/`, categorized, with an up-to-date index. The repo root and code directories should stay free of stray documentation.

## What counts as a "stray doc"
A `.md` or `.txt` file that documents the project but is sitting outside `docs/`.

**Never move these (leave in place):**
- Root anchors: `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `LICENSE*`
- Anything under `.claude/` (agent config and knowledge files)
- A `README.md` that sits inside a code package/module directory (e.g. `automation/plc_automation/README.md`) — it documents that code and belongs next to it
- `node_modules/`, `.next/`, `.git/`, `archive/`, and other build/vendor/ignored dirs

Everything else that is documentation → move into `docs/`.

## Categories
Place each doc in the best-fitting subfolder under `docs/` (create the folder if missing):

| Folder | For |
|---|---|
| `docs/ai/` | AI features, Claude/LLM integration, vision agent |
| `docs/automation/` | Python automation, PLC programming guides, wiring/testing |
| `docs/architecture/` | System design, simulation/digital-twin, deployment models |
| `docs/deployment/` | Install notes, deployment, database/infra setup |
| `docs/marketing/` | SEO, social/marketing strategy |
| `docs/product/` | Feature guides, quick references, session/build summaries |

If a doc fits none of these, create a new, clearly named category folder rather than forcing a bad fit. If genuinely ambiguous, ask the user where it belongs instead of guessing.

## Procedure
1. **Find strays:** list candidate docs with
   `git ls-files '*.md' '*.txt' | grep -v '^docs/' | grep -v '^\.claude/'`
   then exclude the root anchors and any in-package `README.md` files (see above).
2. **Move with history preserved:** use `git mv <file> docs/<category>/<file>` for each (never plain `mv` on tracked files; never overwrite an existing target — if a name collides, keep them distinct by category or rename with a clarifying suffix).
3. **Update the index:** edit `docs/README.md` so every moved file has a one-line entry under its category. Create `docs/README.md` if it doesn't exist.
4. **Fix references:** if `README.md` (root) or other docs linked to a moved file by its old path, update those links to the new `docs/<category>/...` path.
5. **Report:** print a short summary of what moved where, and flag anything you left in place or were unsure about.

## Constraints
- Only move documentation. Do not touch source code, config, data files, or assets.
- Preserve git history (`git mv`).
- Do not commit unless the user asks — leave the moves staged/working for review.
