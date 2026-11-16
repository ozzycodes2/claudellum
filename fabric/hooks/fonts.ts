import type { EngineInterface } from 'claude-code'

import { detectNerdFont } from './nerd-font'

// The symbols alone, so it sits behind whatever font the terminal already uses.
export const NERD_CASK = 'font-symbols-only-nerd-font'

const FALLBACK =
  'Set Symbols Nerd Font Mono as the terminal’s fallback font (iTerm2: Settings › Profiles › Text › Non-ASCII font), then restart Claude Code.'

async function detect($: EngineInterface) {
  return detectNerdFont($, { name: 'EMBER_ICONS', value: await $.env.get('EMBER_ICONS') })
}

// /skin fonts: whether the terminal draws Nerd Font icons, which the ember banner follows.
export async function fontsReport($: EngineInterface): Promise<string> {
  const found = await detect($)

  return found.isFound
    ? `Nerd Font: found (${found.via}). The ember banner draws Nerd Font icons.`
    : [
        `Nerd Font: not found (${found.via}). The ember banner draws Unicode marks.`,
        '',
        `\`/skin fonts install\` installs Symbols Nerd Font with Homebrew (\`brew install --cask ${NERD_CASK}\`).`,
        'Set `EMBER_ICONS=nerd` if your terminal already draws them.',
      ].join('\n')
}

// /skin fonts install: runs Homebrew. Nothing is installed when a Nerd Font is already drawn.
export async function installNerdFont($: EngineInterface): Promise<string> {
  const found = await detect($)

  if (found.isFound) {
    return `Nerd Font: already found (${found.via}); nothing to install.`
  }

  try {
    $.ui.toast('Installing Symbols Nerd Font with Homebrew…')
    const { exitCode, stderr } = await $.process.run(['brew', 'install', '--cask', NERD_CASK], { timeoutMs: 600_000 })

    return exitCode === 0
      ? `Installed Symbols Nerd Font. ${FALLBACK}`
      : `\`brew install --cask ${NERD_CASK}\` failed:\n${stderr.trim().split('\n').slice(-3).join('\n')}`
  } catch {
    return `Homebrew is not available here. Download Symbols Nerd Font from https://www.nerdfonts.com/font-downloads, install it, and ${FALLBACK.charAt(0).toLowerCase()}${FALLBACK.slice(1)}`
  }
}
