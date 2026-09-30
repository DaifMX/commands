Implement a described change in a fresh git worktree on a new branch, commit it with an Angular-style message, push, and open a pull request against the default branch.

<!-- only:claude-code,copilot -->
The user's request:

```
{{ARGS}}
```
<!-- /only -->
<!-- only:codex -->
The user's request is the text that accompanies this skill's invocation.
<!-- /only -->

## Instructions

Follow these steps exactly. Everything after step 3 happens **inside the new worktree** — never edit, stage, or commit in the original checkout.

### 1. Understand the request

The arguments above are a free-text description of what to build or fix, optionally followed by flags:

| Flag | Effect |
|------|--------|
| `--base <branch>` | Branch the work off, and target the PR at, `<branch>` instead of the default branch |
| `--branch <name>` | Use this exact branch name instead of deriving one |
| `--draft` | Open the PR as a draft |

If the description is empty or too vague to act on, ask the user what they want done and stop until they answer.

### 2. Gather repo context

Run these in parallel:
- `git rev-parse --show-toplevel` — the repo root (call it `$ROOT`)
- `git status --short` — note (but do not touch) any uncommitted work in the current checkout
- `git remote -v` — confirm there is an `origin`
- `git log --oneline -10` — recent commits, to match type/scope conventions
- `git remote get-url origin` — the remote URL (call its host `$HOST` and its `<owner>/<repo>` path `$SLUG`)

**Detect the forge** from the `origin` remote. The PR in step 8 uses the matching CLI:

| Forge | How to tell | CLI |
|-------|-------------|-----|
| GitHub | `$HOST` is `github.com`, or `gh auth status --hostname "$HOST"` succeeds (GitHub Enterprise) | `gh` |
| Gitea / Forgejo | `tea login list -o simple` has a login whose URL or SSH host matches `$HOST`, or `curl -fsS "https://$HOST/api/v1/version"` returns a version JSON | `tea` (tea-cli) |
| Other / unknown | neither of the above | none — print a compare URL in step 8 |

Call the result `$FORGE`. If the forge is GitHub or Gitea but its CLI is missing (`command -v gh` / `command -v tea`) or not logged in for `$HOST`, tell the user now, suggest how to fix it (`gh auth login`, or `tea login add --url https://$HOST`), and continue. Step 8 will fall back to a compare URL.

**Find the default branch** (call it `$BASE`, or use `--base` if given):
- GitHub: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
- Otherwise, or if that fails: `git ls-remote --symref origin HEAD` (the `ref: refs/heads/<name>` line), then `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`), then `main`/`master`, whichever exists on `origin`.

Then fetch the latest base: `git fetch origin "$BASE"`.

### 3. Create the branch and worktree

**Branch name** — unless `--branch` was given, derive `<type>/<slug>`:
- `<type>` — the Angular type that best fits the request (`feat`, `fix`, `refactor`, `docs`, `chore`, …; see the table in step 6)
- `<slug>` — 2–5 lowercase, hyphen-separated words summarising the request, e.g. `feat/dark-mode-toggle`, `fix/token-expiry-crash`

If the branch already exists locally or on `origin`, append `-2`, `-3`, … until it is unique.

**Worktree path** — a sibling directory of the repo so it never lands inside the working tree:
```
$WT = <parent of $ROOT>/<repo dir name>.worktrees/<slug>
```

Create both in one step, branching from the freshly fetched base:
```
git worktree add -b "<branch>" "$WT" "origin/$BASE"
```

Tell the user the branch name and worktree path before continuing.

<!-- only:claude-code -->
From now on, run every shell command with `$WT` as the working directory (`cd "$WT" && …` or `git -C "$WT" …`) and use absolute paths under `$WT` for every file read and edit.
<!-- /only -->
<!-- only:copilot -->
From now on, run every terminal command from `$WT` (`cd "$WT"` first, or `git -C "$WT" …`) and read/edit files only via absolute paths under `$WT`.
<!-- /only -->

### 4. Prepare the worktree

A new worktree has no untracked files — no installed dependencies, no build output, no local env files. If the change needs them to build or test:
- Install dependencies with the project's own tooling (e.g. `npm ci`, `pnpm install`, `uv sync`, `bundle install`).
- If local config files that are gitignored (e.g. `.env`, `config.yaml`) are required, ask the user before copying them from `$ROOT` — never commit them.

### 5. Implement the change

Do the work described in step 1 inside `$WT`:
- Read the relevant code first and match the surrounding style, naming, and idioms.
- Keep the change scoped to what was asked; do not refactor unrelated code.
- Update or add tests and docs where the project has them.
- Run the project's checks that apply (tests, lint, type-check, build). Fix failures caused by your change. If a failure is pre-existing or you cannot fix it, note it for the PR description rather than hiding it.

If you hit a decision that genuinely belongs to the user (ambiguous requirement, destructive migration, new dependency), ask before proceeding.

### 6. Commit (same rules as `/commit`)

From `$WT`, run in parallel:
- `git status --short`
- `git diff HEAD`

If nothing changed, tell the user, remove the worktree and branch (`git worktree remove "$WT" && git branch -D "<branch>"`), and stop.

Stage with `git add -A`, but do NOT stage files that look like secrets or credentials (`.env`, `*.key`, `*.pem`, `credentials.*`) — warn the user if any are present.

Craft an Angular-style message:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

| Type | When to use | semantic-release effect |
|------|-------------|------------------------|
| `feat` | New feature or capability | MINOR bump |
| `fix` | Bug fix | PATCH bump |
| `perf` | Performance improvement | PATCH bump |
| `revert` | Reverts a previous commit | PATCH bump |
| `docs` | Documentation only | no release |
| `style` | Formatting, whitespace | no release |
| `refactor` | Code restructure, no behavior change | no release |
| `test` | Adding or fixing tests | no release |
| `build` | Build system, dependencies | no release |
| `ci` | CI/CD pipeline changes | no release |
| `chore` | Housekeeping, tooling | no release |

- **Scope** (optional) — a short noun for the affected subsystem, derived from the files changed. Omit if changes span many areas.
- **Subject** — imperative mood, lowercase, no trailing period, header ≤72 chars.
- **Breaking changes** — append `!` after type/scope and add a `BREAKING CHANGE: <description>` footer.
- **Body** (optional) — the *why*, not the *what*; wrap at 72 chars.

The commit type should normally match the branch prefix; if the work turned out to be a different type, prefer the accurate commit type.

Show the user the message, then commit:
```
git commit -m "$(cat <<'EOF'
<generated message here>
EOF
)"
```

If the work is naturally several independent changes, you may split it into multiple commits following the same rules.

### 7. Push

Push the branch and set upstream (no confirmation needed — the PR requires it):
```
git push -u origin "<branch>"
```

### 8. Open the pull request

Write the PR body (use it for every forge below):

```
## Summary
<1–3 bullets: what changed and why>

## Changes
<bullet list of notable changes, grouped by area>

## Testing
<what you ran and the result; call out anything not verified or pre-existing failures>
```

Use the (first) commit header as the PR title so squash-merges stay semantic-release friendly. Then create the PR with the CLI for `$FORGE`:

**GitHub (`gh`):**
```
gh pr create --base "$BASE" --head "<branch>" --title "<commit header>" --body "$(cat <<'EOF'
<PR body>
EOF
)"
```
Add `--draft` if the user passed `--draft`. `gh` prints the PR URL.

**Gitea / Forgejo (`tea`):**
```
tea pulls create --remote origin --repo "$SLUG" --base "$BASE" --head "<branch>" --title "<commit header>" --description "$(cat <<'EOF'
<PR body>
EOF
)"
```
- Add `--draft` if the user passed `--draft` (tea prefixes the title with `WIP: `, which Gitea treats as a draft).
- `--remote origin` makes tea pick the login that matches the remote. If several logins match or it picks the wrong one, pass `--login <name>` from `tea login list` instead.
- If tea doesn't print the PR URL, find it with `tea pulls list --remote origin --repo "$SLUG" --state open --fields index,title,head,url`.

**Fallback** (unknown forge, or the CLI is missing, not logged in, or the command fails): don't retry blindly. Show the error, and print a compare URL the user can open to create the PR by hand:
- GitHub: `https://github.com/$SLUG/compare/$BASE...<branch>?expand=1` (use `$HOST` for GitHub Enterprise)
- Gitea / Forgejo: `https://$HOST/$SLUG/compare/$BASE...<branch>`
- Other: the web URL of `origin`, with a note that the branch is pushed and ready for a PR

### 9. Report

Print:
- Worktree path (`$WT`) and branch name
- Commit SHA(s) (`git rev-parse --short HEAD`)
- PR URL (or the compare URL if the PR could not be created automatically)
- How to clean up after merging:
  ```
  git worktree remove "$WT" && git branch -d "<branch>"
  ```

Leave the worktree in place so the user can review or iterate on it.
