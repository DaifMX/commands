---
name: "setup"
description: "Link this commands monorepo into place so its commands are available as slash commands."
---

Link this commands monorepo into place so every command in `providers/codex/` is available in the target tool.

## Instructions

### 1. Find the repo path
Ask the user (or infer from the current working directory):
> "What is the absolute path to your local clone of the **commands** monorepo?
> Example: /home/you/Code/commands"

Call it `$REPO`. The directory that matters here is `$REPO/providers/codex`.

### 2. Locate the Codex skills directory

Codex loads user-level skills from `~/.codex/skills`. Check it first:
```
ls -la ~/.codex/skills
```

If it does not exist, create it:
```bash
mkdir -p ~/.codex/skills
```

### 3. Link each skill directory
For every skill directory in `$REPO/providers/codex`, create a symlink with the
same name in `~/.codex/skills`:
```bash
for f in "$REPO"/providers/codex/*; do
  [ -d "$f" ] || continue
  name=$(basename "$f")
  if [ -e "$HOME/.codex/skills/$name" ] && [ ! -L "$HOME/.codex/skills/$name" ]; then
    echo "WARNING: $HOME/.codex/skills/$name exists and is not a symlink — skipping"
    continue
  fi
  ln -sfn "$f" "$HOME/.codex/skills/$name"
done
```

### 4. Verify
```
ls -la ~/.codex/skills
```

Confirm each skill is an `->` symlink pointing into `$REPO/providers/codex` and
contains a `SKILL.md`. Restart Codex if the skills do not appear. Invoke them
by typing `$<name>` (for example, `$commit`) or select them from `/skills`.

### 5. Report
Tell the user:
- What got linked and where
- That commands are edited in `$REPO/source/` (not under `providers/`), and
  `config.yaml` controls which tool(s) each command renders into
- That running `/sync` (or `$sync` in Codex, or
  `node $REPO/scripts/sync.mjs`) regenerates every provider's commands from
  `source/` and rebuilds all symlinks — including this one — so it's safe to
  re-run any time
