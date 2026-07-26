import { useMemo, useState } from 'react'
import Modal from './components/Modal'
import MathMarkdown from './components/MathMarkdown'
import UploadZone from './components/UploadZone'
import ProcessingOverlay from './components/ProcessingOverlay'
import FlashcardsTab from './components/FlashcardsTab'
import QuizTab from './components/QuizTab'
import CodeTab from './components/CodeTab'
import type { GenerateResponse, OutputLanguage } from './types'

type Phase = 'idle' | 'loading' | 'done' | 'error'
type Tab = 'notes' | 'code' | 'cards' | 'quiz'

const LANGS: { id: OutputLanguage; label: string }[] = [
  { id: 'bangla', label: 'Bangla' },
  { id: 'english', label: 'English' },
  { id: 'bilingual', label: 'Bilingual' },
]

const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'code', label: 'Code' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
]

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<OutputLanguage>('bilingual')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('notes')
  const [boardModal, setBoardModal] = useState(false)
  const [warningsModal, setWarningsModal] = useState(false)
  const [banglaExplain, setBanglaExplain] = useState('')
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState('')
  const [showExplain, setShowExplain] = useState(false)
  const [stepLogic, setStepLogic] = useState('')
  const [stepLoading, setStepLoading] = useState(false)
  const [stepError, setStepError] = useState('')
  const [showStep, setShowStep] = useState(false)
  const [sampleLoading, setSampleLoading] = useState(false)

  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])

  const generate = async (f: File, lang: OutputLanguage) => {
    setPhase('loading')
    setError('')
    const form = new FormData()
    form.append('image', f)
    form.append('output_language', lang)
    try {
      const res = await fetch('/api/generate', { method: 'POST', body: form })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? `Server error (${res.status})`)
      }
      setResult(await res.json())
      setTab('notes')
      setBanglaExplain('')
      setExplainError('')
      setShowExplain(false)
      setStepLogic('')
      setStepError('')
      setShowStep(false)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPhase('error')
    }
  }

  const onFile = (f: File) => {
    setFile(f)
    generate(f, language)
  }

  const trySampleBoard = async () => {
    setSampleLoading(true)
    try {
      const res = await fetch('/sample-board.png')
      if (!res.ok) throw new Error('Sample board not found')
      const blob = await res.blob()
      const sample = new File([blob], 'sample-board.png', { type: blob.type || 'image/png' })
      onFile(sample)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sample board')
      setPhase('error')
    } finally {
      setSampleLoading(false)
    }
  }

  const reset = () => {
    setPhase('idle')
    setFile(null)
    setResult(null)
    setError('')
    setBanglaExplain('')
    setExplainError('')
    setShowExplain(false)
    setStepLogic('')
    setStepError('')
    setShowStep(false)
    setBoardModal(false)
    setWarningsModal(false)
  }

  const requestBanglaExplain = async () => {
    if (!result) return
    setShowExplain(true)
    setShowStep(false)
    if (banglaExplain) return
    setExplainLoading(true)
    setExplainError('')
    try {
      const res = await fetch('/api/explain-bangla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes_markdown: result.study_pack.notes_markdown,
          title: result.study_pack.title,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      setBanglaExplain(data.explanation_markdown ?? '')
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : 'Failed to explain in Bangla')
    } finally {
      setExplainLoading(false)
    }
  }

  const requestStepLogic = async () => {
    if (!result) return
    setShowStep(true)
    setShowExplain(false)
    // Skip cache if previous response was a broken JSON envelope.
    const cachedLooksBroken =
      !!stepLogic &&
      (stepLogic.trimStart().startsWith('{') || stepLogic.includes('"logic_markdown"'))
    if (stepLogic && !cachedLooksBroken) return
    setStepLoading(true)
    setStepError('')
    try {
      const res = await fetch('/api/step-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes_markdown: result.study_pack.notes_markdown,
          title: result.study_pack.title,
          code_snippets: result.study_pack.code_snippets.map(
            (s) => `${s.title} (${s.language})\n${s.code}`,
          ),
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      let md = (data.logic_markdown ?? '').trim()
      // Client-side unwrap if backend ever returns a JSON string envelope.
      if (md.startsWith('{') && md.includes('logic_markdown')) {
        try {
          const inner = JSON.parse(md)
          if (typeof inner.logic_markdown === 'string') md = inner.logic_markdown
        } catch {
          const m = md.match(/"logic_markdown"\s*:\s*"([\s\S]*)"\s*\}\s*$/)
          if (m) {
            md = m[1]
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
          }
        }
      }
      setStepLogic(md)
    } catch (e) {
      setStepError(e instanceof Error ? e.message : 'Failed to generate step-by-step logic')
    } finally {
      setStepLoading(false)
    }
  }

  const appendQuiz = (questions: import('./types').QuizQuestion[]) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            study_pack: {
              ...prev.study_pack,
              quiz: [...prev.study_pack.quiz, ...questions],
            },
          }
        : prev,
    )
  }

  const appendFlashcards = (cards: import('./types').Flashcard[]) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            study_pack: {
              ...prev.study_pack,
              flashcards: [...prev.study_pack.flashcards, ...cards],
            },
          }
        : prev,
    )
  }

  const printNotes = () => {
    if (!result) return
    setTab('notes')

    // Print from a blank window so PDF has no "BoardSnap" title or localhost URL.
    requestAnimationFrame(() => {
      const sheet = document.getElementById('print-sheet')
      if (!sheet) {
        window.print()
        return
      }

      const title = result.study_pack.title
      const safeTitle = title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

      const styles = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
      )
        .map((el) => el.outerHTML)
        .join('\n')

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
${styles}
<style>
  @page { margin: 16mm 14mm; size: auto; }
  html, body {
    background: #fff !important;
    color: #15261f !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .print-doc { max-width: 720px; margin: 0 auto; }
  .print-doc h1 {
    font-family: Fraunces, Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 18px;
    color: #0c2920;
  }
  .print-doc .prose-notes {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
  }
  .print-doc .katex-display {
    background: transparent !important;
    border: none !important;
    padding: 0.4rem 0 !important;
  }
  .print-related {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid #d9ede2;
  }
  .print-related h2 {
    font-family: Fraunces, Georgia, serif;
    font-size: 13pt;
    margin: 0 0 8px;
    color: #0c2920;
  }
  .print-related ul {
    margin: 0;
    padding-left: 1.2rem;
    line-height: 1.6;
  }
  /* Hide screen-only chrome copied into the sheet */
  .no-print { display: none !important; }
  #print-sheet .print-related { display: block !important; }
</style>
</head>
<body>
  <div class="print-doc">
    <h1>${safeTitle}</h1>
    ${sheet.innerHTML}
  </div>
</body>
</html>`

      const w = window.open('', '_blank', 'noopener,noreferrer')
      if (!w) {
        // Popup blocked — fall back to on-page print.
        const prev = document.title
        document.title = title
        window.print()
        document.title = prev
        return
      }

      w.document.open()
      w.document.write(html)
      w.document.close()

      const run = () => {
        try {
          w.focus()
          w.print()
        } finally {
          // Close after print dialog interaction when possible.
          setTimeout(() => {
            try {
              w.close()
            } catch {
              /* ignore */
            }
          }, 400)
        }
      }

      if (w.document.readyState === 'complete') setTimeout(run, 300)
      else w.addEventListener('load', () => setTimeout(run, 300))
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/70 backdrop-blur-xl no-print">
        <div className="shell flex items-center justify-between py-4">
          <button onClick={reset} className="group text-left">
            <p className="font-display text-2xl font-bold tracking-tight text-board">
              Board<span className="text-accent-dark">Snap</span>
            </p>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
              Whiteboard to study guide
            </p>
          </button>
          <p className="rounded-full bg-board px-4 py-1.5 text-xs font-semibold tracking-wide text-chalk">
            Powered by Gemma 4
          </p>
        </div>
      </header>

      <main className="shell flex-1 pb-16">
        {phase === 'idle' && (
          <div className="animate-fade-up">
            <section className="grid items-center gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-2 lg:gap-12 lg:py-14">
              {/* Left — message */}
              <div className="w-full pr-0 text-center lg:pr-6 lg:text-left">
                <p className="text-xs font-bold tracking-[0.2em] text-accent-dark uppercase">
                  For Bangladesh classrooms
                </p>
                <h1 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-tight text-board sm:text-5xl xl:text-[4rem]">
                  Messy whiteboard in.
                  <br />
                  <span className="text-accent-dark">Interactive study pack out.</span>
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl lg:mx-0">
                  Snap your class board. BoardSnap turns messy Bangla and English notes into a
                  clean study pack with notes, code, flashcards, and a quiz.
                </p>

                <ol className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2 sm:mt-10 sm:max-w-none sm:gap-3 lg:mx-0">
                  {[
                    { n: '01', title: 'Snap', blurb: 'Board photo' },
                    { n: '02', title: 'Digitize', blurb: 'Gemma reads it' },
                    { n: '03', title: 'Study', blurb: 'Notes & quiz' },
                  ].map((step, i) => (
                    <li key={step.n} className="relative text-center lg:text-left">
                      {i < 2 && (
                        <span
                          aria-hidden
                          className="absolute top-5 left-[calc(50%+28px)] hidden h-px w-[calc(100%-40px)] bg-gradient-to-r from-accent-dark/50 to-accent-dark/10 sm:block lg:left-[56px] lg:w-[calc(100%-28px)]"
                        />
                      )}
                      <div className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-board font-display text-sm font-bold text-accent shadow-sm lg:mx-0">
                        {step.n}
                      </div>
                      <p className="mt-2.5 font-display text-base font-bold text-board sm:text-lg">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted sm:text-sm">{step.blurb}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Right — action */}
              <div className="w-full pl-0 lg:pl-6">
                <div className="w-full rounded-[1.75rem] border border-board/10 bg-white/80 p-5 shadow-[0_28px_70px_-40px_rgba(12,41,32,0.45)] backdrop-blur sm:p-7 lg:p-8">
                  <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-board sm:text-base">Output language</span>
                    <div className="flex w-full rounded-full border border-board/10 bg-mist/70 p-1 sm:w-auto">
                      {LANGS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setLanguage(l.id)}
                          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-5 ${
                            language === l.id
                              ? 'bg-board text-chalk shadow-sm'
                              : 'text-muted hover:text-board'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <UploadZone onFile={onFile} onSample={trySampleBoard} sampleLoading={sampleLoading} />
                </div>
              </div>
            </section>
          </div>
        )}

        {phase === 'loading' && (
          <div className="pt-14">
            <ProcessingOverlay imageUrl={imageUrl} />
          </div>
        )}

        {phase === 'error' && (
          <div className="mx-auto max-w-xl pt-24 text-center animate-fade-up">
            <div className="rounded-3xl border border-red-200/80 bg-white p-10 shadow-sm">
              <p className="font-display text-2xl font-bold text-red-700">Generation failed</p>
              <p className="mt-2 text-sm text-red-500/90">{error}</p>
              <div className="mt-8 flex justify-center gap-3">
                {file && (
                  <button
                    onClick={() => generate(file, language)}
                    className="rounded-full bg-board px-6 py-2.5 text-sm font-semibold text-chalk transition-colors hover:bg-board-light"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={reset}
                  className="rounded-full border border-board/15 bg-white px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-mist"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="py-10 animate-fade-up">
            {/* Title + actions */}
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 no-print">
              <div className="min-w-0">
                <h2 className="font-display text-3xl leading-tight font-bold text-board sm:text-4xl">
                  {result.study_pack.title}
                </h2>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                  {result.study_pack.subject && <span>{result.study_pack.subject}</span>}
                  {result.study_pack.subject && <span className="text-board/20">·</span>}
                  <span>{result.study_pack.detected_languages.join(', ')}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 no-print">
                <button
                  onClick={requestBanglaExplain}
                  className="rounded-full border border-board/15 bg-white px-4 py-2 text-sm font-semibold text-board transition-colors hover:bg-mist"
                >
                  Easy Bangla
                </button>
                <button
                  onClick={requestStepLogic}
                  className="rounded-full border border-board/15 bg-white px-4 py-2 text-sm font-semibold text-board transition-colors hover:bg-mist"
                >
                  Step-by-step
                </button>
                <button
                  onClick={printNotes}
                  className="rounded-full bg-accent-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  Print / PDF
                </button>
                <button
                  onClick={reset}
                  className="rounded-full border border-board/15 bg-white px-4 py-2 text-sm font-semibold text-board transition-colors hover:bg-mist"
                >
                  New board
                </button>
              </div>
            </div>

            {/* Compact utility row: source board + warnings, both open in a modal */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 no-print">
              <button
                onClick={() => setBoardModal(true)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-board/10 bg-white/70 p-3 text-left transition-colors hover:border-accent-dark/40 hover:bg-white"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <img
                    src={imageUrl}
                    alt="Whiteboard thumbnail"
                    className="h-11 w-14 shrink-0 rounded-lg border border-board/10 object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-board">Source whiteboard</span>
                    <span className="block truncate text-xs text-muted">View original image</span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-accent-dark">Open</span>
              </button>

              <button
                onClick={() => result.study_pack.warnings.length > 0 && setWarningsModal(true)}
                disabled={result.study_pack.warnings.length === 0}
                className="flex items-center justify-between gap-3 rounded-2xl border border-board/10 bg-white/70 p-3 text-left transition-colors enabled:hover:border-accent-dark/40 enabled:hover:bg-white disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-mist font-display text-lg font-bold text-board">
                    {result.study_pack.warnings.length}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-board">Unclear parts</span>
                    <span className="block truncate text-xs text-muted">
                      {result.study_pack.warnings.length === 0
                        ? 'Everything was legible'
                        : 'Flagged, never guessed'}
                    </span>
                  </span>
                </span>
                {result.study_pack.warnings.length > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-accent-dark">Open</span>
                )}
              </button>
            </div>

            <div className="mt-6">
              <section className="w-full">
                <div className="sticky top-[76px] z-10 flex items-center gap-1 overflow-x-auto rounded-2xl border border-board/10 bg-white/95 p-1.5 shadow-sm backdrop-blur no-print">
                  {TABS.map(({ id, label }) => {
                    const count =
                      id === 'code'
                        ? result.study_pack.code_snippets.length
                        : id === 'cards'
                          ? result.study_pack.flashcards.length
                          : id === 'quiz'
                            ? result.study_pack.quiz.length
                            : null
                    return (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                          tab === id
                            ? 'bg-board text-chalk shadow'
                            : 'text-muted hover:bg-mist hover:text-board'
                        }`}
                      >
                        {label}
                        {count !== null && count > 0 && (
                          <span
                            className={`rounded-full px-1.5 text-[11px] ${
                              tab === id ? 'bg-accent text-board' : 'bg-mist text-accent-dark'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 print-notes">
                  {tab === 'notes' && (
                    <div className="space-y-5">
                      {showExplain && (
                        <div className="rounded-2xl border border-accent-dark/20 bg-mist/60 px-7 py-6 shadow-sm sm:px-9 no-print">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold tracking-wide text-accent-dark uppercase">
                              Easy Bangla explanation
                            </p>
                            <button
                              onClick={() => setShowExplain(false)}
                              className="text-xs font-semibold text-muted hover:text-board"
                            >
                              Hide
                            </button>
                          </div>
                          {explainLoading && (
                            <p className="text-sm text-muted">Gemma is explaining in simple Bangla…</p>
                          )}
                          {explainError && <p className="text-sm text-red-600">{explainError}</p>}
                          {banglaExplain && <MathMarkdown>{banglaExplain}</MathMarkdown>}
                        </div>
                      )}

                      {showStep && (
                        <div className="rounded-2xl border border-board/15 bg-white px-7 py-6 shadow-sm sm:px-9 no-print">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold tracking-wide text-board uppercase">
                              Step-by-step logic
                            </p>
                            <button
                              onClick={() => setShowStep(false)}
                              className="text-xs font-semibold text-muted hover:text-board"
                            >
                              Hide
                            </button>
                          </div>
                          {stepLoading && (
                            <p className="text-sm text-muted">Gemma is walking through the board…</p>
                          )}
                          {stepError && <p className="text-sm text-red-600">{stepError}</p>}
                          {stepLogic && <MathMarkdown>{stepLogic}</MathMarkdown>}
                        </div>
                      )}

                      <div id="print-sheet">
                        <MathMarkdown className="prose-notes rounded-2xl border border-board/10 bg-white px-7 py-6 shadow-sm sm:px-9 sm:py-8">
                          {result.study_pack.notes_markdown}
                        </MathMarkdown>

                        {(result.study_pack.related_topics?.length ?? 0) > 0 && (
                          <div className="print-related">
                            <h2>Related topics</h2>
                            <ul>
                              {result.study_pack.related_topics.map((topic) => (
                                <li key={topic}>{topic}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {(result.study_pack.related_topics?.length ?? 0) > 0 && (
                        <div className="mt-5 rounded-2xl border border-board/10 bg-white px-6 py-5 no-print">
                          <p className="text-sm font-bold tracking-wide text-board uppercase">
                            Related topics to study next
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.study_pack.related_topics.map((topic) => (
                              <span
                                key={topic}
                                className="rounded-full bg-mist px-3.5 py-1.5 text-sm font-medium text-board"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {tab === 'code' && (
                    <div className="no-print">
                      <CodeTab snippets={result.study_pack.code_snippets} />
                    </div>
                  )}
                  {tab === 'cards' && (
                    <div className="no-print">
                      <FlashcardsTab
                        cards={result.study_pack.flashcards}
                        notesMarkdown={result.study_pack.notes_markdown}
                        onAppendCards={appendFlashcards}
                      />
                    </div>
                  )}
                  {tab === 'quiz' && (
                    <div className="no-print">
                      <QuizTab
                        quiz={result.study_pack.quiz}
                        notesMarkdown={result.study_pack.notes_markdown}
                        onAppendQuiz={appendQuiz}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {boardModal && imageUrl && (
        <Modal title="Source whiteboard" onClose={() => setBoardModal(false)}>
          <img
            src={imageUrl}
            alt="Original whiteboard"
            className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-board/10 object-contain"
          />
        </Modal>
      )}

      {warningsModal && result && (
        <Modal title="Unclear parts of the board" onClose={() => setWarningsModal(false)}>
          <p className="mb-4 text-sm text-muted">
            Gemma flagged these instead of guessing what the handwriting said.
          </p>
          <ul className="space-y-2.5">
            {result.study_pack.warnings.map((w, i) => (
              <li
                key={i}
                className="rounded-xl border border-board/10 bg-mist/50 px-4 py-3 text-sm leading-relaxed text-board/85"
              >
                {w}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      <footer className="mt-auto border-t border-board/10 bg-board text-chalk no-print">
        <div className="shell flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold">BoardSnap</p>
            <p className="text-sm text-emerald-200/80">
              Build With Gemma @Bangladesh · Multimodal Track
            </p>
          </div>
          <p className="text-sm font-medium text-emerald-100/90">
            Developed by <span className="font-semibold text-white">Abdullah Al Noman</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
