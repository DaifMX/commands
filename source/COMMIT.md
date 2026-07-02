Commit staged and unstaged changes to the current branch using an Angular-style commit message that satisfies semantic-release conventions.

## Instructions

Follow these steps exactly:

### 1. Gather context

Run these in parallel:
- `git status --short` — list all changed/untracked files
- `git diff HEAD` — full diff of all changes (staged + unstaged)
- `git log --oneline -5` — recent commits to match style/scope patterns

If `git diff HEAD` is empty and there are no untracked files, tell the user there is nothing to commit and stop.

### 2. Determine what to stage

If the user passed arguments to this command (e.g. `/commit src/` or `/commit -u`), use those as the paths/flags for `git add`. Otherwise stage everything with `git add -A`.

Do NOT stage files that look like secrets or credentials (`.env`, `*.key`, `*.pem`, `credentials.*`). Warn the user if any such files are detected among the changes.

### 3. Craft the commit message

Analyse the diff and produce an Angular-style message:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Type** — choose the single best fit:

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

**Scope** (optional) — a short noun naming the subsystem affected, e.g. `(auth)`, `(api)`, `(bot)`, `(db)`. Derive it from the files changed. Omit if changes span many areas.

**Subject** — imperative mood, lowercase, no trailing period, ≤72 chars total for the header line.

**Breaking changes** — if the diff removes a public API, changes a contract, or is otherwise backward-incompatible:
- Append `!` after the type/scope: `feat(api)!: rename endpoint`
- Add a `BREAKING CHANGE: <description>` footer (triggers MAJOR bump)

**Body** (optional) — explain the *why*, not the *what*. Wrap at 72 chars. Skip if the subject is self-explanatory.

**Footer** — besides `BREAKING CHANGE`, you may add issue references: `Closes #42`.

### 4. Commit

Run:
```
git commit -m "$(cat <<'EOF'
<generated message here>
EOF
)"
```

Show the user the exact commit message before committing so they can see what will be used.

### 5. Push (optional)

After a successful commit, ask the user:
> "Push to `origin/<branch>`? (yes/no)"

If they confirm, run `git push origin <current-branch>`.

If the user included `--push` or `-p` in the original command arguments, push automatically without asking.

### 6. Report

Print:
- The commit SHA (from `git rev-parse --short HEAD`)
- The branch name
- Whether it was pushed

---

## Angular Commit Examples

```
feat(bot): add /ask agent command with OpenRouter integration

fix(auth): prevent token expiry from crashing the startup sequence

chore(deps): update spring-boot to 3.4.1

docs: add OCI deployment guide to README

feat(api)!: replace v1 endpoints with v2 REST interface

BREAKING CHANGE: all /v1/* routes are removed; migrate to /v2/*
```
