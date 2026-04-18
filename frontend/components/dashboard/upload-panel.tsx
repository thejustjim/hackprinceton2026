"use client"

import { useRef, useState, type ChangeEvent, type DragEvent } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type UploadPanelStatus = "idle" | "loading" | "error"

interface UploadPanelProps {
  className?: string
  error: string | null
  onFile: (file: File) => void
  onReset: () => void
  onUseDemo: () => void
  status: UploadPanelStatus
}

function UploadGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 18a4 4 0 1 1 .8-7.92A6 6 0 0 1 19 9a4.5 4.5 0 0 1 .5 8.97" />
      <path d="M12 12v8" />
      <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
    </svg>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      className={cn("animate-spin", className)}
    >
      <path d="M12 3a9 9 0 1 0 9 9" opacity={0.9} />
      <path d="M12 3a9 9 0 0 1 9 9" opacity={0.25} />
    </svg>
  )
}

export function UploadPanel({
  className,
  error,
  onFile,
  onReset,
  onUseDemo,
  status,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  function openFilePicker() {
    if (status === "loading") return
    inputRef.current?.click()
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ""
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    if (status === "loading") return

    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (status === "loading") return
    setIsDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
  }

  return (
    <section
      className={cn(
        "panel-surface flex flex-col gap-3 rounded-2xl px-4 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.28em] text-white/40 uppercase">
            Upload
          </p>
          <p className="mt-1 text-sm font-medium text-white/85">
            Upload a CSV of your current product &amp; supplier
          </p>
          <p className="mt-1 text-xs text-white/48">
            Required columns: product, destination, quantity, current_manufacturer,
            current_country. One data row only.
          </p>
        </div>
        {status === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="rounded-full text-white/70 hover:bg-white/[0.05] hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            Reset
          </Button>
        ) : null}
      </div>

      <div
        onClick={openFilePicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openFilePicker()
          }
        }}
        role="button"
        tabIndex={0}
        aria-disabled={status === "loading"}
        className={cn(
          "relative flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] bg-[rgba(10,10,18,0.48)] px-4 py-5 text-center transition-colors",
          status === "loading"
            ? "cursor-wait opacity-80"
            : "cursor-pointer hover:border-white/[0.26] hover:bg-[rgba(14,14,22,0.6)]",
          isDragActive && "border-primary/60 bg-[rgba(18,26,20,0.7)]",
          status === "error" && "border-red-400/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={handleFileInputChange}
        />

        {status === "loading" ? (
          <>
            <Spinner className="h-6 w-6 text-white/70" />
            <p className="text-sm font-medium text-white/85">
              Searching manufacturers…
            </p>
            <p className="text-xs text-white/48">
              Running agent + ML scoring. This takes 15–60 seconds.
            </p>
          </>
        ) : status === "error" ? (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-400/10 text-red-300">
              !
            </div>
            <p className="text-sm font-medium text-red-200">
              {error ?? "Something went wrong."}
            </p>
            <p className="text-xs text-white/48">
              Click to try a different CSV or press Reset.
            </p>
          </>
        ) : (
          <>
            <UploadGlyph className="h-6 w-6 text-white/60" />
            <p className="text-sm font-medium text-white/85">
              Drop a CSV here, or click to browse
            </p>
            <p className="text-xs text-white/48">
              Single-row CSV · triggers a live backend search
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onUseDemo}
          disabled={status === "loading"}
          className="text-xs text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Or use demo data (sample Lint Roller scenario)
        </button>
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          {status === "loading"
            ? "Running"
            : status === "error"
              ? "Error"
              : "Ready"}
        </span>
      </div>
    </section>
  )
}
