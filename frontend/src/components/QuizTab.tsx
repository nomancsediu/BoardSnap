import { useEffect, useState } from 'react'
import type { QuizDifficulty, QuizQuestion } from '../types'

interface Props {
  quiz: QuizQuestion[]
  notesMarkdown: string
  onAppendQuiz: (questions: QuizQuestion[]) => void
}

export default function QuizTab({ quiz, notesMarkdown, onAppendQuiz }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAnswers({})
  }, [quiz.length])

  const answered = Object.keys(answers).length
  const correct = Object.entries(answers).filter(([q, a]) => quiz[Number(q)]?.correct_index === a).length

  const generateMore = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/more-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes_markdown: notesMarkdown,
          existing_questions: quiz.map((q) => q.question),
          count: 5,
          difficulty,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      onAppendQuiz(data.quiz ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate more quiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-board/10 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-board">Difficulty</span>
          {(['easy', 'mixed', 'hard'] as QuizDifficulty[]).map((d) => (
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {quiz.length === 0 ? (
        <p className="py-10 text-center text-muted">No quiz yet — generate questions from your notes.</p>
      ) : (
        <>
          {answered === quiz.length && quiz.length > 0 && (
            <div className="rounded-3xl bg-board px-7 py-5 text-chalk shadow-lg animate-fade-up">
              <p className="font-display text-2xl font-bold">
                Score: {correct} / {quiz.length}
              </p>
              <p className="mt-1 text-sm text-emerald-200">
                {correct === quiz.length
                  ? 'Perfect — you nailed every question.'
                  : 'Review the notes and generate more practice questions.'}
              </p>
            </div>
          )}

          {quiz.map((q, qi) => {
            const picked = answers[qi]
            return (
              <div key={`${qi}-${q.question.slice(0, 24)}`} className="rounded-3xl border border-board/10 bg-white p-6 shadow-sm">
                <p className="text-base font-semibold leading-relaxed text-board">
                  {qi + 1}. {q.question}
                </p>
                <div className="mt-4 grid gap-2">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi
                    const isCorrect = q.correct_index === oi
                    const revealed = picked !== undefined
                    let style = 'border-board/10 bg-white hover:border-accent-dark/40 hover:bg-mist'
                    if (revealed && isCorrect) style = 'border-emerald-500 bg-emerald-50'
                    else if (revealed && isPicked && !isCorrect) style = 'border-red-400 bg-red-50'
                    else if (revealed) style = 'border-board/10 bg-white opacity-55'

                    return (
                      <button
                        key={oi}
                        disabled={revealed}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all disabled:cursor-default ${style}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {picked !== undefined && q.explanation && (
                  <p className="mt-3 rounded-xl bg-mist px-4 py-2.5 text-sm text-board/80 animate-fade-up">
                    {q.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
