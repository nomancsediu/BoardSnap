import { useCallback, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  onSample?: () => void
  sampleLoading?: boolean
}

export default function UploadZone({ onFile, onSample, sampleLoading }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file && file.type.startsWith('image/')) onFile(file)
    },
    [onFile],
  )

  return (
    <div className="space-y-3">
      <label
        className={`group flex min-h-[180px] flex-col items-center justify-center gap-3.5 rounded-2xl border px-4 py-8 cursor-pointer transition-all duration-300 sm:min-h-[250px] sm:gap-4 sm:px-8 sm:py-12 ${
          dragging
            ? 'border-accent bg-mist'
            : 'border-board/15 bg-mist/50 hover:border-accent-dark/50 hover:bg-mist/80'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-board text-chalk transition-transform group-hover:scale-105">
          <span className="font-display text-2xl font-bold leading-none">+</span>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold text-board sm:text-2xl">Drop a whiteboard photo</p>
          <p className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">JPG, PNG or WebP · max 10 MB</p>
        </div>
        <span className="rounded-full bg-accent-dark px-6 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-emerald-800">
          Choose photo
        </span>
      </label>

      {onSample && (
        <button
          type="button"
          onClick={onSample}
          disabled={sampleLoading}
          className="w-full rounded-2xl bg-accent-dark px-4 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
        >
          {sampleLoading ? 'Loading sample…' : 'Try sample board'}
        </button>
      )}
    </div>
  )
}
