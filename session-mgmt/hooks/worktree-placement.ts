// Where `git worktree add` may put a worktree: under the owning repository's
// `.claude/worktrees/`, beside the ones EnterWorktree makes, or in a temp dir for a
// scratch checkout. Those are the places Claude Code and exit-session look; a worktree
// anywhere else (a `../repo-feature` sibling, typically) is found by nothing.

const WORKTREES = ['.claude', 'worktrees']
const TEMP_ROOTS = ['/tmp/', '/private/tmp/', '/var/folders/', '/private/var/folders/']
const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n'])
const ADD_VALUE_OPTIONS = new Set(['-b', '-B', '--reason'])
const GIT_VALUE_OPTIONS = new Set(['-c', '--exec-path', '--namespace', '--config-env'])

type Token = { text: string; isOperator: boolean; isDynamic: boolean }

// Shell words with quotes removed. A word holding an unquoted or double-quoted `$` or a
// backtick is dynamic: its value is only known once the shell expands it.
export function tokenize(command: string): Token[] {
  const tokens: Token[] = []
  let text = ''
  let isWord = false
  let isDynamic = false
  let i = 0

  const flush = () => {
    if (isWord) tokens.push({ text, isOperator: false, isDynamic })
    text = ''
    isWord = false
    isDynamic = false
  }

  while (i < command.length) {
    const c = command[i] as string
    const pair = command.slice(i, i + 2)

    if (pair === '&&' || pair === '||') {
      flush()
      tokens.push({ text: pair, isOperator: true, isDynamic: false })
      i += 2
    } else if (c === ';' || c === '|' || c === '&' || c === '\n') {
      flush()
      tokens.push({ text: c, isOperator: true, isDynamic: false })
      i += 1
    } else if (c === ' ' || c === '\t') {
      flush()
      i += 1
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1)
      const stop = end === -1 ? command.length : end
      text += command.slice(i + 1, stop)
      isWord = true
      i = stop + 1
    } else if (c === '"') {
      i += 1
      isWord = true
      while (i < command.length && command[i] !== '"') {
        if (command[i] === '\\' && i + 1 < command.length) {
          text += command[i + 1]
          i += 2
          continue
        }
        if (command[i] === '$' || command[i] === '`') isDynamic = true
        text += command[i]
        i += 1
      }
      i += 1
    } else if (c === '\\' && i + 1 < command.length) {
      text += command[i + 1]
      isWord = true
      i += 2
    } else {
      if (c === '$' || c === '`') isDynamic = true
      text += c
      isWord = true
      i += 1
    }
  }
  flush()

  return tokens
}

function segmentsOf(tokens: Token[]): Token[][] {
  const segments: Token[][] = [[]]

  for (const token of tokens) {
    if (token.isOperator && SEPARATORS.has(token.text)) segments.push([])
    else segments.at(-1)?.push(token)
  }

  return segments.filter(segment => segment.length > 0)
}

export function normalize(path: string): string {
  const parts: string[] = []

  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return `/${parts.join('/')}`
}

// `undefined` where the base is unknown and the path relative: the caller then judges
// the path as written.
function resolve(base: string | undefined, path: string): string | undefined {
  if (path.startsWith('/')) return normalize(path)
  if (base === undefined) return undefined

  return normalize(`${base}/${path}`)
}

function worktreesAt(parts: string[]): number[] {
  const at: number[] = []

  for (let i = 0; i + 1 < parts.length; i++) {
    if (parts[i] === WORKTREES[0] && parts[i + 1] === WORKTREES[1]) at.push(i)
  }

  return at
}

// Exactly one `.claude/worktrees/` with a name after it: two mean a worktree nested
// inside another worktree, made by a relative path from inside one.
export function isPlaced(path: string): boolean {
  if (TEMP_ROOTS.some(root => path.startsWith(root))) return true

  const parts = path.split('/').filter(part => part !== '' && part !== '.')
  const at = worktreesAt(parts)

  return at.length === 1 && (at[0] as number) + 2 < parts.length
}

// The main checkout's root: the part of a path before its first `.claude/worktrees/`,
// so a session running inside a worktree still points at the repository that owns it.
function repoRootOf(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const at = worktreesAt(parts)

  return at.length === 0 ? path : `/${parts.slice(0, at[0]).join('/')}`
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? 'name'
}

function denial(path: string, gitDir: string | undefined): string {
  const target = gitDir === undefined ? '<repo>/.claude/worktrees/<name>' : `${repoRootOf(gitDir)}/.claude/worktrees/${basename(path)}`

  return (
    `git worktree add targets ${path}, outside the repository's .claude/worktrees/. ` +
    "Worktrees go under the owning repository's .claude/worktrees/, beside the ones Claude Code makes; " +
    'a throwaway checkout goes under /tmp. ' +
    `Use ${target} as the path, with the same branch arguments.`
  )
}

function checkGit(words: Token[], base: string | undefined): string | undefined {
  let gitDir = base
  let i = 1

  while (i < words.length && (words[i] as Token).text.startsWith('-')) {
    const option = (words[i] as Token).text

    if (option === '-C') {
      const dir = words[i + 1]
      gitDir = dir === undefined || dir.isDynamic ? undefined : resolve(gitDir, dir.text)
      i += 2
    } else {
      i += GIT_VALUE_OPTIONS.has(option) ? 2 : 1
    }
  }

  if (words[i]?.text !== 'worktree' || words[i + 1]?.text !== 'add') return undefined

  i += 2
  while (i < words.length) {
    const word = words[i] as Token

    if (word.text === '--') {
      i += 1
      break
    }
    if (!word.text.startsWith('-')) break
    i += ADD_VALUE_OPTIONS.has(word.text) ? 2 : 1
  }

  const target = words[i]
  if (target === undefined || target.isDynamic || target.text.startsWith('~')) return undefined

  const path = resolve(gitDir, target.text) ?? target.text

  return isPlaced(path) ? undefined : denial(path, gitDir)
}

// Why `command` would place a worktree where exit-session cannot find it, or
// `undefined`. A path the shell has yet to expand is let through: it cannot be judged.
export function misplacedWorktree(command: string, cwd: string): string | undefined {
  let base: string | undefined = cwd

  for (const segment of segmentsOf(tokenize(command))) {
    const start = segment.findIndex(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word.text))
    if (start === -1) continue

    const words = segment.slice(start)
    const head = words[0]

    if (head?.text === 'cd') {
      const dir = words[1]
      base = dir === undefined || dir.isDynamic || dir.text.startsWith('~') ? undefined : resolve(base, dir.text)
    } else if (head?.text === 'git') {
      const reason = checkGit(words, base)
      if (reason !== undefined) return reason
    }
  }

  return undefined
}
