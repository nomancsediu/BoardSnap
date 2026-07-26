import { useEffect, useState } from 'react'
import type { Flashcard } from '../types'
import MathText from './MathText'

interface Props {
  cards: Flashcard[]
  notesMarkdown: string
  onAppendCards: (cards: Flashcard[]) => void
}

export default function FlashcardsTab({ cards, notesMarkdown, onAppendCards }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [difficulty, setDifficulty] = useState<'mixed' | 'hard'>('hard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setIndex(0)
    setFlipped(false)
  }, [cards.length])

  const generateMore = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/more-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes_markdown: notesMarkdown,
          existing_questions: cards.map((c) => c.question),
          count: 5,
          difficulty,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      onAppendCards(data.flashcards ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate more flashcards')
    } finally {
      setLoading(false)
    }
  }

  const go = (dir: number) => {
    if (cards.length === 0) return
    setFlipped(false)
    setIndex((i) => (i + dir + cards.length) % cards.length)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-board/10 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-board">Difficulty</span>
          {(['mixed', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                difficulty === d ? 'bg-board text-chalk' : 'bg-mist text-muted hover:text-board'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={generateMore}
          disabled={loading || !notesMarkdown}
          className="rounded-full bg-accent-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate 5 more'}
        </button>
      </div>

      {error && <p className="w-full text-sm text-red-600">{error}</p>}

      {cards.length === 0 ? (
        <p className="py-10 text-center text-muted">
          No flashcards yet. Generate harder cards from your notes.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-muted">
            Card {index + 1} of {cards.length} · tap card to flip
          </p>

          <div
            className={`flip-card w-full cursor-pointer select-none ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
          >
            <div className="flip-card-inner h-80 w-full">
              <div className="flip-face absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[1.75rem] bg-board p-8 text-center shadow-xl sm:p-10">
                <span className="text-[11px] font-bold tracking-[0.2em] text-accent uppercase">
                  Question
                </span>
                <MathText className="prose-flash w-full text-chalk">
                  {cards[index].question}
                </MathText>
              </div>
              <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[1.75rem] bg-accent-dark p-8 text-center shadow-xl sm:p-10">
                <span className="text-[11px] font-bold tracking-[0.2em] text-white/80 uppercase">
                  Answer
                </span>
                <MathText className="prose-flash w-full text-white">
                  {cards[index].answer}
                </MathText>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => go(-1)}
              className="rounded-full border border-board/15 bg-white px-5 py-2.5 text-sm font-semibold text-board transition-colors hover:bg-mist"
            >
              Previous
            </button>
            <div className="flex gap-1.5">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-accent-dark' : 'w-1.5 bg-board/15'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => go(1)}
              className="rounded-full border border-board/15 bg-white px-5 py-2.5 text-sm font-semibold text-board transition-colors hover:bg-mist"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
