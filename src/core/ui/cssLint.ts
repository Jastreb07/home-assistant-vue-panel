import { lexer, parse, walk, type CssNode } from 'css-tree'

/**
 * Linting for the per-card CSS editor.
 *
 * The editor content is not a full stylesheet but the body of a rule —
 * it gets wrapped in `[data-vp-card="…"] { … }` before it is applied
 * (see CardCss.vue). So we wrap it the same way before parsing,
 * otherwise nested selectors like `.clock-card { … }` would be reported
 * as errors. All offsets are shifted back to the editor's coordinates.
 */

export interface CssDiagnostic {
  from: number
  to: number
  severity: 'error' | 'warning'
  message: string
}

const PREFIX = '[data-vp-card="x"] {\n'
const SUFFIX = '\n}'

export function lintCss(source: string): CssDiagnostic[] {
  if (!source.trim()) return []

  const wrapped = PREFIX + source + SUFFIX
  const diagnostics: CssDiagnostic[] = []
  const max = source.length

  /** Map an offset in the wrapped text back into the editor text. */
  const at = (offset: number | undefined): number =>
    Math.max(0, Math.min(max, (offset ?? PREFIX.length) - PREFIX.length))

  let ast: CssNode
  try {
    ast = parse(wrapped, {
      positions: true,
      onParseError(error: { offset?: number; message?: string; rawMessage?: string }) {
        const from = at(error.offset)
        diagnostics.push({
          from,
          to: Math.min(max, from + 1),
          severity: 'error',
          message: error.rawMessage ?? error.message ?? 'Parse error',
        })
      },
    })
  } catch {
    // css-tree recovers from almost everything; bail out silently otherwise
    return diagnostics
  }

  // Unknown properties and values that don't match the CSS spec
  walk(ast, {
    visit: 'Declaration',
    enter(node) {
      const loc = node.loc
      if (!loc) return
      const from = at(loc.start.offset)
      const to = at(loc.end.offset)

      // Custom properties (--x) accept anything
      if (node.property.startsWith('--')) return

      const known = lexer.checkPropertyName(node.property)
      if (known) {
        diagnostics.push({ from, to, severity: 'warning', message: known.message })
        return
      }

      const match = lexer.matchDeclaration(node)
      if (match.error) {
        const message = match.error.rawMessage ?? match.error.message
        // Grammar gaps in css-tree's spec data produce noise — skip those
        if (!/Unknown (property|at-rule)|Lexer matching doesn't applicable/i.test(message)) {
          diagnostics.push({ from, to, severity: 'warning', message })
        }
      }
    },
  })

  return diagnostics
}
