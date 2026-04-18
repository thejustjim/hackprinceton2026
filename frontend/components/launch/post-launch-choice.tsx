"use client"

import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Csv01Icon,
  DownloadSquare01Icon,
  FileImportIcon,
  MapsGlobal01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { getApiBaseUrl } from "@/lib/api-base-url"
import {
  OPTIONAL_SCENARIO_CSV_HEADERS,
  REQUIRED_SCENARIO_CSV_HEADERS,
  SCHEMA_VERSION,
  type ScenarioCsvPreview,
  validateScenarioCsvFile,
} from "@/lib/scenario-csv"
import { persistDemoDashboardEntry } from "@/lib/dashboard-entry"
import { cn } from "@/lib/utils"

type DatasetIntakeResponse = {
  id: string
  status: "uploaded"
  filename: string
  row_count: number
  schema_version: string
}

const TEMPLATE_PATH = "/templates/scenario_csv_v1.csv"

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="w-40 text-muted-foreground">{label}</TableCell>
      <TableCell className="whitespace-normal text-foreground">
        {value}
      </TableCell>
    </TableRow>
  )
}

export function PostLaunchChoice() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ScenarioCsvPreview | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [intake, setIntake] = useState<DatasetIntakeResponse | null>(null)

  async function loadFile(nextFile: File) {
    setSelectedFile(null)
    setPreview(null)
    setValidationError(null)
    setUploadError(null)
    setIntake(null)

    try {
      const text = await nextFile.text()
      const nextPreview = validateScenarioCsvFile(nextFile, text)
      setSelectedFile(nextFile)
      setPreview(nextPreview)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Unable to read this CSV."
      )
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return

    await loadFile(nextFile)
    event.target.value = ""
  }

  async function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)

    const nextFile = event.dataTransfer.files?.[0]
    if (!nextFile) return

    await loadFile(nextFile)
  }

  async function handleSubmit() {
    if (!selectedFile || !preview) return

    setIsSubmitting(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch(`${getApiBaseUrl()}/dataset-intakes`, {
        body: formData,
        method: "POST",
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const detail =
          payload && typeof payload.detail === "string"
            ? payload.detail
            : "Upload failed."
        throw new Error(detail)
      }

      setIntake(payload as DatasetIntakeResponse)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewRows = preview
    ? [
        ["Product", preview.normalized.product],
        ["Quantity", preview.normalized.quantity.toString()],
        ["Destination", preview.normalized.destination],
        [
          "Countries",
          preview.normalized.countries.length > 0
            ? preview.normalized.countries.join(" | ")
            : "Global search",
        ],
        ["Transport mode", preview.normalized.transportMode],
        [
          "Required certifications",
          preview.normalized.requireCertifications.length > 0
            ? preview.normalized.requireCertifications.join(" | ")
            : "None",
        ],
        [
          "Target count",
          preview.normalized.targetCount?.toString() ??
            "Default backend behavior",
        ],
      ]
    : []

  return (
    <main className="dashboard-shell min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-[1500px] flex-col px-6 py-6 md:px-10">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex w-fit items-center transition-opacity hover:opacity-90"
            >
              <GreenChainLogo variant="onDark" className="h-9 w-auto" />
            </Link>
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Launch options</Badge>
                <Badge variant="outline">{SCHEMA_VERSION}</Badge>
              </div>
              <h1 className="mt-4 font-heading text-4xl tracking-[-0.05em] text-white sm:text-5xl">
                Choose the next step after launch.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Upload a scenario CSV for future dataset processing, or continue
                straight into the existing demo dashboard with the sample
                scenario already loaded. The upload path in this version
                accepts and stores the file without generating a new dashboard
                yet.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <a href={TEMPLATE_PATH} download>
                <HugeiconsIcon
                  icon={DownloadSquare01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Download template
              </a>
            </Button>
            <Button asChild>
              <Link
                href="/dashboard"
                onClick={() => persistDemoDashboardEntry()}
              >
                <HugeiconsIcon
                  icon={MapsGlobal01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Continue with demo
              </Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-1 items-center py-10">
          <div className="grid w-full gap-6 xl:grid-cols-[1.28fr_0.92fr]">
            <Card className="panel-surface gap-0 rounded-[2rem] border-border/70 bg-card/92 py-0">
              <CardHeader className="gap-4 border-b border-border/70 py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>Upload CSV</Badge>
                  <Badge variant="outline">One scenario row</Badge>
                </div>
                <CardTitle>Upload a scenario CSV</CardTitle>
                <CardDescription>
                  Provide a CSV version of the backend search request shape. We
                  validate it now, store it for later processing, and keep the
                  current demo dashboard separate.
                </CardDescription>
                <CardAction className="hidden xl:block">
                  <Button asChild variant="outline" size="sm">
                    <a href={TEMPLATE_PATH} download>
                      <HugeiconsIcon
                        icon={DownloadSquare01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Download template
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-6 py-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleInputChange}
                />

                <button
                  type="button"
                  onClick={openFilePicker}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDrop={handleDrop}
                  className={cn(
                    "flex min-h-72 w-full flex-col items-center justify-center gap-5 rounded-[1.6rem] border border-dashed px-6 py-10 text-center transition-colors",
                    isDragging
                      ? "border-primary bg-primary/8"
                      : "border-border bg-background/35 hover:border-primary/50 hover:bg-background/50"
                  )}
                >
                  <div className="flex size-16 items-center justify-center rounded-full border border-border/80 bg-muted/40">
                    <HugeiconsIcon icon={Csv01Icon} strokeWidth={2} />
                  </div>
                  <div className="max-w-lg">
                    <p className="text-lg font-medium text-foreground">
                      Drag a CSV here or choose a file
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Accepted in v1: one scenario row plus header. Use pipe
                      delimiters inside cells such as <code>CN|PT|BD</code>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Required: product</Badge>
                    <Badge variant="outline">quantity</Badge>
                    <Badge variant="outline">destination</Badge>
                    <Badge variant="outline">countries</Badge>
                    <Badge variant="outline">transport_mode</Badge>
                  </div>
                </button>

                {validationError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {validationError}
                  </div>
                ) : null}

                {preview ? (
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[1.4rem] border border-border/70 bg-background/35 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Parsed preview
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {preview.filename}
                          </p>
                        </div>
                        <Badge variant="outline">Ready to submit</Badge>
                      </div>

                      <div className="mt-4">
                        <Table>
                          <TableBody>
                            {previewRows.map(([label, value]) => (
                              <PreviewRow
                                key={label}
                                label={label}
                                value={value}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </section>

                    <section className="rounded-[1.4rem] border border-border/70 bg-background/35 p-4">
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Schema notes
                          </p>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            This intake mirrors the backend search request shape
                            and stores the original CSV for later processing.
                          </p>
                        </div>

                        <Separator />

                        <div className="grid gap-3 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">
                              Required headers
                            </p>
                            <p className="mt-1 leading-6">
                              {REQUIRED_SCENARIO_CSV_HEADERS.join(", ")}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Optional headers
                            </p>
                            <p className="mt-1 leading-6">
                              {OPTIONAL_SCENARIO_CSV_HEADERS.join(", ")}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              List format
                            </p>
                            <p className="mt-1 leading-6">
                              Use pipe-delimited values inside a single cell,
                              for example <code>iso14001|sbt_committed</code>.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <Empty className="rounded-[1.6rem] border-border/70 bg-background/28">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={FileImportIcon} strokeWidth={2} />
                      </EmptyMedia>
                      <EmptyTitle>No CSV loaded yet</EmptyTitle>
                      <EmptyDescription>
                        Choose a file to validate the schema, preview the parsed
                        values, and submit it for future processing.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button asChild variant="outline">
                        <a href={TEMPLATE_PATH} download>
                          <HugeiconsIcon
                            icon={DownloadSquare01Icon}
                            strokeWidth={2}
                            data-icon="inline-start"
                          />
                          Download template
                        </a>
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}

                {uploadError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {uploadError}
                  </div>
                ) : null}

                {intake ? (
                  <div className="rounded-[1.6rem] border border-primary/25 bg-primary/8 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge>Uploaded</Badge>
                      <span className="text-sm text-muted-foreground">
                        Accepted for future dataset processing
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          Intake ID
                        </p>
                        <p className="mt-1 font-mono text-sm text-foreground">
                          {intake.id}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          Status
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {intake.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          Row count
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {intake.row_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          Filename
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {intake.filename}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          Schema
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {intake.schema_version}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-border/70 py-5">
                <div className="text-sm text-muted-foreground">
                  The file is stored as an intake artifact. This step does not
                  generate a new graph dashboard yet.
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={openFilePicker}
                    disabled={isSubmitting}
                  >
                    Choose another file
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedFile || !preview || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <HugeiconsIcon
                          icon={FileImportIcon}
                          strokeWidth={2}
                          data-icon="inline-start"
                        />
                        Submitting
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon
                          icon={FileImportIcon}
                          strokeWidth={2}
                          data-icon="inline-start"
                        />
                        Submit CSV
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>

            <Card className="panel-surface h-full gap-0 rounded-[2rem] border-border/70 bg-card/92 py-0">
              <CardHeader className="gap-4 border-b border-border/70 py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>Demo</Badge>
                  <Badge variant="outline">Current sample</Badge>
                </div>
                <CardTitle>Continue with the demo</CardTitle>
                <CardDescription>
                  Open the current lint-roller sample dashboard with the
                  existing graph and globe views. This path stays unchanged and
                  is still the only dashboard experience in this iteration.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-6 py-6">
                <div className="rounded-[1.6rem] border border-border/70 bg-background/35 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-muted/30">
                      <HugeiconsIcon icon={MapsGlobal01Icon} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-medium text-foreground">
                        Sample scenario
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Lint Roller, 10,000 units, destination Chicago. The
                        dashboard opens with the current sample graph and lets
                        you inspect the existing manufacturer and route options.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {[
                    "Direct access to the current graph + globe dashboard",
                    "No CSV upload required to keep the demo path fast",
                    "Unaffected by the new intake flow",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2}
                        className="mt-0.5 text-primary"
                      />
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/70 py-5">
                <Button asChild className="w-full">
                  <Link
                    href="/dashboard"
                    onClick={() => persistDemoDashboardEntry()}
                  >
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Continue with demo
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
