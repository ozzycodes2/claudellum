---
name: write-handoff
description: >-
  Write a handoff document that lets a fresh agent continue this session's work,
  and record it in both memory stores (trivia and Hindsight). Use only when the
  user explicitly asks by name: "write a handoff", "run write-handoff",
  "/session-mgmt:write-handoff". Never invoke on your own judgment, even when
  context is filling up; suggest it and wait.
license: MIT
argument-hint: "What will the next session be used for?"
---

# Write Handoff

Compact the current session into a file a fresh agent can pick up, then note
where it lives in trivia and Hindsight. The companion `session-mgmt:read-handoff`
reads it back, but the next reader may be another tool or a human, so the file
carries everything itself.

**Core rule:** the document stands alone. The reader cannot see this
conversation, this skill or either memory store. Point at artifacts by path or
URL; spend the document's own words on state, decisions and the *why* behind
them.

Arguments, if given, describe what the next session will work on. Tailor the
document to that.

## Steps

### 1. Derive the slug

First match wins:

1. `git config --get trivia.slug`
2. `Cargo.toml` `[package].name`
3. Basename of the repository directory: the parent of
   `git rev-parse --path-format=absolute --git-common-dir` (so a worktree
   resolves to its project, not its branch), lowercased, non-alphanumerics
   replaced by hyphens.
4. Outside git, the working-directory basename.

### 2. Detect the stores

Each store is checked on its own. Neither check depends on the other.

- **Trivia mode:** trivia MCP tools are present AND this returns that exact
  mnemonic:

  ```
  recall("<slug>/trivia-bootstrapped", limit = 1)
  ```

  A miss means the project was never bootstrapped; point at
  `trivium:project-trivia-setup` and seed nothing here.
- **Hindsight mode:** `mcp__hindsight__*` tools are present. If they are
  deferred, load them with ToolSearch first.

**Trivia unavailable:** skip every trivia step below with a one-line note; the
other store still runs.

**Hindsight unavailable:** skip every Hindsight step below with a one-line note;
the other store still runs.

If both are unavailable, the file alone is the handoff.

### 3. Offer a retro (trivia mode)

A handoff records *state*; `trivium:session-retro` records *lessons*. If the
session produced a durable lesson, such as a dead end or an approach that paid
off, suggest running the retro first so every later session can recall it, not
just the next one. Continue either way.

### 4. Choose the destination

- `./tmp/` if it exists.
- Otherwise `.claude/relay/`, created if needed.

Filename: `handoff-<yyyy-mm-dd>-<hhmm>.md`. The timestamp keeps names unique and
makes "newest" unambiguous.

### 5. Write the document

Fill every section. Write "none" instead of dropping a heading, so the reader
knows it was considered.

```markdown
# Handoff: <one-line description of the work>

You are picking up work from a previous session. Read this whole file, run the
verification commands below to confirm the state still holds, then continue
from "Next steps."

Written: <yyyy-mm-dd hh:mm> | Branch: <branch> | Last commit: <sha> <subject>

## Task

<What the work is and why, in a paragraph a stranger could act on.>

## State

- **Done:** <completed items, with evidence: commit, passing test, merged PR>
- **In progress:** <what is half-finished and exactly where it stands>
- **Next steps:** <ordered; the first item is what to do immediately>

## Key decisions

<Each decision with its why. The why is what a fresh context cannot rebuild:
"chose X over Y because Z". Include approaches tried and rejected so the next
agent does not re-walk dead ends.>

## Artifacts

<Paths and URLs only: specs, plans, ADRs, issues, PRs, design docs. One line
each saying what it is. Content lives in the artifact, not here.>

## Verify state

<Commands that confirm the environment matches this document: build, test,
`git status`. Prefer the project's just recipes if a justfile exists.>

## Watch out for

<Gotchas, flaky tests, environment quirks, anything that burned this session.>

## For skill-aware agents

<Optional. Skills worth invoking: `session-mgmt:read-handoff` to resume from
this file, then `session-mgmt:recall-focus` to load project memory. Name any
memories worth recalling by mnemonic.>
```

Then `ls` every path written into the document. A path to a file that was never
saved or committed sends the next agent hunting.

### 6. Redact

Re-read the draft before saving. Strip:

- API keys, tokens, passwords, connection strings
- PII and PHI, meaning any patient or member data
- Internal hostnames or credentials quoted from earlier tool output

Replace each with a placeholder naming where the real value lives, such as
`$DATABASE_URL from 1Password` or `see k8s secret foo/bar`.

### 7. Save

Write the redacted text to the chosen path. Nothing below runs before this.

### 8. Trivia pointer (trivia mode)

```
memorize(
  mnemonic = "<slug>/handoff",
  content  = "Handoff at <path> — <one-line summary of state> (<yyyy-mm-dd>)",
  tags     = ["project:<slug>", "handoff"]
)
```

Repeat handoffs converge on this one pointer, because trivia merges mnemonics
this close. It always names the latest file.

### 9. Hindsight ingest (Hindsight mode)

```
hindsight_ingest_document(
  title   = "Handoff <yyyy-mm-dd hh:mm>: <one-line summary>",
  content = <the saved document>
)
```

Pass the redacted text exactly as saved, never the pre-redaction draft.

### 10. Offer a focus update (both stores)

If the session changed what the project is working toward, offer both of these
in one question:

- Trivia: `edit` the `<slug>/current-focus` memory.
- Hindsight: `hindsight_capture_initiative`, adding `relates_to_page_id` when
  the initiative's page exists (find it with `hindsight_search_knowledge_pages`).

The file holds fine-grained state; these hold the headline. Do either, both or
neither as the user answers.

### 11. Report

State the path, then give the line to paste into whatever agent resumes:

```
Read <path> and continue the work it describes.
```

Any agent that can read a file can take over; `session-mgmt:read-handoff` is the
skill-aware route.

Last line of the report, always:

```
Sources — trivia: <items or none> · Hindsight: <items or none>
```

List what each store contributed to this handoff (a retro it prompted, the
pointer written, the document ingested, a focus or initiative edit). Write
`none` for a skipped or silent store.

## Anti-patterns

| Don't | Why |
|---|---|
| Paste diff, spec or plan text into the document | The artifact is the source of truth; a copy goes stale. Link it. |
| Write a path without `ls`-checking it | An unsaved path wastes the next agent's time. |
| Address the reader as a specific agent | It may be a human or another tool. Host advice belongs in the skill-aware section. |
| Write to either store before Redact | Both stores keep the text; a leaked secret there is hard to remove. |
| Let one store's absence stop the other | Each runs independently; skip with a note and carry on. |
| Seed memories beyond the pointer and the ingest | Lessons belong to the retro; bootstrap belongs to project setup. |
| Open with the story of the session | Next steps come first; the history is second. |

## Example

```
User: write a handoff; tomorrow I finish the retry logic
You: [slug from Cargo.toml: fetch-queue; recall hit -> trivia mode;
      mcp__hindsight__ tools loaded -> Hindsight mode]
     [one lesson (select! ordering bug) -> suggest trivium:session-retro; user declines]
     [./tmp exists -> writes tmp/handoff-2026-08-13-1642.md; ls-checks the two
      artifact paths; redacts a staging DB URL to "$STAGING_DB from 1Password"]
     [memorize pointer "fetch-queue/handoff" with tags project:fetch-queue, handoff]
     [hindsight_ingest_document: "Handoff 2026-08-13 16:42: fetch-queue retry
      backoff done, jitter untested"]
     [asks about focus: trivia current-focus edit and an initiative update for
      ABC-123 with relates_to_page_id; user accepts both]
     Handoff written to tmp/handoff-2026-08-13-1642.md.
     Read tmp/handoff-2026-08-13-1642.md and continue the work it describes.
     Sources — trivia: handoff pointer, current-focus edit · Hindsight: handoff document, ABC-123 initiative
```
