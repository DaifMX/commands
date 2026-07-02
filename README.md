<div align="center">

# ⌘ commands

**One monorepo. Two AI coding assistants. The same slash commands everywhere.**

A single source of truth for [Claude Code](https://claude.ai/code) and
[GitHub Copilot](https://github.com/features/copilot) slash commands — authored
once, mirrored to both, kept honest by a `config.yaml` and a `/sync` command.

<br>

![Claude Code](https://img.shields.io/badge/Claude_Code-.md-D97757?style=for-the-badge)
![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-.prompt.md-6e40c9?style=for-the-badge)
![Sync](https://img.shields.io/badge/sync-config--driven-2ea44f?style=for-the-badge)
![Deps](https://img.shields.io/badge/dependencies-zero-black?style=for-the-badge)

</div>

---

## Why

Claude Code reads plain `*.md` command files from `~/.claude/commands`.
GitHub Copilot reads `*.prompt.md` files (with YAML frontmatter) from VS Code's
prompts folder. Same idea, two formats, two directories — and they drift.

This repo keeps them in lockstep. You declare your commands in one
[`config.yaml`](config.yaml); `/sync` renders each command into whichever tools
you asked for, in that tool's native format, and rebuilds the symlinks both
tools load from.

---

## Layout

```
commands/
├── claude-code/          # Claude Code commands  →  <name>.md
│   ├── commit.md
│   ├── setup.md
│   ├── sync.md
│   └── ticket.md · parse-ticket.md · ticket-refresh.md
├── copilot/              # GitHub Copilot prompts →  <name>.prompt.md
│   ├── commit.prompt.md
│   ├── setup.prompt.md
│   ├── sync.prompt.md
│   └── ticket.prompt.md · parse-ticket.prompt.md · ticket-refresh.prompt.md
├── scripts/
│   └── sync.mjs          # zero-dependency Node sync engine
├── config.yaml           # source of truth: which command → which tool(s)
└── README.md
```

Each tool's folder is what gets symlinked into place, so every file in it is a
real, hand-editable command in that tool's own format.

---

## Commands

| Command | Claude | Copilot | What it does |
|---|:---:|:---:|---|
| [`/commit`](claude-code/commit.md) | ✅ | ✅ | Stage & commit with an Angular / semantic-release message. Offers to push. |
| [`/sync`](claude-code/sync.md) | ✅ | ✅ | Reconcile both command sets per `config.yaml` and rebuild symlinks. |
| [`/setup`](claude-code/setup.md) | ✅ | ✅ | Link this repo's commands into the tool. |
| [`/ticket`](claude-code/ticket.md) | ✅ | ✅ | Create a Jira ticket + matching git branch. *(needs a Jira MCP)* |
| [`/parse-ticket`](claude-code/parse-ticket.md) | ✅ | ✅ | Pull a Jira ticket into the repo as a Markdown work-file. *(needs a Jira MCP)* |
| [`/ticket-refresh`](claude-code/ticket-refresh.md) | ✅ | ✅ | Update a Jira ticket to match what actually shipped. *(needs a Jira MCP)* |

---

## Configure what syncs — `config.yaml`

The whole repo is driven by one file. Each command lists the `targets` it belongs
to; add or drop a target to control where it lives.

```yaml
install:
  claude-code: ~/.claude/commands
  copilot: ~/.config/Code/User/prompts

commands:
  commit:
    targets: [claude-code, copilot]   # both tools…
    mirror: true                      # …held byte-identical

  setup:
    targets: [claude-code, copilot]   # both, bodies tool-adapted

  ticket:
    targets: [copilot]                # copilot only
```

- **`targets`** — any of `claude-code`, `copilot`. This is the `-claude-code` /
  `-copilot` switch: list a tool to include the command there, omit it to leave
  it out.
- **`mirror: true`** *(optional)* — hold the two renderings **byte-identical** and
  make `/sync` flag any drift. Leave it off (default) when the bodies are
  legitimately tool-specific: different MCP tool names, `$ARGUMENTS` (Claude) vs
  `${input:args}` (Copilot), different install mechanics. The command *set* is
  mirrored either way.
- **`install`** *(optional)* — override where each tool reads commands from
  (macOS, Windows, VS Code Insiders, etc.).

---

## `/sync`

Run it as a slash command in either tool, or directly:

```bash
node scripts/sync.mjs            # apply: fill missing sides, relink, report drift
node scripts/sync.mjs --check    # dry run (non-zero exit if drift) — great for CI
node scripts/sync.mjs --from=claude-code   # reconcile drift, Claude wins
node scripts/sync.mjs --from=copilot       # reconcile drift, Copilot wins
node scripts/sync.mjs --prune    # also remove stale Copilot prompt symlinks
```

What it does, in order:

1. **Reconcile** — for every command in `config.yaml`, ensure it exists in each
   target it's configured for. A missing side is generated from the existing one
   (frontmatter added or stripped to fit the format).
2. **Drift** — for `mirror: true` commands, compare the two bodies and report any
   divergence. Nothing is overwritten unless you pick a winner with `--from`.
3. **Relink** — rebuild the symlinks: a directory link for Claude Code
   (`~/.claude/commands → claude-code/`) and one file link per prompt for Copilot.

Zero dependencies — it ships its own tiny YAML parser and runs on a bare Node
(≥16).

---

## Quick start

```bash
git clone https://github.com/DaifMX/commands
cd commands
cp example.config.yaml config.yaml   # your machine-local config (gitignored)
node scripts/sync.mjs                 # links both tools + mirrors everything
```

> `config.yaml` is gitignored so your machine-specific paths and command
> selection stay local. The committed [`example.config.yaml`](example.config.yaml)
> is the template, and `/sync` falls back to it if you haven't made a
> `config.yaml` yet.

Then restart nothing — Claude Code picks up `~/.claude/commands` immediately, and
VS Code / Copilot picks up the prompts folder on the next reload.

### Adding a command

1. Add an entry under `commands:` in `config.yaml`.
2. Drop the file into either `claude-code/` or `copilot/` (whichever you feel like
   writing first).
3. Run `/sync` — the other side is generated and both tools are relinked.

---

<div align="center">
<sub>Authored once · mirrored to both · kept in track by <code>config.yaml</code></sub>
</div>
