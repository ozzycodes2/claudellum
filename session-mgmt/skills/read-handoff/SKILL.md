---
name: read-handoff
description: >-
  Find the handoff document an earlier session left behind, check the repo still
  matches it, and resume the work it describes. Use only when the user explicitly
  asks by name: "read the handoff", "pick up the handoff", "resume from the
  handoff", "/session-mgmt:read-handoff". Never invoke on your own judgment.
  Looks for the handoff in trivia memory, in Hindsight knowledge pages, then on
  disk, and asks both stores at the same steps so their recall can be compared.
license: MIT
---

# Read Handoff

Locate the handoff written by `write-handoff`, verify the world still matches it,
and continue from its "Next steps." Counterpart of `write-handoff`.

**Core principle:** the document describes the world as it was when written. The
file is the authority; the stores only point at it. Verify before trusting, and
report drift instead of acting on stale instructions.

## When to use

- The user explicitly asks to resume or pick up a handoff, usually at the start of
  a session that continues earlier work.

## Steps

### 1. Derive the slug

Same rules trivium uses, first match wins: `git config --get trivia.slug`;
`Cargo.toml` `[package].name`; the basename of the **repository** directory (the
parent of `git rev-parse --path-format=absolute --git-common-dir`, so a worktree
resolves to its project, not its branch), lowercased with non-alphanumerics turned
into hyphens; outside git, the working-directory basename.

A trivia recall whose mnemonic does not start with `<slug>/` is a miss, not a
pointer.

### 2. Detect each store

The two checks are independent.

- **Trivia:** trivia MCP tools are present AND `recall("<slug>/trivia-bootstrapped", limit = 1)`
  returns an exact hit.
- **Hindsight:** `mcp__hindsight__*` tools are present. If they are deferred, load
  them with ToolSearch first.

**Trivia unavailable:** skip every trivia step below with a one-line note; the
other store still runs.

**Hindsight unavailable:** skip every Hindsight step below with a one-line note;
the other store still runs.

### 3. Locate the handoff

Gather candidates in this order. Run both store lookups even if the first hits, so
each store gets asked.

1. **Trivia pointer.** `recall("<slug>/handoff", limit = 1)`. The memory names a path.
2. **Hindsight page.** `hindsight_search_knowledge_pages("handoff <slug>")`. Read
   the hit for the path it names.
3. **`./tmp/handoff-*.md`**, newest. Match the pattern; tmp holds plenty that is
   not a handoff.
4. **`.claude/relay/handoff-*.md`**, newest.

A store hit counts only if the file it names exists. If a pointer names a missing
file, tell the user it is stale and fall through to the next candidate.

Among surviving candidates the newest by filename timestamp
(`handoff-<yyyy-mm-dd>-<hhmm>.md`) wins. Name the others so the user can redirect
you. A Hindsight page may surface an older handoff than the one on disk; the file
timestamp decides, not which store found it.

Nothing anywhere: say so plainly and stop. There is nothing to summarize.

### 4. Check for drift

The document records the branch and commit it was written at. Compare:

```
git log --oneline <handoff-sha>..HEAD
```

Commits since then, especially ones touching files the doc discusses, mean parts
may be done or invalid. Flag exactly which sections look overtaken. Flag a branch
mismatch the same way.

### 5. Read back, verify, resume

- Summarize the task and state in a few sentences so the user can confirm you
  picked up the right handoff.
- Run the document's "Verify state" commands and report any mismatch.
- If the "For skill-aware agents" section calls for it, invoke
  `session-mgmt:recall-focus` to layer current focus and lessons on top of the
  handoff. Older handoffs may name `session-start` there; treat that as
  `recall-focus`.
- Recall any trivia memories the doc names, and run a
  `hindsight_search_knowledge_pages` query for any topic it names.
- Continue from the document's "Next steps."

### 6. Offer cleanup, all or none

When the handoff is absorbed, offer these together as one choice:

1. Delete the handoff file.
2. Trivia: edit `<slug>/handoff` to say it was consumed on `<date>`, or delete it.
3. Hindsight: `hindsight_ingest_document(title = "Correction: handoff consumed", content = <path, date, "no live handoff">)`.

If the user declines, leave the file and both stores untouched. A pointer to a
deleted file is this skill's main failure mode, so never do a subset.

### 7. Report

End the report with a single line:

`Sources — trivia: <items or none> · Hindsight: <items or none>`

List what each store contributed (pointer, page, memories recalled).

## Anti-patterns

| Don't | Why |
| --- | --- |
| Take the newest file in tmp regardless of name | tmp holds scratch files. Only `handoff-*.md` is a handoff. |
| Trust a store hit without checking the file | The file may be gone. Stale pointer: say so, fall through. |
| Let the store that found it pick the winner | Newest filename timestamp wins, whichever store surfaced it. |
| Skip one store because the other hit | The comparison needs both asked at the same steps. |
| Act before the drift check | The repo may have moved on; you would redo or resurrect work. |
| Clean up only some of file, pointer, correction | They must agree. All or none. |
| Invent context when nothing is found | Report it and let the user steer. |

## Example

```
User: resume from the handoff
You: [slug: fetch-queue; trivia bootstrapped; Hindsight tools present]
     [trivia recall("fetch-queue/handoff") -> tmp/handoff-2026-08-13-1642.md, exists]
     [Hindsight page "handoff fetch-queue" -> same path]
     [git log --oneline 4f3a2c1..HEAD -> one commit, touching src/retry.rs]
     Found yesterday's handoff (tmp/handoff-2026-08-13-1642.md), named by both
     stores: retry logic half-done, backoff working, jitter untested. One commit
     since touches src/retry.rs, so "In progress" may be partly done.
     [runs the doc's Verify state commands -> pass]
     [doc asks for focus; invokes session-mgmt:recall-focus -> matches]
     Next step: property-test the jitter distribution. Starting there.
     [... work ...]
     Delete the file, mark fetch-queue/handoff consumed, and ingest the
     "Correction: handoff consumed" note?
User: yes
You: [all three done]
     Sources — trivia: fetch-queue/handoff · Hindsight: handoff page for fetch-queue
```
