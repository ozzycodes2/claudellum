import type { EngineInterface } from 'claude-code'

// Kept in step with fabric/hooks/nerd-font.ts: the two plugins ship apart, so each carries its own copy.

export type NerdFont = { isFound: boolean; via: string }

// Terminals that draw Nerd Font symbols whatever font is set.
const BUNDLED: ReadonlyMap<string, string> = new Map([
  ['ghostty', 'Ghostty'],
  ['WezTerm', 'WezTerm'],
])

// A patched family's name, or its PostScript name as iTerm2 stores it: "JetBrainsMono Nerd Font",
// "MesloLGS NF", "MesloLGS-NF-Regular", "JetBrainsMonoNFM-Regular".
export const isNerdName = (font: string): boolean => /nerd\s*font/i.test(font) || /NF[MP]?(?![A-Za-z])/.test(font)

// iTerm2 keeps every profile's font in one plist; any Nerd face there, main or non-ASCII, counts.
export const itermFonts = (plist: string): string[] =>
  [...plist.matchAll(/"(?:Normal|Non Ascii) Font"\s*=\s*"([^"]+)"/g)].map(match => match[1])

// Whether the terminal draws Nerd Font glyphs, and what said so. A font installed but not set in
// the terminal does not count: its glyphs would draw as empty boxes. `override` is a variable the
// caller read (the engine wants each name a module reads spelled at its `$.env.get`): `nerd` or
// `unicode` there decides alone.
export async function detectNerdFont($: EngineInterface, override?: { name: string; value: string | undefined }): Promise<NerdFont> {
  if (override?.value === 'nerd' || override?.value === 'unicode') {
    return { isFound: override.value === 'nerd', via: `${override.name}=${override.value}` }
  }

  const program = (await $.env.get('TERM_PROGRAM')) ?? ''
  const bundled = BUNDLED.get(program) ?? ((await $.env.get('KITTY_WINDOW_ID')) === undefined ? undefined : 'kitty')

  if (bundled !== undefined) {
    return { isFound: true, via: `${bundled} ships Nerd Font symbols` }
  }

  if (program === 'iTerm.app') {
    try {
      const { exitCode, stdout } = await $.process.run(['defaults', 'read', 'com.googlecode.iterm2', 'New Bookmarks'], { timeoutMs: 5000 })
      const font = exitCode === 0 ? itermFonts(stdout).find(isNerdName) : undefined

      return font === undefined ? { isFound: false, via: 'no Nerd Font in the iTerm2 profiles' } : { isFound: true, via: `iTerm2 uses ${font}` }
    } catch {
      return { isFound: false, via: 'iTerm2 profiles unreadable' }
    }
  }

  return { isFound: false, via: program === '' ? 'terminal unknown' : `${program} not known to draw Nerd Font symbols` }
}
