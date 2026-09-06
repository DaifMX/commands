Link this commands monorepo into place so every command in `providers/{{PROVIDER}}/` is available in the target tool.

## Instructions

### 1. Find the repo path
Ask the user (or infer from the current working directory):
> "What is the absolute path to your local clone of the **commands** monorepo?
> Example: /home/you/Code/commands"

Call it `$REPO`. The directory that matters here is `$REPO/{{PROVIDER_DIR}}`.

<!-- only:claude-code -->
### 2. Check for an existing ~/.claude/commands

Run:
```
ls -la ~/.claude/commands
```

| State | What to do |
|-------|-----------|
| Does not exist | Proceed directly to step 3 |
| Symlink already pointing to `$REPO/{{PROVIDER_DIR}}` | Tell the user it's already set up and stop |
| Symlink pointing elsewhere | Warn the user, ask if they want to replace it |
| A real directory with files | Warn the user this looks like hand-written commands living outside the repo; ask before replacing it with the symlink (their files would no longer be loaded) |

### 3. Create the symlink

```bash
rm -rf ~/.claude/commands 2>/dev/null || true
ln -s "$REPO/{{PROVIDER_DIR}}" ~/.claude/commands
```

### 4. Verify

```
ls -la ~/.claude/commands
```

Confirm the output shows an `->` arrow pointing to `$REPO/{{PROVIDER_DIR}}` and
that at least one `.md` file is visible inside.
<!-- /only -->

<!-- only:copilot -->
### 2. Locate the VS Code user prompts directory
Depending on platform/edition it is one of:
- Linux: `~/.config/Code/User/prompts`
- macOS: `~/Library/Application Support/Code/User/prompts`
- Windows: `%APPDATA%\Code\User\prompts`
- VS Code Insiders: replace `Code` with `Code - Insiders`

Create it if it does not exist (`mkdir -p`).

### 3. Link each prompt file
For every `*.prompt.md` in `$REPO/{{PROVIDER_DIR}}`, create a symlink of the same
name in the prompts directory:
```bash
for f in "$REPO"/{{PROVIDER_DIR}}/*.prompt.md; do
  ln -sf "$f" "$PROMPTS_DIR/$(basename "$f")"
done
```
Warn before overwriting any existing non-symlink file.

### 4. Verify
List the prompts directory and confirm each entry is an `->` symlink pointing
into `$REPO/{{PROVIDER_DIR}}`.
<!-- /only -->

<!-- only:codex -->
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
For every skill directory in `$REPO/{{PROVIDER_DIR}}`, create a symlink with the
same name in `~/.codex/skills`:
```bash
for f in "$REPO"/{{PROVIDER_DIR}}/*; do
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

Confirm each skill is an `->` symlink pointing into `$REPO/{{PROVIDER_DIR}}` and
contains a `SKILL.md`. Restart Codex if the skills do not appear. Invoke them
by typing `$<name>` (for example, `$commit`) or select them from `/skills`.
<!-- /only -->

### 5. Report
Tell the user:
- What got linked and where
- That commands are edited in `$REPO/source/` (not under `providers/`), and
  `config.yaml` controls which tool(s) each command renders into
- That running `/sync` (or `$sync` in Codex, or
  `node $REPO/scripts/sync.mjs`) regenerates every provider's commands from
  `source/` and rebuilds all symlinks — including this one — so it's safe to
  re-run any time
