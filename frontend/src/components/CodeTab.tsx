import { useState } from 'react'
import type { CodeSnippet } from '../types'

export default function CodeTab({ snippets }: { snippets: CodeSnippet[] }) {
  const [copied, setCopied] = useState<number | null>(null)

  if (snippets.length === 0) {
    return <p className="py-14 text-center text-muted">No code or pseudocode was found on this board.</p>
  }

  const copy = async (i: number, code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(i)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-5 py-4">
      {snippets.map((s, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-board/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-board/10 bg-mist/60 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-board">{s.title}</span>
              <span className="rounded-full bg-board px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-chalk uppercase">
                {s.language}
              </span>
            </div>
            <button
              onClick={() => copy(i, s.code)}
              className="rounded-full border border-board/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-board transition-colors hover:bg-white"
            >
              {copied === i ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto bg-board p-5 text-sm leading-relaxed text-emerald-100">
            <code className="font-mono">{s.code}</code>
          </pre>
          {s.explanation && <p className="px-5 py-3.5 text-sm text-muted">{s.explanation}</p>}
        </div>
      ))}
    </div>
  )
}
