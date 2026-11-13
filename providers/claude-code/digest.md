---
description: "Generate a self-contained HTML explainer for a commit, range, branch, PR, or uncommitted work: concepts, diagrams, annotated code, and impact."
argument-hint: "[<ref> | <a>..<b> | --branch [name] | --pr <n> | --wip] [--brief] [--out <path>] [--no-open] [focus/audience]"
---

Turn a commit (or a range, branch, PR, or uncommitted work) into a single, self-contained HTML page that explains — visually and in plain language — what changed in the codebase, why, which new concepts and implementations it introduces, and how the pieces fit together.

The user's request:

```
$ARGUMENTS
```

## Instructions

The goal is **understanding**, not a prettier `git show`. A reader who has never seen this code should finish the page knowing: what problem was solved, what the new ideas are, where the important code lives, and what behaves differently now.

### 1. Resolve the target

Parse the arguments. Everything is optional; with no target, digest `HEAD`.

| Argument | What gets digested |
|----------|--------------------|
| *(none)* / `<ref>` | One commit: `HEAD`, a SHA, a tag, `HEAD~2`, … |
| `<a>..<b>` | Every commit in the range, as one combined change |
| `--branch [<name>]` | Everything on `<name>` (default: current branch) since it diverged from the default branch: `$(git merge-base origin/<default> <name>)..<name>` |
| `--pr <number>` | A pull request — `gh pr view <n> --json title,body,commits,baseRefName,headRefName,author,url` and `gh pr diff <n>` (GitHub only; if `gh` is missing, ask for a range instead) |
| `--wip` | Uncommitted work: `git diff HEAD` plus untracked files (`git ls-files --others --exclude-standard`) |
| `--out <path>` | Write the HTML here instead of the default location (step 6) |
| `--no-open` | Don't open the page in a browser when done |
| `--brief` | A short page: TL;DR, big picture, the 2–4 most important changes, file map. Skip the rest |
| *other free text* | Extra focus or audience, e.g. "for a new teammate", "focus on the auth flow" — let it shape emphasis and tone |

Verify the target resolves (`git rev-parse --verify <ref>^{commit}`, or that the range/branch/PR is non-empty). If it doesn't, say so and stop.

For the default branch (needed by `--branch`): `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`), falling back to `main` / `master`.

### 2. Gather the raw material

Run in parallel where possible. For a single commit `<ref>`:
- `git show -s --format='%H%n%h%n%an%n%ae%n%aI%n%s%n%n%b' <ref>` — metadata and full message
- `git show --stat --summary --format= <ref>` — files, renames, mode changes
- `git show --numstat --format= <ref>` — exact +/- per file
- `git show --format= <ref>` — the full diff
- `git branch --contains <ref> --format='%(refname:short)' | head -5` and `git describe --tags --contains <ref> 2>/dev/null` — where it landed

For a range/branch, use `git log --format='%h %s' <range>` for the commit list and `git diff --stat`, `git diff --numstat`, `git diff <range>` for the combined change.

**Read beyond the diff.** A diff alone rarely explains itself:
- For each meaningfully changed file, read the surrounding code **at the new revision** (`git show <ref>:<path>`, or the working tree for `--wip`) so you understand what the changed lines sit inside.
- For modified or deleted logic, read the **old revision** too (`git show <ref>^:<path>`) so "before vs after" is accurate.
- Follow call sites of new or changed functions (`git grep -n <symbol> <ref>`) to see how they're used.
- Check for linked context: issue/PR references in the message (`#123`, ticket keys), and — on GitHub — the PR that merged the commit (`gh pr list --state merged --search <sha> --json number,title,body,url`). Use its description for the *why* if present.

**Large diffs** (roughly >1500 changed lines): don't read everything line by line. Use the numstat to rank files, read the top files closely, skim the rest. Treat lockfiles, generated code, vendored deps, snapshots, and minified assets as noise — list them in the file map as *generated / vendored* and don't explain them.

### 3. Understand before writing

Work out, and keep notes on:

1. **Intent** — the problem or goal. Prefer stated reasons (commit body, PR description, linked issue). If you have to infer it, say so on the page ("Likely intent: …").
2. **Change themes** — group the diff into 2–8 *logical* changes (e.g. "New retry policy", "Config plumbing", "Tests"), not one entry per file. Order them so a reader builds understanding: foundations (new types, data models, helpers) before the things that use them.
3. **Concepts** — every idea a reader needs to follow the change: domain terms, design patterns, libraries/APIs newly used, protocols, algorithms. Include concepts that existed already but are central to understanding this change. Skip trivia.
4. **New implementations** — new modules, classes, functions, endpoints, CLI flags, config keys, DB tables/migrations, env vars, dependencies.
5. **Behavior change** — what a user/caller/operator observes differently. Before vs after.
6. **Flow** — how data or control moves through the touched parts, and where the new pieces plug in. This becomes the diagram.
7. **Impact** — breaking changes, migrations, performance, security, new failure modes, test coverage added (or missing), follow-ups / TODOs left in the code.

**Accuracy rules:**
- Every claim must be grounded in the diff, the code, the commit message, or linked PR/issue text. Never invent motivation, metrics, or behavior.
- Code snippets are quoted **exactly** from the repo. You may trim: keep the relevant lines and mark gaps with a comment in the snippet's language (`// …`, `# …`). Never "clean up" or paraphrase code inside a snippet.
- Use real file paths and symbol names.

### 4. Plan the page

Sections, in order (with `--brief`, only those marked ★):

| # | Section | Content |
|---|---------|---------|
| ★ | **Hero** | A plain-language headline (not the raw commit subject), then the commit subject, short SHA (or range), author, date, branch/tag, and stat badges: files changed, `+additions`, `−deletions`, commit type (`feat`/`fix`/…) if Angular-style |
| ★ | **TL;DR** | 2–4 sentences. What changed and why it matters, no jargon |
| | **Why** | The problem/motivation, then a **Before → After** comparison of behavior (two columns) |
| | **Key concepts** | One card per concept: name, 1–3 sentence explanation, why it matters *here*, optionally a tiny example. Aim for 2–6 cards |
| ★ | **Big picture** | A Mermaid diagram (flowchart, sequence, or class diagram — whichever shows it best) of the touched components and flow. Mark new nodes with `:::added`, changed with `:::changed`, removed with `:::removed`. Keep each diagram ≤ ~12 nodes; use `flowchart TD` (top-down) for long chains — a wide `LR` chain gets scaled down until it's unreadable. If there are two distinct stories (e.g. build-time vs run-time), draw two diagrams. Add a one-paragraph caption explaining how to read it |
| ★ | **Walkthrough** | One article per change theme, in the order from step 3. Each: a title, file chips, a short explanation of what and why, then 1–3 snippets — new code as a highlighted block, modified code as a diff hunk or a side-by-side before/after — followed by numbered notes explaining the important lines |
| | **New implementations** | Table: symbol, kind (function/class/endpoint/flag/…), file, signature, purpose |
| ★ | **File map** | Every changed file grouped by directory: status (A/M/D/R), +/- bar, one-line role in the change. Generated/vendored files collapsed and labelled |
| | **Impact & risks** | Cards tagged `breaking` / `risk` / `migration` / `perf` / `security` / `info`. Then *Testing* (what tests were added/changed, what's untested) and *Open questions / follow-ups* |
| | **Commits** | Ranges/branches/PRs only: list of commits (short SHA + subject) |

Omit a section rather than padding it — e.g. no "Key concepts" for a typo fix, no "Impact" if nothing notable. Scale depth to the change: a one-line fix gets a short page.

### 5. Write the HTML

Write **one self-contained file** using the template below. Fill in the `<!-- … -->` slots, delete sections you're omitting, and repeat components as needed. Keep the CSS and JS as given (you may add small CSS rules if a change genuinely needs them).

Rules:
- **Escape HTML** in everything you insert: inside code, diffs, and Mermaid labels, `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`. Unescaped generics or JSX will break the page.
- Code blocks: `<pre><code class="language-<lang>">…</code></pre>` with the right highlight.js language (`typescript`, `python`, `go`, `rust`, `java`, `bash`, `yaml`, `json`, `sql`, `css`, `xml` for HTML/JSX, …).
- Diff hunks: `<pre class="diff">…</pre>` containing raw unified-diff lines (`@@`, `+`, `-`, space-prefixed context). The page colors them; don't add spans yourself.
- Before/after: the `.split` component with two code blocks.
- Mermaid: put the diagram source in `<pre class="mermaid">`. Quote node labels that contain punctuation: `A["parse(config)"]`. Include the three `classDef` lines from the template.
- Every snippet sits in a `<figure class="snippet">` whose `<figcaption>` names the file (and line range when useful).
- Write for a smart reader new to this code: short paragraphs, concrete nouns, define terms on first use (or link to the concept card with `<a href="#concept-<id>">`).
- The `<title>` is `Digest · <short headline>`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digest · <!-- short headline --></title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<style>
:root {
  --bg: #fbfaf8; --surface: #ffffff; --surface-2: #f3f1ed; --border: #e4e0d8;
  --text: #1d1b18; --muted: #6b665d; --accent: #3a5bd9; --accent-soft: #e8edff;
  --add: #1f7a3d; --add-bg: #e6f6ea; --del: #b42318; --del-bg: #fdeceb; --chg: #a15c00; --chg-bg: #fff3dc;
  --code-bg: #f6f5f2; --k: #8a3ffc; --s: #1f7a3d; --c: #8b8579; --n: #b45309; --f: #2a4fd1; --t: #0e7490;
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --radius: 10px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121212; --surface: #1a1a1a; --surface-2: #222120; --border: #2f2d2a;
  --text: #ece9e3; --muted: #9c968b; --accent: #8ea6ff; --accent-soft: #1f2640;
  --add: #5fd38a; --add-bg: #13291b; --del: #ff8a80; --del-bg: #331a18; --chg: #f2b45a; --chg-bg: #2e2412;
  --code-bg: #171716; --k: #c4a1ff; --s: #8bd5a0; --c: #7d776d; --n: #f5b971; --f: #9db4ff; --t: #67d4e8;
} }
:root[data-theme="dark"] {
  --bg: #121212; --surface: #1a1a1a; --surface-2: #222120; --border: #2f2d2a;
  --text: #ece9e3; --muted: #9c968b; --accent: #8ea6ff; --accent-soft: #1f2640;
  --add: #5fd38a; --add-bg: #13291b; --del: #ff8a80; --del-bg: #331a18; --chg: #f2b45a; --chg-bg: #2e2412;
  --code-bg: #171716; --k: #c4a1ff; --s: #8bd5a0; --c: #7d776d; --n: #f5b971; --f: #9db4ff; --t: #67d4e8;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 24px; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 var(--sans); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
code, pre { font-family: var(--mono); font-size: 13.5px; }
:not(pre) > code { background: var(--surface-2); border: 1px solid var(--border); padding: .05em .35em; border-radius: 5px; font-size: .88em; }
.layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 48px; max-width: 1180px; margin: 0 auto; padding: 40px 24px 96px; }
nav.toc { position: sticky; top: 32px; align-self: start; font-size: 14px; }
nav.toc .label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
nav.toc a { display: block; color: var(--muted); padding: 5px 0 5px 12px; border-left: 2px solid var(--border); }
nav.toc a.active { color: var(--text); border-left-color: var(--accent); }
nav.toc button { margin-top: 20px; background: var(--surface); color: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font: inherit; cursor: pointer; }
main > section { margin-bottom: 64px; }
h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.15; letter-spacing: -.02em; margin: 8px 0 12px; }
h2 { font-size: 24px; letter-spacing: -.01em; margin: 0 0 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
h3 { font-size: 18px; margin: 0 0 8px; }
p { margin: 0 0 14px; } .muted { color: var(--muted); }
.eyebrow { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.subject { font-family: var(--mono); font-size: 14px; color: var(--muted); margin-bottom: 18px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); font-size: 13px; color: var(--muted); }
.badge b { color: var(--text); font-weight: 600; } .badge.add b { color: var(--add); } .badge.del b { color: var(--del); }
.badge.type { background: var(--accent-soft); border-color: transparent; color: var(--accent); font-weight: 600; }
.tldr { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: var(--radius); padding: 20px 24px; font-size: 17px; }
.tldr p:last-child { margin: 0; }
.compare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.compare > div { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
.compare .before { border-top: 3px solid var(--del); } .compare .after { border-top: 3px solid var(--add); }
.compare h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.compare ul, .card ul { margin: 0; padding-left: 20px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
.card .why { font-size: 14px; color: var(--muted); border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 10px; }
.card pre { margin: 10px 0 0; }
.diagram { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; overflow-x: auto; }
.diagram pre.mermaid { background: none; border: 0; margin: 0; display: flex; justify-content: center; }
.legend { display: flex; gap: 16px; font-size: 13px; color: var(--muted); margin-top: 12px; flex-wrap: wrap; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.legend .l-add::before { background: var(--add); } .legend .l-chg::before { background: var(--chg); } .legend .l-del::before { background: var(--del); }
article.change { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
article.change h3 { display: flex; gap: 12px; align-items: baseline; font-size: 20px; }
article.change h3 .num { font-family: var(--mono); font-size: 13px; color: var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 14px; }
.chip { font-family: var(--mono); font-size: 12px; padding: 2px 8px; border-radius: 6px; background: var(--surface-2); color: var(--muted); border: 1px solid var(--border); }
figure.snippet { margin: 16px 0; }
figure.snippet figcaption { font-family: var(--mono); font-size: 12px; color: var(--muted); padding: 6px 12px; background: var(--surface-2); border: 1px solid var(--border); border-bottom: 0; border-radius: 8px 8px 0 0; }
pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; overflow-x: auto; line-height: 1.55; margin: 0; }
figure.snippet pre { border-radius: 0 0 8px 8px; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.split figure { margin: 0; min-width: 0; }
.split .before figcaption { border-top: 3px solid var(--del); } .split .after figcaption { border-top: 3px solid var(--add); }
pre.diff { padding: 10px 0; }
pre.diff .ln { display: block; min-width: max-content; padding: 0 16px; white-space: pre; min-height: 1.55em; }
pre.diff .ln.add { background: var(--add-bg); color: var(--add); } pre.diff .ln.del { background: var(--del-bg); color: var(--del); }
pre.diff .ln.hunk { color: var(--accent); background: var(--accent-soft); } pre.diff .ln.ctx { color: var(--muted); }
ol.notes { margin: 12px 0 0; padding-left: 22px; font-size: 15px; } ol.notes li { margin-bottom: 6px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); background: var(--surface-2); }
tr:last-child td { border-bottom: 0; }
.table-wrap { overflow-x: auto; }
details.dir { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; }
details.dir summary { cursor: pointer; padding: 10px 16px; font-family: var(--mono); font-size: 13px; font-weight: 600; }
.file { display: grid; grid-template-columns: 28px minmax(0, 1.2fr) 120px minmax(0, 2fr); gap: 12px; align-items: center; padding: 8px 16px; border-top: 1px solid var(--border); font-size: 14px; }
.file .path { font-family: var(--mono); font-size: 12.5px; overflow-wrap: anywhere; }
.status { font-family: var(--mono); font-size: 11px; font-weight: 700; text-align: center; border-radius: 4px; padding: 1px 0; }
.status.A { color: var(--add); background: var(--add-bg); } .status.D { color: var(--del); background: var(--del-bg); }
.status.M { color: var(--chg); background: var(--chg-bg); } .status.R { color: var(--accent); background: var(--accent-soft); }
.bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--surface-2); }
.bar .a { background: var(--add); } .bar .d { background: var(--del); }
.bar-n { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.tag { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; margin-bottom: 8px; }
.tag.breaking, .tag.security { color: var(--del); background: var(--del-bg); }
.tag.risk, .tag.migration, .tag.perf { color: var(--chg); background: var(--chg-bg); }
.tag.info { color: var(--accent); background: var(--accent-soft); }
.commits { list-style: none; padding: 0; margin: 0; font-size: 14px; }
.commits li { padding: 8px 0; border-bottom: 1px solid var(--border); } .commits code { margin-right: 8px; }
footer { color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); padding-top: 18px; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: var(--k); }
.hljs-string, .hljs-regexp, .hljs-addition { color: var(--s); }
.hljs-comment, .hljs-quote { color: var(--c); font-style: italic; }
.hljs-number, .hljs-literal, .hljs-symbol { color: var(--n); }
.hljs-title, .hljs-title.function_, .hljs-section { color: var(--f); }
.hljs-type, .hljs-title.class_, .hljs-attr, .hljs-attribute, .hljs-meta, .hljs-name { color: var(--t); }
.hljs-deletion { color: var(--del); }
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; gap: 24px; padding: 24px 16px 64px; }
  nav.toc { position: static; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  nav.toc .label { width: 100%; margin: 0; }
  nav.toc a { border: 0; padding: 2px 0; }
  nav.toc button { margin: 0; }
  .compare, .split { grid-template-columns: 1fr; }
  .file { grid-template-columns: 28px minmax(0, 1fr) 80px; } .file .role { grid-column: 2 / -1; color: var(--muted); }
}
</style>
</head>
<body>
<div class="layout">
<nav class="toc">
  <div class="label">Contents</div>
  <!-- one link per section you keep -->
  <a href="#tldr">TL;DR</a>
  <a href="#why">Why</a>
  <a href="#concepts">Key concepts</a>
  <a href="#big-picture">Big picture</a>
  <a href="#walkthrough">Walkthrough</a>
  <a href="#new">New implementations</a>
  <a href="#files">File map</a>
  <a href="#impact">Impact &amp; risks</a>
  <button type="button" id="theme">Toggle theme</button>
</nav>
<main>

<section id="top">
  <div class="eyebrow"><!-- e.g. Commit digest · repo-name --></div>
  <h1><!-- plain-language headline --></h1>
  <div class="subject"><!-- raw commit subject (or range / PR title) --></div>
  <div class="meta">
    <span class="badge type"><!-- feat --></span>
    <span class="badge"><b><!-- a1b2c3d --></b></span>
    <span class="badge"><!-- author --></span>
    <span class="badge"><!-- 2026-01-31 --></span>
    <span class="badge"><b><!-- 7 --></b> files</span>
    <span class="badge add"><b>+<!-- 120 --></b></span>
    <span class="badge del"><b>−<!-- 34 --></b></span>
  </div>
</section>

<section id="tldr">
  <h2>TL;DR</h2>
  <div class="tldr"><p><!-- 2–4 sentences --></p></div>
</section>

<section id="why">
  <h2>Why</h2>
  <p><!-- the problem / motivation; "Likely intent:" if inferred --></p>
  <div class="compare">
    <div class="before"><h3>Before</h3><ul><li><!-- --></li></ul></div>
    <div class="after"><h3>After</h3><ul><li><!-- --></li></ul></div>
  </div>
</section>

<section id="concepts">
  <h2>Key concepts</h2>
  <div class="grid">
    <div class="card" id="concept-<!-- id -->">
      <h3><!-- concept --></h3>
      <p><!-- what it is --></p>
      <div class="why"><!-- why it matters in this change --></div>
    </div>
  </div>
</section>

<section id="big-picture">
  <h2>Big picture</h2>
  <div class="diagram">
<pre class="mermaid">
flowchart LR
  classDef added fill:#e6f6ea,stroke:#1f7a3d,color:#14532d
  classDef changed fill:#fff3dc,stroke:#a15c00,color:#5c3500
  classDef removed fill:#fdeceb,stroke:#b42318,color:#7a1a12,stroke-dasharray:4 3
  %% nodes and edges here
</pre>
    <div class="legend"><span class="l-add">new</span><span class="l-chg">changed</span><span class="l-del">removed</span></div>
  </div>
  <p class="muted" style="margin-top:12px"><!-- how to read the diagram --></p>
</section>

<section id="walkthrough">
  <h2>Walkthrough</h2>
  <article class="change" id="change-1">
    <h3><span class="num">01</span><!-- change theme title --></h3>
    <div class="chips"><span class="chip"><!-- path/to/file.ts --></span></div>
    <p><!-- what changed and why --></p>

    <figure class="snippet">
      <figcaption><!-- path/to/file.ts · L12–40 · new --></figcaption>
      <pre><code class="language-typescript"><!-- escaped code --></code></pre>
    </figure>

    <figure class="snippet">
      <figcaption><!-- path/to/file.ts · diff --></figcaption>
<pre class="diff">@@ -10,4 +10,6 @@
 context line
-removed line
+added line</pre>
    </figure>

    <div class="split">
      <figure class="snippet before"><figcaption>Before · <!-- path --></figcaption><pre><code class="language-typescript"><!-- --></code></pre></figure>
      <figure class="snippet after"><figcaption>After · <!-- path --></figcaption><pre><code class="language-typescript"><!-- --></code></pre></figure>
    </div>

    <ol class="notes"><li><!-- note on an important line --></li></ol>
  </article>
</section>

<section id="new">
  <h2>New implementations</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Symbol</th><th>Kind</th><th>Where</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td><code><!-- name(sig) --></code></td><td><!-- function --></td><td><code><!-- file --></code></td><td><!-- purpose --></td></tr>
    </tbody>
  </table></div>
</section>

<section id="files">
  <h2>File map</h2>
  <details class="dir" open>
    <summary><!-- src/ (3 files) --></summary>
    <!-- width % = lines / largest file's total lines * 100 -->
    <div class="file">
      <span class="status A">A</span>
      <span class="path"><!-- src/file.ts --></span>
      <span><div class="bar"><span class="a" style="width:60%"></span><span class="d" style="width:10%"></span></div><span class="bar-n">+60 −10</span></span>
      <span class="role"><!-- one-line role --></span>
    </div>
  </details>
</section>

<section id="impact">
  <h2>Impact &amp; risks</h2>
  <div class="grid">
    <div class="card"><span class="tag info">info</span><p><!-- --></p></div>
  </div>
  <h3 style="margin-top:28px">Testing</h3>
  <ul><li><!-- --></li></ul>
  <h3 style="margin-top:20px">Open questions &amp; follow-ups</h3>
  <ul><li><!-- --></li></ul>
</section>

<footer>Generated by <code>digest</code> · <!-- target, e.g. a1b2c3d or main..feature --> · <!-- generation date --></footer>
</main>
</div>
<script>
(function () {
  var root = document.documentElement, KEY = 'digest-theme';
  try { var saved = localStorage.getItem(KEY); if (saved) root.dataset.theme = saved; } catch (e) {}
  var isDark = function () { return root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  var diagrams = Array.prototype.map.call(document.querySelectorAll('pre.mermaid'), function (el) { return { el: el, src: el.textContent }; });
  var renderDiagrams = function () {
    if (!window.mermaid || !diagrams.length) return;
    diagrams.forEach(function (d) { d.el.removeAttribute('data-processed'); d.el.textContent = d.src; });
    mermaid.initialize({ startOnLoad: false, theme: isDark() ? 'dark' : 'neutral', securityLevel: 'strict', fontFamily: 'ui-sans-serif, system-ui, sans-serif' });
    mermaid.run({ nodes: diagrams.map(function (d) { return d.el; }) }).catch(function () {});
  };
  document.getElementById('theme').addEventListener('click', function () {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) {}
    renderDiagrams();
  });
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  document.querySelectorAll('pre.diff').forEach(function (pre) {
    pre.innerHTML = pre.textContent.replace(/\n$/, '').split('\n').map(function (l) {
      var c = l.startsWith('@@') ? 'hunk' : l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx';
      return '<span class="ln ' + c + '">' + esc(l) + '</span>';
    }).join('');
  });
  if (window.hljs) hljs.highlightAll();
  renderDiagrams();
  var links = Array.prototype.slice.call(document.querySelectorAll('nav.toc a'));
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('main > section[id]').forEach(function (s) { obs.observe(s); });
})();
</script>
</body>
</html>
```

The highlight.js and Mermaid scripts load from a CDN; offline, the page still reads fine (plain code, diagram source as text).

### 6. Save and open

**Location** — unless `--out` was given, write to `<repo root>/.digests/<name>.html`, where `<name>` is:
- single commit: `<short-sha>-<slug>` (slug = 3–6 hyphenated words from the headline)
- range / branch / PR: `<from>..<to>-<slug>`, `branch-<branch>-<slug>`, `pr-<n>-<slug>` (replace `/` with `-`)
- `--wip`: `wip-<YYYYMMDD-HHMM>-<slug>`

Keep `.digests/` out of git without touching tracked files: if `.digests/` isn't already ignored (`git check-ignore -q .digests/x`), append `.digests/` to the repo's local exclude file (`git rev-parse --git-path info/exclude`).

**Sanity-check** before reporting:
- Every template comment is gone — filled slots and guidance comments alike (`grep -c '<!--' <file>` prints `0`).
- Every `<pre class="mermaid">` block has valid syntax (labels with punctuation quoted, no unescaped `<`/`>`).
- Every TOC link points at a section that exists.

**Open** it, unless `--no-open` was given: `xdg-open <file>` on Linux, `open <file>` on macOS, `start "" <file>` on Windows. Run it detached and ignore its output; if no opener exists, just print the path.

### 7. Report

Print:
- The absolute path of the HTML file (as a `file://` URL too)
- The headline and the TL;DR
- A one-line outline of the walkthrough themes
- Anything you had to infer rather than read (e.g. "intent inferred — no PR or commit body")
