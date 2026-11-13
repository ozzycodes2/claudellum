import type { Skin } from '../skin'

// One chroma, no hue to tell kinds apart: every tool kind is ink, and the glyph says which.
// Tokens are the Fabric roles in architecture-design's style-guide.md; `zebra` is the one
// derived value, the guide's `accent-tint` laid on its paper. `err` is Fabric's terminal red,
// the one hue, since a failed call must read as one. `code` is the guide's `accent`, the one
// place the skin lets it set type; `commandBg` puts it behind the shell card's command, in
// `ink-strong` because white on the accent reads 2.87:1, and `shimmer` sweeps over it.
const skin: Skin = {
  name: 'fabric',
  label: 'Fabric',
  palette: {
    read: '#f7f8f8',
    write: '#f7f8f8',
    run: '#f7f8f8',
    search: '#f7f8f8',
    web: '#f7f8f8',
    mcp: '#f7f8f8',
    other: '#f7f8f8',
    user: '#f7f8f8',
    fg: '#f7f8f8',
    muted: '#8a8f98',
    surface: '#1a1c1d',
    zebra: '#311e14',
    ok: '#f7f8f8',
    err: '#e04a3c',
    warn: '#d0d6e0',
    code: '#ff6a13',
    codeBg: 'transparent',
    command: '#171717',
    commandBg: '#ff6a13',
    shimmer: '#ff6a13',
  },
  light: {
    read: '#171717',
    write: '#171717',
    run: '#171717',
    search: '#171717',
    web: '#171717',
    mcp: '#171717',
    other: '#171717',
    user: '#171717',
    fg: '#171717',
    muted: '#606060',
    surface: '#f7f8f8',
    zebra: '#eee1da',
    ok: '#171717',
    err: '#b02f24',
    warn: '#2c2c2c',
    code: '#ff6a13',
    codeBg: 'transparent',
    command: '#171717',
    commandBg: '#ff6a13',
    shimmer: '#ff6a13',
  },
  spinner: ['Thinking', 'Working', 'Considering'],
  done: ['Done', 'Finished'],
}

export default skin
