import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { normalizeLatex } from './MathText'

interface Props {
  children: string
  className?: string
  color?: string
}

/** Fix \\frac → \frac inside math spans so KaTeX can parse. */
function prepareMarkdown(md: string) {
  return md.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_full, display, inline) => {
    const body = normalizeLatex(display ?? inline ?? '')
    return display != null ? `$$${body}$$` : `$${body}$`
  })
}

/** Notes / Bangla / step-by-step — markdown + live KaTeX. */
export default function MathMarkdown({ children, className = 'prose-notes' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'html' }]]}
      >
        {prepareMarkdown(children)}
      </ReactMarkdown>
    </div>
  )
}
