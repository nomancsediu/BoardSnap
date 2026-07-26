import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

type Part = { type: 'text'; value: string } | { type: 'math'; value: string; display: boolean }

/** Soften wrappers / double-escaped commands (same idea as Excali Pro). */
export function normalizeLatex(raw: string) {
  let t = raw.trim()
  t = t.replace(/^\$\$([\s\S]*)\$\$$/m, '$1')
  t = t.replace(/^\$([^$]*)\$$/m, '$1')
  t = t.replace(/^\\\(([\s\S]*)\\\)$/m, '$1')
  t = t.replace(/^\\\[([\s\S]*)\\\]$/m, '$1')
  // Collapse accidental double-backslashes before LaTeX commands: \\frac → \frac
  t = t.replace(/\\\\([a-zA-Z]+)/g, '\\$1')
  return t.trim()
}

function splitMath(input: string): Part[] {
  const text = input ?? ''
  if (!text) return [{ type: 'text', value: '' }]

  const parts: Part[] = []
  // $$...$$ first, then $...$, then \(...\), \[...\]
  const re =
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) })
    }
    if (m[1] != null) parts.push({ type: 'math', value: m[1], display: true })
    else if (m[2] != null) parts.push({ type: 'math', value: m[2], display: false })
    else if (m[3] != null) parts.push({ type: 'math', value: m[3], display: false })
    else if (m[4] != null) parts.push({ type: 'math', value: m[4], display: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts.length ? parts : [{ type: 'text', value: text }]
}

function renderKatex(latex: string, display: boolean) {
  try {
    return katex.renderToString(normalizeLatex(latex), {
      throwOnError: false,
      displayMode: display,
      strict: 'ignore',
      trust: false,
      output: 'html',
    })
  } catch {
    return normalizeLatex(latex)
  }
}

interface Props {
  children: string
  className?: string
}

/**
 * Inline text + KaTeX, Excali Pro style (direct katex.renderToString).
 * Use for quiz / flashcards where remark-math often leaves raw `$...$`.
 */
export default function MathText({ children, className = '' }: Props) {
  const parts = useMemo(() => splitMath(children), [children])

  return (
    <span className={`math-text ${className}`.trim()}>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{part.value}</span>
        ) : (
          <span
            key={i}
            className={part.display ? 'math-text-display' : 'math-text-inline'}
            dangerouslySetInnerHTML={{ __html: renderKatex(part.value, part.display) }}
          />
        ),
      )}
    </span>
  )
}
