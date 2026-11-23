---
name: recall-focus
description: >-
  Open a working session by recalling what the project already knows, from both
  trivia and Hindsight memory. Use at the start of a session, when the user says
  "let's get started", "what were we working on", "let's pick this back up", or
  "/session-mgmt:recall-focus", or before a meaningful chunk of work. Recalls the
  project's current focus and conventions, the lessons that bear on it from each
  store, verifies the focus's forward claims against the code, confirms direction
  with the user, then enters plan mode with the lessons carried forward. Each
  store is detected and queried independently, so either can be missing.
license: MIT
---

# Recall Focus

Read the project's memory before acting, then plan. Two stores hold it: trivia
(mnemonic-keyed `recall`) and Hindsight (knowledge pages). Both are asked at
the same moments so their recall can be compared fairly; every trivia step has
a Hindsight step beside it. This is the reading half of `trivium:session-retro`
and of `write-handoff`.

**Core principle:** load the few memories that matter for today's work, not
everything tagged for the project. Walk in reminded, not buried.

## When to use

- Start of a session, or resuming after time away.
- Before a meaningful chunk of work where a plan would help.
- `read-handoff` calls this once the handoff's state is verified.

**Skip if:** the ask is a trivial one-off, or the user says exactly what they
want and nothing needs recalling.

## Steps

### 1. Derive the project slug

Use the slug the user passed, else the first that resolves:

1. `git config --get trivia.slug` (per-clone override, shared by worktrees).
2. `Cargo.toml` `[package].name`.
3. The repository directory, not the working directory: the basename of the
   parent of `git rev-parse --path-format=absolute --git-common-dir`,
   lowercased, non-alphanumerics replaced by hyphens. In a worktree the cwd
   basename is a branch name, so never use it.
4. Outside git, the cwd basename, normalised the same way.

```
git config --get trivia.slug 2>/dev/null \
  || basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" \
     | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9\n' '-'
```

The trivia tag is `project:<slug>`. If step 2 finds no sentinel, do not guess:
run one untagged `recall("trivia-bootstrapped <repo name>", limit = 3)`. A
returned `<slug>/trivia-bootstrapped` mnemonic gives the real slug; record it
with `git config trivia.slug <slug>` so the next session derives it.

### 2. Detect each store, independently

**Trivia:**

```
recall(query = "<slug>/trivia-bootstrapped", tags = ["project:<slug>"], limit = 1)
```

A hit counts only if the returned `mnemonic` is exactly
`<slug>/trivia-bootstrapped`; recall returns the nearest neighbour, so any
other mnemonic means the sentinel is absent. An absent sentinel does not prove
an empty project: run step 3's `current-focus` recall first. If that returns
an exact match, continue, tell the user the project is unbootstrapped, and
leave the missing sentinel, `overview` and `conventions` for the closing retro
or `trivium:project-trivia-setup`. If the sentinel and the focus are both
absent, point at `trivium:project-trivia-setup`.

**Hindsight:** the store is available when `mcp__hindsight__*` tools are
present (deferred tools: load them with ToolSearch first). No further probe.

**Trivia unavailable:** skip every trivia step below with a one-line note
("trivia not bootstrapped, skipping trivia recall"); the other store still runs.

**Hindsight unavailable:** skip every Hindsight step below with a one-line note
("no Hindsight tools in this repo, skipping Hindsight recall"); the other store
still runs.

Never fabricate context. If both stores are empty or unavailable, say so and
go straight to confirming direction with the user.

### 3. Recall the seeds

Trivia, exact mnemonic, one tag:

```
recall(query = "<slug>/current-focus", tags = ["project:<slug>"], limit = 1)
recall(query = "<slug>/conventions",   tags = ["project:<slug>"], limit = 1)
```

The result is the seed only if its `mnemonic` matches exactly. One tag per
call: trivia's tag filter is OR, so a second tag widens the net to every
project using it, and another project's seed can outrank this one's.

Hindsight, beside them:

```
hindsight_search_knowledge_pages("<project> current focus and initiatives")
hindsight_search_knowledge_pages("<project> conventions")
```

Read each matching page with `hindsight_read_knowledge_page(page_id)`. Take
the best match per query, not every hit.

### 4. Recall the lessons

From the focus's FRONTIER and NEXT, name the one or two themes the session
will work in.

**Trivia.** Recall each theme's hub by exact mnemonic:

```
recall(query = "<slug>/habits/<theme>", tags = ["project:<slug>"], limit = 1)
```

A hub is the theme's working set of rule lines citing their spokes. No exact
match means no hub yet. The focus's GROUND TRUTH may list **cold** pointers,
each `<mnemonic> — load when <task>`; recall only those whose task is today's,
by exact mnemonic with `limit = 1`. Then a task probe for spokes the hubs lack:

```
recall(query = "<the NEXT sentence, in plain words>", tags = ["project:<slug>"],
       full_text_search = "<a distinctive word from NEXT>",
       limit = 3, truncate = 500, exclude_tags = ["archive"])
```

If NEXT names a **mechanism** (a containment check, a wire format, a cache
header), add one probe keyed on the mechanism, not the task: the spoke that
predicts a bug there often sits under another theme. If the focus names a
lesson no probe returned, probe once more with `full_text_search` on a word
from its handle; a lesson that stays unfindable is a reason to suggest
`trivium:memory-gardening`. Never dump `recall(tags = ["project:<slug>"])`.

**Hindsight.** The same two probes as code:

```
hindsight_search_knowledge_pages("<the NEXT sentence, in plain words>")
hindsight_search_knowledge_pages("<the mechanism NEXT touches>")
```

Skip the second when NEXT names no mechanism. Read only the pages that match.

Then `hindsight_reflect("<what should I know before doing NEXT>")` ONLY if the
page searches returned nothing usable. It is slow (minutes) and synthesises
rather than retrieves; never call it when a page already answered.

### 5. Confirm the focus with the user

Summarise the recalled FRONTIER in one or two sentences and surface the hub
lines, spokes or pages that bear on it ("last time we learned X"). Attribute
each point to its store, so the user can see which one carried it: "(trivia)"
or "(Hindsight)". Where the stores disagree, say so; do not pick silently.
Ask: **is this what you want to work on this session?** If the user redirects,
re-run step 4 against the new focus before planning.

### 6. Verify the NEXT claims before they enter the plan

Each NEXT and FOLLOW-UPS item, from either store, is a claim written at ship
time from a tired mental model. Check it at its source before it becomes a
plan step:

- The host's startup git block is a snapshot from when the conversation began.
  Run `git fetch` and `git status -sb` yourself before trusting branch, HEAD or
  cleanliness, and again before any later commit.
- Merged is not shipped. Before declaring something shipped, check trunk CI on
  the merge commit with `gh run list --commit <sha>`, or the release PR it
  spawned. A squash-merge can land red.
- A deferred item may have shipped as a side effect: `git log --oneline -S
  <keyword>`, or grep the generated artifact.
- A named target may sit in the wrong component: read the cited spec section,
  not the paraphrase. A type described with a shape may never have had it: read
  its real definition.
- A "next spec" pointer over two weeks old is probably overtaken: re-derive the
  frontier from the specs directory by date, the design doc's status header and
  the roadmap's "last refreshed" line.
- "Blocked on an upstream issue" records past state: check the upstream's real
  status, and ask about a local fork or sibling worktree before scoping a
  workaround.
- An item that depends on a later stage's claim is verified only if this
  session's own artifacts will restate it; otherwise the plan says it is
  unverified.

Fan this out to a subagent when the host provides one and several specs or
types need reading. Done when every item the plan depends on has been read at
its source.

**Trivia tombstone.** An item found already shipped gets `shipped <hash>`
now, so the next session does not re-plan it. Edit by round trip, never by
rewriting from memory:

1. `export` `<slug>/current-focus` to a scratch directory.
2. Patch `shipped <hash>` onto that line in a copy of the exported file.
3. Review the diff; only that line should differ.
4. `import` only the edited file's directory.
5. Verify the persisted body and metadata against the file.
6. Repeat the step 3 recall: done when the exact mnemonic returns with its
   tags and the rest of the focus is intact.

**Hindsight correction.** If a page claims something is shipped or pending and
the code says otherwise, ingest the fix rather than leaving the page to
mislead the next session:

```
hindsight_ingest_document(title = "Correction: <topic>",
                          content = "<page> says <claim>; code at <sha> shows <fact>.")
```

Both corrections are writes the user did not ask for: state them and proceed
only when the user agrees, or when the claim is unambiguous from the code.

### 7. Rate and credit what helped

Trivia: `rate` the recalled hubs and spokes up if they shaped the direction,
down if they were noise. Ranking learns from it, which keeps the caps
meaningful.

Hindsight has no rating tool. Credit it instead: any reply content drawn from
a page opens with a blockquote:

```
> 🧠 **From Hindsight memory (<page>)** — <facts>
```

Quote only what the page said; keep your own inference outside the blockquote.

### 8. Plan before editing

Use the host's plan mode when available; otherwise present and maintain a plan
before touching files. The plan must carry lessons from both stores forward
explicitly: "we hit Y last time (trivia hub `rendering`), so the plan avoids
it by doing Z." That is the payoff: lessons shape the design before code.

End the final report with one line, always present:

```
Sources — trivia: <items or none> · Hindsight: <items or none>
```

List the hubs, spokes or pages that shaped the plan; write `none` for a store
that was unavailable or contributed nothing.

## Anti-patterns

| Don't | Why |
| --- | --- |
| Query only one available store | The trial needs both asked at the same moments; a skipped store is a gap in the comparison. |
| Treat one store's absence as a stop | Each is detected alone. Skip with a note and run the other. |
| `recall` everything tagged `project:<slug>` | That is the universe. Load hubs, one task probe, one mechanism probe. |
| Pass two tags to `recall` | OR semantics pull in other projects' seeds. |
| Call `hindsight_reflect` first | Slow and synthesised. Page search first; reflect only when it returns nothing usable. |
| Paraphrase Hindsight content without the blockquote | Unattributed recall cannot be told apart from your own inference. |
| Plan against a NEXT item without reading its source | A stale pointer costs the session's first hour. |
| Trust the host's startup git snapshot | Branch, HEAD and cleanliness drift during a session. |
| Start editing before planning | Confirm, verify, plan, then act. |
| Write a retro here | That is `trivium:session-retro`'s job; this skill reads, rates and tombstones. |
| Fabricate context when both stores are empty | Say so, point at `trivium:project-trivia-setup`, ask the user. |

## Example

```
User: what were we working on?
You: [recall("ratatui-clock/trivia-bootstrapped", tags=["project:ratatui-clock"], limit=1) -> exact hit]
     [mcp__hindsight__ tools present]
     [recall("ratatui-clock/current-focus", ..., limit=1)
        -> FRONTIER: flicker-free redraw landed (a1b2c3d).
           NEXT: add a second pane without reintroducing flicker.]
     [recall("ratatui-clock/conventions", ..., limit=1) -> edition 2021; themes: rendering]
     [hindsight_search_knowledge_pages("ratatui-clock current focus") -> "Redraw initiative" page]
     [recall("ratatui-clock/habits/rendering", ..., limit=1) -> swap the buffer once per frame]
     [hindsight_search_knowledge_pages("add a second pane without flicker") -> same redraw page]
     Last session (trivia) you landed flicker-free redraw with one buffer swap
     per frame, and the Hindsight redraw page agrees. NEXT says a second pane;
     still the plan?
User: yes.
You: [git fetch; git status -sb -> clean on main]
     [git log --oneline -S "second_pane" -> nothing; unshipped]
     [rate habits/rendering up]
     > 🧠 **From Hindsight memory (Redraw initiative)** — resize clears the back buffer.
     [enters plan mode]
     Plan: draw the second pane into the same back buffer, keep the single
     end-of-frame swap, re-test on resize.
     Sources — trivia: habits/rendering · Hindsight: Redraw initiative
```
