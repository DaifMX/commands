# /ticket-parse — Summarize a Jira Ticket into the Repo

## Purpose
Fetch a single Jira ticket and write a Markdown summary of it, grounded in the
current project's context, as `<TICKET-ID>.md` in the repo's working directory.

> Requires an Atlassian/Jira MCP server. Tool names below (`mcp_atlassian_mcp_jira_*`) are illustrative — use whatever the connected Jira MCP exposes in this environment.

## 1. Resolve the ticket ID (required)
The ticket ID is a mandatory argument, provided as text after `/ticket-parse`
(e.g. `/ticket-parse XMGPLAT-1234`).

- It must match the Jira issue key pattern `[A-Z][A-Z0-9]+-\d+`.
- If no ticket ID was given, or it doesn't match that pattern, don't guess —
  ask the user for a valid ticket ID before continuing.

## 2. Fetch the ticket
Use `mcp_atlassian_mcp_jira_get_issue` with the resolved `issue_key`. Request enough
fields for a useful summary, at minimum:
`summary,description,issuetype,status,priority,assignee,reporter,labels,created,updated`.
Include a `comment_limit` (e.g. 10) to capture recent discussion.

If the lookup fails (invalid key, no access, not found), report the exact error
and stop — don't fabricate ticket content.

## 3. Understand the project context
Before writing, get oriented in the current working directory:
- List the top-level contents of the repo.
- Read the root `README.md` and any other obviously relevant top-level docs
  (`package.json`, `AGENTS.md`, `CLAUDE.md`) if present.
- If the ticket references specific files, modules, or features, search the
  repo for related code when it helps ground the summary.

## 4. Write the summary file
Create/overwrite `<TICKET-ID>.md` (exact ticket key, e.g. `XMGPLAT-1234.md`) in
the repo's working directory:

```markdown
# <TICKET-ID>: <Summary>

## Ticket Details
- **Type:** ...
- **Status:** ...
- **Priority:** ...
- **Assignee:** ...
- **Reporter:** ...
- **Created:** ...
- **Updated:** ...
- **Labels:** ...
- **Link:** <Jira URL if available>

## Description
<Ticket description, reformatted as Markdown>

## Recent Comments
<Brief summary of the most relevant/recent comments, if any>

## Project Context
<How this ticket relates to the current project: relevant files/modules found
while exploring the repo>

## Progress Checklist
- [ ] <First concrete step to resolve the ticket>
- [ ] <Next concrete step>
- [ ] <...continue with one checkbox per step>
```

Omit sections with no meaningful content (e.g. no comments) instead of leaving
them empty.

The **Progress Checklist** replaces the old "Suggested Next Steps" section and
is required:
- Break the implementation/investigation work into short, concrete,
  independently-completable steps, grounded in what you found while exploring
  the project context.
- Render each step as a Markdown task list item (`- [ ] Step description`) so
  it renders as a checkbox in the editor.
- Order steps logically (e.g. investigate → implement → test → verify).
- This checklist is a living part of the file, not a one-time snapshot:
  - The user may manually check items off as they make progress.
  - Whenever you (the LLM) are asked to work on this ticket, or you complete
    one of the listed steps yourself, update the corresponding line in
    `<TICKET-ID>.md` from `- [ ]` to `- [x]` to reflect the new state.
  - If new steps are discovered while working, append them as additional
    `- [ ]` items instead of silently doing extra work off-list.

## 5. Confirm
After creating the file, tell the user the file path and give a one-sentence
summary of the ticket.

## Notes
- Don't fabricate ticket fields, comments, or Jira URLs — look them up or omit.
- Never commit or push the generated file on the user's behalf unless asked.
- When later asked to continue/resume work on a ticket already summarized in
  `<TICKET-ID>.md`, read its Progress Checklist first, and keep the checkbox
  states in that file in sync with actual completed work.
