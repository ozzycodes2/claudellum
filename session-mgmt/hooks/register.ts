import type { Register } from 'claude-code'

import { misplacedWorktree } from './worktree-placement'

export const register: Register = on => {
  // Subagents' calls pass through here too, which is the point: they are the ones handed
  // a hand-written `git worktree add` for a repository other than the session's.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const reason = misplacedWorktree(e.command, await $.session.cwd())

    return reason === undefined ? next(e) : { deny: `${$.plugin.name}: ${reason}` }
  })
}
