# Fabric

Skins for Claude Code, in the [Fabric](https://github.com/ozzycodes2/fabric-theme)
palette (v0.2.3): one chroma, ink on the dusk or dawn ground, and a single signal orange
reserved for objects, never type. The same tokens draw the diagrams in
`architecture-design`, so the transcript and the figures match. Pair it with
[Fabric for Ghostty](https://github.com/ozzycodes2/fabric-ghostty) so the terminal
behind the transcript is the same ground, and see every value on the
[Fabric site](https://github.com/ozzycodes2/fabric-site).

Fabric is a mod, not a skill. It redraws the transcript: tool rows that open onto their
input and answer, diff, table, code, math, Mermaid and shell cards, links, folding, a
calm mode. It is a fork of
[hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) (MIT, v0.5.15,
commit `985ad63`), with its own palette and defaults.

## Install

Needs Claude Code 2.1.287 or later.

```
/plugin install fabric@claude-market-private
```

Restart Claude Code. The `fabric` skin is on; `/skin` changes it.

Do not install `skins@hellosverre-mods` alongside it: both register `/skin`.

## Skins

`fabric` (default), `noir`, `tokyo-night`, `dracula`, `nord`, `gruvbox`, `catppuccin`,
`rose-pine`, `everforest`, `one-dark`, `solarized`, `github`, `kanagawa`, `ayu`,
`night-owl`, `mono`, `terminal`.

Commands and parts (`/skin list`, `/skin calm`, `/skin rail off`, and the rest) are the
upstream ones; see its
[README](https://github.com/hellosverre/claude-skins#use).
Ask Claude to design a skin and the `skin-designer` skill drives the `mcp__fabric__design` tool.

## Palette

`hooks/themes/fabric.ts` holds the skin. Its values are the roles in
`architecture-design/skills/create-diagram/references/style-guide.md`:

| Slot | Role |
| --- | --- |
| tool kinds, `fg`, `user`, `ok` | `ink` |
| `muted` | `soft` |
| `surface` | `paper-2` |
| `warn` | `muted` |
| `code`, `commandBg`, `shimmer` | `accent` |
| `command` | `ink-strong` |
| `zebra` | `accent-tint` on paper |

`err` is the only hue, Fabric's terminal red, because a failed call has to read as a
failure. `codeBg` is `transparent`, so inline code is accent text with no band. The
shell card's command sits on the accent in `ink-strong`, since white on the accent reads
2.87:1, and its output never takes the accent. Every other skin
sets `codeBg` and `commandBg` to its `surface`, `command` to its `fg`, and `shimmer`
to its `user`. The spinner word is `shimmer`, and its sweep lifts that colour toward `fg`.

`tests/test_fabric_tokens.py` fails when the skin and the style guide drift apart.

## Differences from Upstream

- `fabric` is the default skin.
- The daily update check and the star prompt are removed; both point at the upstream
  repository.
- Identifiers use the plugin name: `mcp__fabric__design`, `$.fabric.markdown`, and the
  `fabric-*` pane ids.
- Once a turn that ran `/review:review` ends with an answer, a green `reviewed` pill
  sits on the row above the prompt; `/review:fix` adds an orange `fixed` pill. These
  colours are fixed whatever the skin. The pills belong to the branch's pull request,
  as `gh pr view` names it when they are earned: they go once it merges, checked every
  minute and straight after a `gh pr merge`. Without `gh` or a pull request they last
  until `/clear`. They hide while skins are off or a survey holds the band.

## Development

```
claude plugin validate fabric
claude plugin test fabric
python3 -I -m unittest discover -s fabric/tests -p 'test_fabric_tokens.py'
```

`hooks/vendor/mermaid-ascii.js` is built from `scripts/vendor`; rebuild it only when
bumping `beautiful-mermaid`.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
