import { expect, test } from 'claude-code/testing'

import { isPlaced, misplacedWorktree, normalize, tokenize } from '../hooks/worktree-placement'

const CWD = '/work/voice-connect'

test('worktrees under the repository .claude/worktrees/ pass', () => {
  const placed = [
    'git worktree add .claude/worktrees/feat -b feat origin/main',
    'git -C /work/muxy worktree add /work/muxy/.claude/worktrees/outcome -b outcome origin/main',
    'git -C /work/infra worktree add .claude/worktrees/oidc -b oidc',
    'git worktree add -b x --reason "keep it" .claude/worktrees/x',
    'git worktree add --detach -- .claude/worktrees/review HEAD',
  ]

  for (const command of placed) expect(misplacedWorktree(command, CWD)).toBeUndefined()
})

test('temp-dir scratch checkouts pass', () => {
  expect(misplacedWorktree('git worktree add /tmp/review-abc abc', CWD)).toBeUndefined()
  expect(misplacedWorktree('git -C /work/x worktree add -q --detach /private/tmp/wt eb58a5', CWD)).toBeUndefined()
  expect(misplacedWorktree('git worktree add /var/folders/zz/T/wt HEAD', CWD)).toBeUndefined()
})

test('a sibling of the repository is denied with the path it should use', () => {
  const reason = misplacedWorktree(
    'git -C /work/muxy worktree add /work/muxy-outcome -b feat/outcome origin/main',
    CWD,
  )

  expect(reason).toContain('/work/muxy-outcome')
  expect(reason).toContain('/work/muxy/.claude/worktrees/muxy-outcome')
})

test('a relative sibling resolves against -C, then the session directory', () => {
  expect(misplacedWorktree('git -C /work/muxy worktree add ../muxy-wt', CWD)).toContain('/work/muxy-wt')
  expect(misplacedWorktree('git worktree add ../voice-connect-wt-fix', CWD)).toContain('/work/voice-connect-wt-fix')
})

test('a worktree nested in another worktree is denied and pointed at the main checkout', () => {
  const inside = '/work/voice-connect/.claude/worktrees/a'
  const reason = misplacedWorktree('git worktree add .claude/worktrees/b -b b', inside)

  expect(reason).toContain('/work/voice-connect/.claude/worktrees/a/.claude/worktrees/b')
  expect(reason).toContain('Use /work/voice-connect/.claude/worktrees/b')
})

test('the worktrees directory itself, with no name, is denied', () => {
  expect(misplacedWorktree('git worktree add .claude/worktrees', CWD)).toBeDefined()
})

test('cd earlier in the command moves the base', () => {
  expect(misplacedWorktree('cd /work/muxy && git worktree add .claude/worktrees/x', CWD)).toBeUndefined()
  expect(misplacedWorktree('cd /work/muxy && git worktree add ../x', CWD)).toContain('/work/x')
  expect(misplacedWorktree('cd .. ; git worktree add voice-connect-2', CWD)).toContain('/work/voice-connect-2')
})

test('an unknown base judges the path as written', () => {
  expect(misplacedWorktree('cd "$DIR" && git worktree add .claude/worktrees/x', CWD)).toBeUndefined()
  expect(misplacedWorktree('cd ~ && git worktree add ../x', CWD)).toContain('../x')
  expect(misplacedWorktree('git -C "$in/target" worktree add ../x', CWD)).toContain('<repo>/.claude/worktrees/<name>')
})

test('paths the shell has yet to expand are let through', () => {
  expect(misplacedWorktree('git worktree add "$RUNNER_TEMP/wt" HEAD', CWD)).toBeUndefined()
  expect(misplacedWorktree('git worktree add $(mktemp -d) HEAD', CWD)).toBeUndefined()
  expect(misplacedWorktree('git worktree add ~/wt HEAD', CWD)).toBeUndefined()
})

test('commands that add no worktree pass', () => {
  const others = [
    'git worktree list',
    'git worktree remove ../x --force',
    'git -c core.pager=cat log',
    'git worktree add',
    'echo git worktree add ../x',
    'FOO=1',
    'ls && git status',
  ]

  for (const command of others) expect(misplacedWorktree(command, CWD)).toBeUndefined()
})

test('git global options before the subcommand are skipped', () => {
  expect(misplacedWorktree('GIT_TRACE=1 git --no-pager -c a=b worktree add ../x', CWD)).toContain('/work/x')
})

test('every compound segment is checked', () => {
  expect(misplacedWorktree('git fetch || true; git worktree add ../x | cat', CWD)).toContain('/work/x')
  expect(misplacedWorktree('git status\ngit worktree add ../x &', CWD)).toContain('/work/x')
})

test('tokenize honours quotes, escapes and dynamic words', () => {
  expect(tokenize(`a 'b c' "d\\"e" f\\ g`).map(t => t.text)).toEqual(['a', 'b c', 'd"e', 'f g'])
  expect(tokenize(`'$x' "$y" \`z\``).map(t => t.isDynamic)).toEqual([false, true, true])
  expect(tokenize("'open").map(t => t.text)).toEqual(['open'])
})

test('normalize and isPlaced', () => {
  expect(normalize('/a/./b/../c//d')).toBe('/a/c/d')
  expect(isPlaced('/r/.claude/worktrees/x')).toBe(true)
  expect(isPlaced('/r/.claude/worktrees/x/.claude/worktrees/y')).toBe(false)
  expect(isPlaced('/r/worktrees/x')).toBe(false)
})

test('the Bash hook denies a misplaced worktree and runs the rest', async ($, on) => {
  on('session.cwd', () => ({ value: CWD }))
  on('tool.call', () => ({ result: { stdout: 'ran' } }))

  const denied = await $.tool.call({ tool: 'Bash', command: 'git worktree add ../x -b x' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git worktree add .claude/worktrees/x -b x' })

  expect(denied.deny).toContain('session-mgmt: git worktree add targets /work/x')
  expect(ran.deny).toBeUndefined()
  expect(ran.result).toEqual({ stdout: 'ran' })
})
