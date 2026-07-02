# INSTALL.md — bootstrap this repo for an AI coding assistant

You are an LLM-based coding assistant that has just been pointed at this repo
(or asked to set it up). This file is a self-contained runbook: follow it
top-to-bottom and the user will end up with this repo's slash commands
(`/commit`, `/sync`, `/setup`, `/ticket`, `/parse-ticket`, `/ticket-refresh`)
available in whichever tool(s) they use — without needing any command to
already be installed first (that's the chicken-and-egg problem this file
solves).

Do not ask the user to read documentation and do it themselves — run the
commands yourself, using the shell/file tools available to you, and report
back what you did.

## 0. Orient yourself

- `$REPO` = the absolute path to this repo (the directory containing this
  file, `config.yaml`/`example.config.yaml`, `source/`, `providers/`, and
  `scripts/sync.mjs`). If you were invoked from inside it, that's `$REPO`. If
  not, ask the user for the path to their clone, or offer to clone it:
  `git clone https://github.com/DaifMX/commands "$REPO"`.
- Confirm Node.js is available and >= 16: `node --version`. The sync engine
  has zero npm dependencies — nothing to `npm install`.

## 1. Detect which tool(s) are on this machine

Don't assume — check:

| Tool | Signal to check |
|---|---|
| Claude Code | `~/.claude` directory exists, or the user mentions Claude Code |
| GitHub Copilot / VS Code | VS Code is installed and/or `~/.config/Code` (Linux), `~/Library/Application Support/Code` (macOS), or `%APPDATA%\Code` (Windows) exists — use `Code - Insiders` instead of `Code` if that's the edition in use |

If only one tool is present, that's fine — `config.yaml` lets you scope
commands to just that tool's `targets`.

## 2. Create the machine-local config

`config.yaml` is gitignored (machine-specific paths/selection); the repo only
ships `example.config.yaml` as a template. If `config.yaml` doesn't already
exist:

```bash
cp "$REPO/example.config.yaml" "$REPO/config.yaml"
```

Then open `config.yaml` and adjust, if needed:

- **`install:`** — the directory each provider's commands get symlinked into.
  Defaults:
  ```yaml
  install:
    claude-code: ~/.claude/commands
    copilot: ~/.config/Code/User/prompts   # macOS: ~/Library/Application Support/Code/User/prompts
                                            # Windows: %APPDATA%\Code\User\prompts
                                            # Insiders: replace Code with "Code - Insiders"
  ```
  Fix the `copilot` path for the detected OS/edition from step 1.
- **`commands: <name>: targets:`** — which tool(s) each command should be
  rendered/linked for. If a tool isn't installed on this machine, you can
  leave its commands configured (harmless — sync just won't have anywhere to
  link them) or drop that provider from each command's `targets` list. Don't
  remove a provider from `providers:` unless the user asks — that's the
  render config, not the install selection.

You do not need to touch `source/` or `providers/` — those are checked-in
inputs/generated outputs, not machine config.

## 3. Run the sync engine

```bash
node "$REPO/scripts/sync.mjs"
```

This, in one pass:
1. Renders every configured command from `source/<NAME>.md` into
   `providers/<tool>/<name><ext>` (adding/stripping frontmatter per tool).
2. Reports any drift for commands marked `mirror: true` (nothing is
   overwritten automatically).
3. Rebuilds the install symlinks from step 2's `install:` paths:
   - Claude Code: one directory symlink, `~/.claude/commands -> $REPO/providers/claude-code`.
   - Copilot: one file symlink per command inside the prompts directory.

If a real (non-symlink) directory or file already sits at an install path,
the script will warn and skip it rather than overwrite — surface that to the
user and ask how they want to reconcile it (move their files into `source/`
first, or remove the conflicting path) before re-running.

Useful flags:
```bash
node "$REPO/scripts/sync.mjs" --check     # dry run, non-zero exit if anything is stale/drifted
node "$REPO/scripts/sync.mjs" --prune     # also remove stale per-file Copilot symlinks
```

## 4. Verify

```bash
ls -la ~/.claude/commands          # expect an -> arrow to $REPO/providers/claude-code
ls -la ~/.config/Code/User/prompts # (or the OS-appropriate path) expect *.prompt.md -> symlinks
```

Confirm at least one command file is visible through each symlink.

## 5. Tell the user

- Which tool(s) got linked, and to where.
- That Claude Code picks up new commands immediately; VS Code/Copilot picks
  them up on the next window reload.
- That commands are authored once in `source/<NAME>.md` (provider-agnostic
  Markdown) — never hand-edit files under `providers/`, they're regenerated.
- That `config.yaml` controls which command goes to which tool, and re-running
  `node scripts/sync.mjs` (or `/sync`, once installed) is always safe/idempotent.
