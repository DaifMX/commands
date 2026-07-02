---
name: "setup"
description: "Link this commands monorepo into place so its commands are available as slash commands."
agent: "agent"
---

Link this commands monorepo into place so every command in `providers/copilot/` is available as a slash command.

## Instructions

### 1. Find the repo path
Ask the user (or infer from the current working directory):
> "What is the absolute path to your local clone of the **commands** monorepo?
> Example: /home/you/Code/commands"

Call it `$REPO`. The directory that matters here is `$REPO/providers/copilot`.

### 2. Locate the VS Code user prompts directory
Depending on platform/edition it is one of:
- Linux: `~/.config/Code/User/prompts`
- macOS: `~/Library/Application Support/Code/User/prompts`
- Windows: `%APPDATA%\Code\User\prompts`
- VS Code Insiders: replace `Code` with `Code - Insiders`

Create it if it does not exist (`mkdir -p`).

### 3. Link each prompt file
For every `*.prompt.md` in `$REPO/providers/copilot`, create a symlink of the same
name in the prompts directory:
```bash
for f in "$REPO"/providers/copilot/*.prompt.md; do
  ln -sf "$f" "$PROMPTS_DIR/$(basename "$f")"
done
```
Warn before overwriting any existing non-symlink file.

### 4. Verify
List the prompts directory and confirm each entry is an `->` symlink pointing
into `$REPO/providers/copilot`.

### 5. Report
Tell the user:
- What got linked and where
- That commands are edited in `$REPO/source/` (not under `providers/`), and
  `config.yaml` controls which tool(s) each command renders into
- That running `/sync` (or `node $REPO/scripts/sync.mjs`) regenerates every
  provider's commands from `source/` and rebuilds all symlinks — including this
  one — so it's safe to re-run any time
