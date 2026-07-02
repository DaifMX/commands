# /sync — Regenerate provider commands from source

This monorepo has one canonical copy of every command in `source/` (ALL CAPS
files, provider-agnostic). Everything under `providers/<name>/` is **generated
output** — rendered from `source/` plus the metadata in `config.yaml`. Never
hand-edit files under `providers/`; edit `source/` instead and run `/sync`.

## What `/sync` does

1. **Render** — for every command in `config.yaml`, and every target it lists,
   render `source/<UPPER-NAME>.md` into that provider's format: add the
   provider's frontmatter (description, argument-hint, etc. from `config.yaml`),
   substitute provider-specific tokens (like the arg-placeholder), and strip any
   `<!-- only:... -->` blocks that don't apply to this provider.
2. **Diff** — compare the rendered output against what's currently on disk in
   `providers/<target>/`. If they differ, that file is stale (either source
   changed, or someone hand-edited the generated file).
3. **Write** — overwrite stale/missing provider files with the freshly rendered
   content.
4. **Prune** — delete generated files under `providers/<target>/` that no
   longer correspond to a configured command+target (e.g. a command removed
   from `config.yaml`, or a target dropped from a command's `targets:` list).
   Since `providers/` is entirely generated output, this always runs — not
   just with `--prune`.
5. **Relink** — rebuild the symlinks each tool reads its commands from.

## Instructions

### 1. Locate the repo root
This command lives in `<repo>/providers/{{PROVIDER}}/`. The repo root is the
directory that contains `config.yaml`, `source/`, `providers/`, and `scripts/`.
If unsure, ask the user for the absolute path to their `commands` clone.

### 2. Run the sync engine
Pass through any arguments the user gave (`--check`, `--prune`):
```bash
node <repo>/scripts/sync.mjs {{ARGS}}
```
- No args → apply: render everything, prune stale generated files, relink,
  report what changed.
- `--check` → dry run; report only (exits non-zero if anything is stale or
  would be pruned).
- `--prune` → also remove stale per-file *install symlinks* (e.g. in
  `~/.config/Code/User/prompts` for `install-mode: files` providers) for
  commands no longer configured for a given provider. Stale files inside
  `providers/<target>/` itself are always pruned, with or without this flag.

### 3. Report
Summarize: how many commands are configured, which provider files were
generated/updated, and which symlinks were (re)created. Remind the user that
new commands are added by dropping a file into `source/`, adding an entry under
`commands:` in `config.yaml`, and re-running `/sync` — and that new tools
(OpenCode, etc.) are added by adding a new entry under `providers:` in
`config.yaml`, not by writing new sync code.
