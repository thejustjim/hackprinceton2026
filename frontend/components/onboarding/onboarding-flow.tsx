"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  Check,
  ChevronLeft,
  MapPin,
  Package2,
  Settings2,
  Upload,
} from "lucide-react"
import {
  startTransition,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supplyChainSnapshot } from "@/lib/mock-supply-chain"

type OnboardingState = {
  location: string
  inputMode: "file" | "manual"
  productName: string
  manualDescription: string
  uploadedJsonName: string
  uploadedJsonPreview: string
  preferences: string[]
  notes: string
}

type StepId = "location" | "product" | "upload" | "preferences"

type StepDefinition = {
  id: StepId
  label: string
  title: string
  description: string
  icon: typeof MapPin
}

const STEPS: StepDefinition[] = [
  {
    id: "location",
    label: "01 Location",
    title: "Where should we ground the supply view?",
    description:
      "Start with a region, city, or facility so the demo can anchor the first set of recommendations.",
    icon: MapPin,
  },
  {
    id: "product",
    label: "02 Product",
    title: "How do you want to provide product data?",
    description:
      "Choose a product JSON file for auto-detection, or write a manual description of the product and components.",
    icon: Package2,
  },
  {
    id: "upload",
    label: "03 Review",
    title: "Review the captured product intake.",
    description:
      "Confirm what the demo will use before moving into the dashboard.",
    icon: Upload,
  },
  {
    id: "preferences",
    label: "04 Preferences",
    title: "Tune the experience before we launch.",
    description:
      "Choose the signals to emphasize in the dashboard and add any notes the demo should respect.",
    icon: Settings2,
  },
]

const PREFERENCE_OPTIONS = [
  "Show sustainability signals first",
  "Highlight supplier risk alerts",
  "Prioritize logistics bottlenecks",
  "Keep the first view investor-friendly",
]

const DEFAULT_JSON_PREVIEW = `{
  "product": "Portable EV Charger",
  "components": [
    {
      "name": "Battery Module",
      "supplier": "Volta Storage",
      "origin": "Nevada, USA"
    },
    {
      "name": "Control Board",
      "supplier": "Circuit Harbor",
      "origin": "Taichung, Taiwan"
    }
  ]
}`

const initialState: OnboardingState = {
  location: "",
  inputMode: "file",
  productName: "",
  manualDescription: "",
  uploadedJsonName: "",
  uploadedJsonPreview: DEFAULT_JSON_PREVIEW,
  preferences: ["Show sustainability signals first"],
  notes: "",
}

const panelVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 48 : -48,
    filter: "blur(10px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -48 : 48,
    filter: "blur(10px)",
  }),
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isComplete, setIsComplete] = useState(false)
  const [form, setForm] = useState(initialState)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeStep = STEPS[currentStep]
  const completion = ((currentStep + 1) / STEPS.length) * 100

  const parsedJsonStatus = useMemo(() => {
    try {
      JSON.parse(form.uploadedJsonPreview)
      return { ok: true, label: "Valid JSON" }
    } catch {
      return { ok: false, label: "JSON needs valid syntax" }
    }
  }, [form.uploadedJsonPreview])
  const uploadedJsonLabel =
    form.uploadedJsonName ||
    (parsedJsonStatus.ok ? "pasted-components.json" : "No file chosen")
  const parsedJsonDetails = useMemo(() => {
    try {
      const parsed = JSON.parse(form.uploadedJsonPreview) as {
        product?: unknown
        components?: unknown
      }
      const product =
        typeof parsed.product === "string" ? parsed.product : "Unnamed product"
      const componentCount = Array.isArray(parsed.components)
        ? parsed.components.length
        : 0

      return {
        ok: true,
        product,
        componentCount,
      }
    } catch {
      return {
        ok: false,
        product: "Unable to detect product",
        componentCount: 0,
      }
    }
  }, [form.uploadedJsonPreview])
  const sourceSummaryLabel =
    form.inputMode === "file"
      ? `File upload${parsedJsonDetails.ok ? " · auto-detected" : ""}`
      : "Manual description"

  function updateForm<K extends keyof OnboardingState>(
    key: K,
    value: OnboardingState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function togglePreference(option: string) {
    setForm((current) => {
      const nextPreferences = current.preferences.includes(option)
        ? current.preferences.filter((item) => item !== option)
        : [...current.preferences, option]

      return { ...current, preferences: nextPreferences }
    })
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : ""

      setForm((current) => ({
        ...current,
        inputMode: "file",
        uploadedJsonName: file.name,
        uploadedJsonPreview: text,
      }))
    }

    reader.readAsText(file)
  }

  function goToStep(index: number) {
    if (index === currentStep) return

    setDirection(index > currentStep ? 1 : -1)
    setCurrentStep(index)
  }

  function goNext() {
    if (currentStep === STEPS.length - 1) {
      startTransition(() => {
        setIsComplete(true)
      })

      return
    }

    setDirection(1)
    setCurrentStep((value) => Math.min(value + 1, STEPS.length - 1))
  }

  function goBack() {
    setDirection(-1)
    setCurrentStep((value) => Math.max(value - 1, 0))
  }

  function restartOnboarding() {
    startTransition(() => {
      setDirection(-1)
      setCurrentStep(0)
      setForm(initialState)
      setIsComplete(false)
    })
  }

  if (isComplete) {
    return (
      <DashboardShell
        data={supplyChainSnapshot}
        onRestartOnboarding={restartOnboarding}
      />
    )
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-noise" />
      <motion.div
        className="onboarding-orb onboarding-orb-a"
        animate={{ x: [0, 24, -18, 0], y: [0, -18, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="onboarding-orb onboarding-orb-b"
        animate={{ x: [0, -20, 12, 0], y: [0, 18, -14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="onboarding-rail panel-grid flex flex-col justify-between p-6 lg:p-8">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="eyebrow">GreenChain Demo Intake</div>
              <div className="space-y-2">
                <h1 className="max-w-[12ch] text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Build the story before the dashboard opens.
                </h1>
                <p className="max-w-[28ch] text-sm leading-6 text-white/62">
                  A short setup flow to capture the context, the product, and
                  the signals the demo should emphasize.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = index === currentStep
                const isDone = index < currentStep

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(index)}
                    className="group flex w-full items-center gap-3 rounded-[1.4rem] border border-transparent px-3 py-3 text-left transition hover:border-white/10 hover:bg-white/4"
                  >
                    <div
                      className={[
                        "flex size-10 items-center justify-center rounded-full border text-sm transition",
                        isActive
                          ? "border-white/25 bg-white text-black"
                          : isDone
                            ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100"
                            : "border-white/12 bg-white/4 text-white/70",
                      ].join(" ")}
                    >
                      {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.65rem] tracking-[0.28em] text-white/40 uppercase">
                        {step.label}
                      </div>
                      <div
                        className={[
                          "truncate text-sm transition",
                          isActive ? "text-white" : "text-white/65",
                        ].join(" ")}
                      >
                        {step.title}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/38">
              <span>Progress</span>
              <span>{Math.round(completion)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full bg-white"
                animate={{ width: `${completion}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 border-t border-white/8 sm:border-t-0 lg:border-x lg:border-white/8">
          <div className="relative flex min-h-[70svh] flex-col justify-between p-6 sm:p-8 lg:min-h-svh lg:p-12 xl:p-16">
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="eyebrow text-white/45">{activeStep.label}</div>
                    <h2 className="mt-2 max-w-[14ch] text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
                      {activeStep.title}
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
                    Step {currentStep + 1} of {STEPS.length}
                  </div>
                </div>

                <p className="max-w-[56ch] text-base leading-7 text-white/62">
                  {activeStep.description}
                </p>

                <div className="relative min-h-[27rem]">
                  <AnimatePresence custom={direction} mode="wait">
                    <motion.div
                      key={activeStep.id}
                      custom={direction}
                      variants={panelVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        duration: 0.38,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="absolute inset-0"
                    >
                      {activeStep.id === "location" ? (
                        <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                          <div className="space-y-5">
                            <div className="space-y-2">
                              <label
                                htmlFor="location"
                                className="text-sm font-medium text-white"
                              >
                                Location
                              </label>
                              <Input
                                id="location"
                                value={form.location}
                                onChange={(event) =>
                                  updateForm("location", event.target.value)
                                }
                                placeholder="Brooklyn Navy Yard, New York"
                                className="h-14 rounded-[1.25rem] border-white/10 bg-white/6 px-5 text-white placeholder:text-white/30"
                              />
                            </div>
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/16 p-5">
                              <div className="text-sm font-medium text-white">
                                Suggested inputs
                              </div>
                              <div className="mt-4 flex flex-wrap gap-3">
                                {[
                                  "Austin, Texas",
                                  "Rotterdam, Netherlands",
                                  "Shenzhen, China",
                                ].map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => updateForm("location", option)}
                                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/72 transition hover:border-white/25 hover:bg-white/8 hover:text-white"
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
                            <MapPin className="size-6 text-white/70" />
                            <div>
                              <div className="text-sm text-white/50">
                                Current anchor
                              </div>
                              <div className="mt-2 text-lg text-white">
                                {form.location || "No location selected yet"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {activeStep.id === "product" ? (
                        <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                          <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => updateForm("inputMode", "file")}
                                className={[
                                  "rounded-[1.5rem] border p-5 text-left transition",
                                  form.inputMode === "file"
                                    ? "border-white/24 bg-white/10"
                                    : "border-white/10 bg-white/4 hover:border-white/18 hover:bg-white/7",
                                ].join(" ")}
                              >
                                <div className="text-sm font-medium text-white">
                                  Upload JSON
                                </div>
                                <div className="mt-2 text-sm leading-6 text-white/55">
                                  Auto-detect the product name and component
                                  structure from a product JSON file.
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => updateForm("inputMode", "manual")}
                                className={[
                                  "rounded-[1.5rem] border p-5 text-left transition",
                                  form.inputMode === "manual"
                                    ? "border-white/24 bg-white/10"
                                    : "border-white/10 bg-white/4 hover:border-white/18 hover:bg-white/7",
                                ].join(" ")}
                              >
                                <div className="text-sm font-medium text-white">
                                  Manual description
                                </div>
                                <div className="mt-2 text-sm leading-6 text-white/55">
                                  Describe the product, important components,
                                  and sourcing context in plain language.
                                </div>
                              </button>
                            </div>

                            {form.inputMode === "file" ? (
                              <div className="space-y-5">
                                <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
                                  <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-white/8 p-3 text-white">
                                      <Upload className="size-5" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-white">
                                        Product JSON file
                                      </div>
                                      <div className="text-sm text-white/50">
                                        Upload `.json` and the flow will infer
                                        the product and component structure.
                                      </div>
                                    </div>
                                  </div>

                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/json,.json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                  />

                                  <div className="mt-5 flex flex-wrap gap-3">
                                    <Button
                                      type="button"
                                      size="lg"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="h-12 rounded-full px-5"
                                    >
                                      Choose file
                                    </Button>
                                    <Button
                                      type="button"
                                      size="lg"
                                      variant="outline"
                                      onClick={() =>
                                        setForm((current) => ({
                                          ...current,
                                          inputMode: "file",
                                          uploadedJsonName:
                                            "sample-components.json",
                                          uploadedJsonPreview:
                                            DEFAULT_JSON_PREVIEW,
                                        }))
                                      }
                                      className="h-12 rounded-full border-white/14 bg-white/4 px-5 text-white hover:bg-white/8"
                                    >
                                      Use sample
                                    </Button>
                                  </div>
                                </div>

                                <div className="rounded-[1.5rem] border border-white/10 bg-black/16 p-5">
                                  <div className="text-sm text-white/48">Detected file</div>
                                  <div className="mt-2 text-white">
                                    {uploadedJsonLabel}
                                  </div>
                                  <div className="mt-3 text-sm leading-6 text-white/60">
                                    {parsedJsonDetails.ok
                                      ? `${parsedJsonDetails.product} · ${parsedJsonDetails.componentCount} components detected`
                                      : "Upload a valid JSON file to enable auto-detection."}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-5">
                                <div className="space-y-2">
                                  <label
                                    htmlFor="productName"
                                    className="text-sm font-medium text-white"
                                  >
                                    Product name
                                  </label>
                                  <Input
                                    id="productName"
                                    value={form.productName}
                                    onChange={(event) =>
                                      updateForm("productName", event.target.value)
                                    }
                                    placeholder="Portable EV Charger"
                                    className="h-14 rounded-[1.25rem] border-white/10 bg-white/6 px-5 text-white placeholder:text-white/30"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label
                                    htmlFor="manualDescription"
                                    className="text-sm font-medium text-white"
                                  >
                                    Manual product description
                                  </label>
                                  <Textarea
                                    id="manualDescription"
                                    value={form.manualDescription}
                                    onChange={(event) =>
                                      updateForm(
                                        "manualDescription",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Portable EV charger with battery module, control board, enclosure, and thermal sensor. Main concern is supplier concentration around the control board..."
                                    className="min-h-[16rem] rounded-[1.5rem] border-white/10 bg-white/6 p-5 text-white placeholder:text-white/30"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="rounded-[1.5rem] border border-white/10 bg-black/16 p-5">
                            <div className="text-sm font-medium text-white">
                              Intake mode
                            </div>
                            <div className="mt-4 space-y-4 text-sm leading-7 text-white/62">
                              <p>
                                Pick one source. JSON upload is best when you
                                already have structured product data. Manual
                                description is better for a quick live setup.
                              </p>
                              <p>
                                The next step adapts automatically: file mode
                                shows detected JSON, manual mode shows the
                                written description the demo will use.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {activeStep.id === "upload" ? (
                        <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
                          <div className="space-y-5">
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/16 p-5">
                              <div className="text-sm text-white/48">Source</div>
                              <div className="mt-2 text-white">
                                {sourceSummaryLabel}
                              </div>
                              {form.inputMode === "file" ? (
                                <div
                                  className={[
                                    "mt-3 inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em]",
                                    parsedJsonStatus.ok
                                      ? "bg-emerald-300/10 text-emerald-100"
                                      : "bg-amber-300/10 text-amber-100",
                                  ].join(" ")}
                                >
                                  {parsedJsonStatus.label}
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-[1.5rem] border border-white/10 bg-black/16 p-5">
                              <div className="text-sm font-medium text-white">
                                What the demo will use
                              </div>
                              <div className="mt-4 text-sm leading-7 text-white/62">
                                {form.inputMode === "file" ? (
                                  <>
                                    <p>{uploadedJsonLabel}</p>
                                    <p>
                                      {parsedJsonDetails.ok
                                        ? `${parsedJsonDetails.product} with ${parsedJsonDetails.componentCount} detected components.`
                                        : "JSON parsing failed, so auto-detection is currently unavailable."}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p>{form.productName || "Unnamed product"}</p>
                                    <p>
                                      {form.manualDescription.trim()
                                        ? `${form.manualDescription.trim().split(/\s+/).length} words of manual context captured.`
                                        : "No manual context entered yet."}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={
                                form.inputMode === "file"
                                  ? "jsonPreview"
                                  : "manualPreview"
                              }
                              className="text-sm font-medium text-white"
                            >
                              {form.inputMode === "file"
                                ? "Detected JSON preview"
                                : "Manual description preview"}
                            </label>
                            {form.inputMode === "file" ? (
                              <Textarea
                                id="jsonPreview"
                                value={form.uploadedJsonPreview}
                                onChange={(event) =>
                                  updateForm("uploadedJsonPreview", event.target.value)
                                }
                                spellCheck={false}
                                className="min-h-[24rem] rounded-[1.5rem] border-white/10 bg-[#07111d]/92 p-5 font-mono text-[0.86rem] leading-6 text-[#d8ecff] placeholder:text-[#8cb6d7]/45"
                              />
                            ) : (
                              <Textarea
                                id="manualPreview"
                                value={form.manualDescription}
                                onChange={(event) =>
                                  updateForm("manualDescription", event.target.value)
                                }
                                className="min-h-[24rem] rounded-[1.5rem] border-white/10 bg-white/6 p-5 text-white placeholder:text-white/30"
                                placeholder="Describe the product and components here..."
                              />
                            )}
                          </div>
                        </div>
                      ) : null}

                      {activeStep.id === "preferences" ? (
                        <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                          <div className="space-y-4">
                            <div className="text-sm font-medium text-white">
                              Dashboard priorities
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {PREFERENCE_OPTIONS.map((option) => {
                                const isSelected = form.preferences.includes(option)

                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => togglePreference(option)}
                                    className={[
                                      "rounded-full border px-4 py-2 text-sm transition",
                                      isSelected
                                        ? "border-white bg-white text-black"
                                        : "border-white/12 bg-white/4 text-white/70 hover:border-white/24 hover:bg-white/8 hover:text-white",
                                    ].join(" ")}
                                  >
                                    {option}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor="notes"
                              className="text-sm font-medium text-white"
                            >
                              Preferences and demo notes
                            </label>
                            <Textarea
                              id="notes"
                              value={form.notes}
                              onChange={(event) =>
                                updateForm("notes", event.target.value)
                              }
                              placeholder="Emphasize supplier concentration, call out recycled material usage, keep the story concise for live demo..."
                              className="min-h-[20rem] rounded-[1.5rem] border-white/10 bg-white/6 p-5 text-white placeholder:text-white/30"
                            />
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={goBack}
                  disabled={currentStep === 0}
                  className="h-12 rounded-full px-5 text-white hover:bg-white/8 hover:text-white disabled:text-white/25"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>

                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  className="h-12 rounded-full px-5"
                >
                  {currentStep === STEPS.length - 1 ? "Launch dashboard" : "Continue"}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
          </div>
        </section>

        <aside className="onboarding-summary p-6 sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div>
              <div className="eyebrow text-white/38">Live Summary</div>
              <h3 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-white">
                Intake snapshot
              </h3>
            </div>

            <div className="space-y-4 text-sm leading-7">
              <SummaryRow
                label="Location"
                value={form.location || "Not set"}
              />
              <SummaryRow
                label="Product"
                value={
                  form.inputMode === "file"
                    ? parsedJsonDetails.product
                    : form.productName || "Not set"
                }
              />
              <SummaryRow
                label="Source"
                value={
                  form.inputMode === "file"
                    ? uploadedJsonLabel
                    : "Manual description"
                }
              />
              <SummaryRow
                label="Product data"
                value={
                  form.inputMode === "file"
                    ? parsedJsonDetails.ok
                      ? `${parsedJsonDetails.componentCount} components detected`
                      : "Detection unavailable"
                    : form.manualDescription.trim()
                      ? `${form.manualDescription.trim().split(/\s+/).length} words captured`
                      : "No manual description yet"
                }
              />
              <SummaryRow
                label="Preferences"
                value={
                  form.preferences.length > 0
                    ? `${form.preferences.length} selected`
                    : "No priorities selected"
                }
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/8 pb-4">
      <div className="text-[0.68rem] tracking-[0.28em] text-white/34 uppercase">
        {label}
      </div>
      <div className="mt-1 text-white/76">{value}</div>
    </div>
  )
}
