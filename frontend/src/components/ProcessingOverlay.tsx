import { useEffect, useState } from 'react'

const STAGES = [
  'Reading the board',
  'Reconstructing structure',
  'Extracting code',
  'Building study materials',
]

export default function ProcessingOverlay({ imageUrl }: { imageUrl: string }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1))
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 animate-fade-up">
      <div className="relative overflow-hidden rounded-3xl shadow-[0_24px_60px_-28px_rgba(12,41,32,0.5)]">
        <img src={imageUrl} alt="Uploaded whiteboard" className="max-h-80 w-auto" />
        <div className="absolute inset-0 bg-gradient-to-t from-board/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-1 bg-accent animate-pulse-soft" />
      </div>

      <div className="w-full space-y-2">
        {STAGES.map((label, i) => {
          const done = i < stage
          const active = i === stage
          return (
            <div
              key={label}
              className={`flex items-center gap-4 rounded-2xl border px-5 py-3.5 transition-all duration-500 ${
                active
                  ? 'border-accent/60 bg-white shadow-sm'
                  : done
                    ? 'border-board/10 bg-white/70'
                    : 'border-transparent bg-white/40 opacity-45'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-accent-dark text-white'
                    : active
                      ? 'bg-board text-chalk'
                      : 'bg-mist text-muted'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <p className={`font-semibold ${active ? 'text-board' : 'text-muted'}`}>{label}</p>
            </div>
          )
        })}
      </div>

      <p className="text-sm text-muted">Gemma 4 is working — usually takes 20–60 seconds</p>
    </div>
  )
}
