import { useEffect, useState } from 'react'

type IconProps = { className?: string }

const CheckIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
    <path d="M4.5 12.5l5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ScanIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M3 8V5a2 2 0 012-2h3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M21 16v3a2 2 0 01-2 2h-3" strokeLinecap="round" />
    <path d="M3 12h18" strokeLinecap="round" />
  </svg>
)

const NotesIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
  </svg>
)

const CodeIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CardsIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="3" y="7" width="13" height="14" rx="2.5" />
    <path d="M8 3h10a3 3 0 013 3v10" strokeLinecap="round" />
  </svg>
)

const STAGES = [
  { title: 'Reading the board', hint: 'OCR + layout', Icon: ScanIcon },
  { title: 'Reconstructing notes', hint: 'Clean Markdown', Icon: NotesIcon },
  { title: 'Extracting code', hint: 'Snippets & logic', Icon: CodeIcon },
  { title: 'Building study pack', hint: 'Cards & quiz', Icon: CardsIcon },
]

export default function ProcessingOverlay({ imageUrl }: { imageUrl: string }) {
  const [stage, setStage] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const stages = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1))
    }, 5500)
    const clock = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => {
      clearInterval(stages)
      clearInterval(clock)
    }
  }, [])

  const progress = ((stage + 1) / STAGES.length) * 100
  const ActiveIcon = STAGES[stage].Icon

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 pt-4 animate-fade-up sm:gap-10">
      <div className="text-center">
        <p className="text-xs font-bold tracking-[0.18em] text-accent-dark uppercase">
          Digitize in progress
        </p>
        <div className="mt-3 flex items-center justify-center gap-2.5">
          <ActiveIcon className="h-6 w-6 text-accent-dark" />
          <h2 className="font-display text-2xl font-bold text-board sm:text-3xl">
            {STAGES[stage].title}
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted">{STAGES[stage].hint}</p>
      </div>

      <div className="relative w-full overflow-hidden rounded-3xl border border-board/10 bg-board shadow-[0_24px_60px_-28px_rgba(12,41,32,0.5)]">
        <img
          src={imageUrl}
          alt="Uploaded whiteboard"
          className="mx-auto max-h-72 w-auto opacity-90 sm:max-h-80"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-board/55 via-transparent to-board/20" />
        <div className="scan-beam pointer-events-none absolute inset-x-0 h-16" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-10">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-emerald-100/90">
            <span>Gemma 4 vision</span>
            <span>{elapsed}s</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {STAGES.map((item, i) => {
          const done = i < stage
          const active = i === stage
          const StepIcon = item.Icon
          return (
            <li
              key={item.title}
              className={`rounded-2xl border px-3.5 py-3 transition-all duration-500 ${
                active
                  ? 'border-accent-dark/40 bg-white shadow-sm'
                  : done
                    ? 'border-board/10 bg-white/80'
                    : 'border-board/5 bg-white/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    done
                      ? 'bg-accent-dark text-white'
                      : active
                        ? 'bg-board text-accent'
                        : 'bg-mist text-muted'
                  }`}
                >
                  {done ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </span>
                {active && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-dark" />
                )}
              </div>
              <p
                className={`mt-2 text-sm font-semibold leading-snug ${
                  active || done ? 'text-board' : 'text-muted'
                }`}
              >
                {item.title}
              </p>
            </li>
          )
        })}
      </ol>

      <p className="text-center text-sm text-muted">
        Usually finishes in about a minute. Keep this tab open.
      </p>
    </div>
  )
}
