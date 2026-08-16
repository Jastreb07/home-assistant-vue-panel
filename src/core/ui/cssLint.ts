import { lexer, tokenize, tokenTypes as TT } from 'css-tree'

/**
 * Linting for the per-card CSS editor.
 *
 * Structure is scanned with css-tree's tokenizer, validation is done by
 * css-tree's lexer per declaration. Two reasons for not using a parser:
 *  - css-tree's parser rejects nested rules (no CSS nesting support in
 *    v3), and card CSS is nested by nature — `.clock-card { … }` sits
 *    inside the card's `[data-vp-card]` wrapper.
 *  - PostCSS would parse it, but drags Node built-ins (path/fs/url) into
 *    a browser-only bundle.
 * The tokenizer handles comments, strings and url() correctly, so the
 * scan below only has to track brace/paren depth.
 */

export interface CssDiagnostic {
  from: number
  to: number
  severity: 'error' | 'warning'
  message: string
}

/** css-tree cannot resolve custom properties — not a real problem. */
const VAR_NOISE = /var\(\)/i

interface Token {
  type: number
  start: number
  end: number
}

/** One `prop: value` candidate, collected between two terminators. */
interface Statement {
  tokens: Token[]
  colon: number
}

export function lintCss(source: string): CssDiagnostic[] {
  if (!source.trim()) return []

  const diagnostics: CssDiagnostic[] = []
  const openBraces: number[] = []
  let parenDepth = 0
  let statement: Statement = { tokens: [], colon: -1 }

  const reset = () => {
    statement = { tokens: [], colon: -1 }
  }

  tokenize(source, (type: number, start: number, end: number) => {
    if (type === TT.Comment || type === TT.WhiteSpace) return

    switch (type) {
      case TT.LeftParenthesis:
      case TT.Function:
        parenDepth++
        break
      case TT.RightParenthesis:
        parenDepth = Math.max(0, parenDepth - 1)
        break
      case TT.LeftCurlyBracket:
        if (parenDepth === 0) {
          // The statement was a selector / at-rule prelude, not a declaration
          openBraces.push(start)
          reset()
          return
        }
        break
      case TT.RightCurlyBracket:
        if (parenDepth === 0) {
          checkDeclaration(source, statement, diagnostics)
          reset()
          if (openBraces.pop() === undefined) {
            diagnostics.push({
              from: start,
              to: end,
              severity: 'error',
              message: 'Unexpected `}`',
            })
          }
          return
        }
        break
      case TT.Semicolon:
        if (parenDepth === 0) {
          checkDeclaration(source, statement, diagnostics)
          reset()
          return
        }
        break
      case TT.Colon:
        // Only the first top-level colon separates property from value
        if (parenDepth === 0 && statement.colon === -1) statement.colon = statement.tokens.length
        break
    }

    statement.tokens.push({ type, start, end })
  })

  // Trailing declaration without a closing semicolon
  checkDeclaration(source, statement, diagnostics)

  for (const offset of openBraces) {
    diagnostics.push({
      from: offset,
      to: offset + 1,
      severity: 'error',
      message: 'Unclosed block',
    })
  }

  return diagnostics
}

function checkDeclaration(
  source: string,
  statement: Statement,
  diagnostics: CssDiagnostic[],
): void {
  const { tokens, colon } = statement
  // `colon` is the index OF the colon token: property before, value after
  if (colon < 1 || colon >= tokens.length) return

  const first = tokens[0]!
  // At-rules (@media, @import, …) are preludes, not declarations
  if (source[first.start] === '@') return

  const propFrom = first.start
  const propTo = tokens[colon - 1]!.end
  const prop = source.slice(propFrom, propTo).trim()
  // Selectors like `&:hover` never reach here (they end with `{`), but
  // guard against anything that is not a plain property name
  if (!/^[-\w]+$/.test(prop)) return

  // Custom properties (--x) accept any value
  if (prop.startsWith('--')) return

  const colonEnd = tokens[colon]!.end
  if (colon + 1 >= tokens.length) {
    diagnostics.push({
      from: propFrom,
      to: colonEnd,
      severity: 'warning',
      message: `Missing value for \`${prop}\``,
    })
    return
  }

  const valueTo = tokens[tokens.length - 1]!.end
  const value = source
    .slice(tokens[colon + 1]!.start, valueTo)
    .replace(/!\s*important\s*$/i, '')
    .trim()

  const unknown = lexer.checkPropertyName(prop)
  if (unknown) {
    diagnostics.push({
      from: propFrom,
      to: propTo,
      severity: 'warning',
      message: unknown.message,
    })
    return
  }

  const match = lexer.matchProperty(prop, value)
  if (!match.error) return
  const error = match.error as { rawMessage?: string; message: string }
  const message = error.rawMessage ?? error.message
  if (VAR_NOISE.test(message)) return

  diagnostics.push({
    from: propFrom,
    to: valueTo,
    severity: 'warning',
    message: `${message} — ${prop}: ${value}`,
  })
}
