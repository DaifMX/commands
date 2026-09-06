---
description: "Link this commands monorepo into place so its commands are available as slash commands."
---

Link this commands monorepo into place so every command in `providers/claude-code/` is available in the target tool.

## Instructions

### 1. Find the repo path
Ask the user (or infer from the current working directory):
> "What is the absolute path to your local clone of the **commands** monorepo?
> Example: /home/you/Code/commands"

Call it `$REPO`. The directory that matters here is `$REPO/providers/claude-code`.

### 2. Check for an existing ~/.claude/commands

Run:
```
ls -la ~/.claude/commands
```

| State | What to do |
|-------|-----------|
| Does not exist | Proceed directly to step 3 |
| Symlink already pointing to `$REPO/providers/claude-code` | Tell the user it's already set up and stop |
| Symlink pointing elsewhere | Warn the user, ask if they want to replace it |
| A real directory with files | Warn the user this looks like hand-written commands living outside the repo; ask before replacing it with the symlink (their files would no longer be loaded) |

### 3. Create the symlink

```bash
rm -rf ~/.claude/commands 2>/dev/null || true
ln -s "$REPO/providers/claude-code" ~/.claude/commands
```

### 4. Verify

```
ls -la ~/.claude/commands
```

Confirm the output shows an `->` arrow pointing to `$REPO/providers/claude-code` and
that at least one `.md` file is visible inside.

### 5. Report
Tell the user:
- What got linked and where
- That commands are edited in `$REPO/source/` (not under `providers/`), and
  `config.yaml` controls which tool(s) each command renders into
- That running `/sync` (or `$sync` in Codex, or
  `node $REPO/scripts/sync.mjs`) regenerates every provider's commands from
  `source/` and rebuilds all symlinks — including this one — so it's safe to
  re-run any time
