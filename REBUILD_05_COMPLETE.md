# REBUILD_05 — Store, API, Types, UI Primitives, Upload Components & Deployment

## Overview
This file contains the Zustand store, API client, TypeScript types, utilities,
UI primitive components, and upload section components.

---

## frontend/src/store/assessmentStore.ts

```ts
import { create } from 'zustand'
import type { AppScreen, AssessmentResults, ConfigureState, UploadResult } from '@/lib/types'

export type AiContext = 'kpi_overview' | 'rca' | 'offerings'

interface AssessmentState {
  sessionId: string | null
  currentScreen: AppScreen
  skillPath: string | null
  skillName: string | null
  isProcurement: boolean
  clientName: string
  uploadResult: UploadResult | null
  configureState: ConfigureState | null
  results: AssessmentResults | null
  llmApiKey: string
  // AI insights cache — keyed by context, persisted across tab switches within session
  aiInsights: Partial<Record<AiContext, any>>
  aiLoading: Partial<Record<AiContext, boolean>>
  aiError: Partial<Record<AiContext, string>>

  setSessionId: (id: string) => void
  setScreen: (screen: AppScreen) => void
  setSkill: (path: string, name: string, isProcurement: boolean) => void
  setClientName: (name: string) => void
  setUploadResult: (r: UploadResult) => void
  setConfigureState: (c: ConfigureState) => void
  setResults: (r: AssessmentResults) => void
  setLlmApiKey: (key: string) => void
  setAiInsight: (ctx: AiContext, data: any) => void
  setAiLoading: (ctx: AiContext, loading: boolean) => void
  setAiError: (ctx: AiContext, error: string) => void
  clearAiCache: () => void
  reset: () => void
}

const STORAGE_KEY = 'acc_assessment_session'

export const useAssessmentStore = create<AssessmentState>((set) => ({
  sessionId: localStorage.getItem(STORAGE_KEY),
  currentScreen: 'setup',
  skillPath: null,
  skillName: null,
  isProcurement: false,
  clientName: '',
  uploadResult: null,
  configureState: null,
  results: null,
  llmApiKey: '',
  aiInsights: {},
  aiLoading: {},
  aiError: {},

  setSessionId: (id) => {
    localStorage.setItem(STORAGE_KEY, id)
    set({ sessionId: id })
  },
  setScreen: (screen) => set({ currentScreen: screen }),
  setSkill: (path, name, isProcurement) => set({ skillPath: path, skillName: name, isProcurement }),
  setClientName: (name) => set({ clientName: name }),
  setUploadResult: (r) => set({ uploadResult: r }),
  setConfigureState: (c) => set({ configureState: c }),
  setResults: (r) => set({ results: r }),
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setAiInsight: (ctx, data) => set((s) => ({ aiInsights: { ...s.aiInsights, [ctx]: data } })),
  setAiLoading: (ctx, loading) => set((s) => ({ aiLoading: { ...s.aiLoading, [ctx]: loading } })),
  setAiError: (ctx, error) => set((s) => ({ aiError: { ...s.aiError, [ctx]: error } })),
  clearAiCache: () => set({ aiInsights: {}, aiLoading: {}, aiError: {} }),
  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({
      sessionId: null,
      currentScreen: 'setup',
      skillPath: null,
      skillName: null,
      isProcurement: false,
      clientName: '',
      uploadResult: null,
      configureState: null,
      results: null,
      aiInsights: {},
      aiLoading: {},
      aiError: {},
    })
  },
}))

// Dev helper — expose store globally so preview tools can navigate screens
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__store = useAssessmentStore
}
```

---

## frontend/src/lib/types.ts

```ts
// ── Skill ─────────────────────────────────────────────────────────────────────
export interface KpiMeta {
  label: string
  weight: number
  direction: 'lower_is_better' | 'higher_is_better'
  unit: string
  bucket: string
}

export interface SkillSummary {
  function_name: string
  display_name: string
  path: string
  schema_version: string
  dimension_count: number
  column_alias_count: number
  is_procurement: boolean
  source_file: string | null
  kpi_meta?: Record<string, KpiMeta>
  buckets?: Record<string, string[]>
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export interface Engagement {
  client_name: string
  industry: string
  assessment_type: string
  date: string
  assessor_name: string
  notes: string
  fte_count: number | null
  annual_spend: number | null
  annual_revenue: number | null
}

// ── Upload ────────────────────────────────────────────────────────────────────
export interface FileResult {
  rows: number
  columns: number
  ok: boolean
  error?: string
}

export interface UploadResult {
  files: Record<string, FileResult | null>
  coverage: Record<string, string>
  next_screen: 'column_review' | 'configure'
  needs_column_review: boolean
}

// ── Column Review ─────────────────────────────────────────────────────────────
export interface ColumnSuggestion {
  suggested: string
  confidence: number
}

export interface ColumnResolutionState {
  resolved: Record<string, string>
  suggestions: Record<string, ColumnSuggestion>
  unmatched: string[]
  available_columns: string[]
  skill_aliases: Record<string, string>
}

// ── Configure ─────────────────────────────────────────────────────────────────
export interface DimensionSummary {
  dim_id: string
  name: string
  weight: number
  kpi_count: number
  default_weight: number
}

export interface ConfigureState {
  is_procurement: boolean
  dimensions: DimensionSummary[]
  engagement: { fte_count: number | null; annual_spend: number | null; industry: string }
  kpi_meta?: Record<string, KpiMeta>
  buckets?: Record<string, string[]>
  bucket_icons?: Record<string, string>
  data_ready?: Record<string, boolean>
  benchmarks_display?: Record<string, string>
}

// ── Run ───────────────────────────────────────────────────────────────────────
export interface ProgressEvent {
  step?: number
  total?: number
  message?: string
  pct?: number
  status?: 'done' | 'error'
  detail?: string
}

// ── Results ───────────────────────────────────────────────────────────────────
export interface KPIScoreResult {
  kpi_id: string
  label: string
  value: number | null
  unit: string
  score: number | null
  status: string
  direction: string
  thresholds: Record<string, string>
  benchmarks: Record<string, string>
  reason: string
}

export interface DimensionResult {
  dim_id: string
  name: string
  score: number | null
  score_display: number | null
  level: string | null
  weight: number
  weighted_score: number | null
  kpi_scores: Record<string, KPIScoreResult>
  status: string
  data_sufficiency: string
  evidence: string[]
  gaps: string[]
  recommended_actions: Record<string, string[]>
  rationale: string
  target_state: Record<string, string>
}

export interface OverallResult {
  score: number | null
  level: string | null
  scored_dims: number
  total_dims: number
  active_weight_pct: number
  metadata: Record<string, unknown>
}

export interface KPIResult {
  kpi_id: string
  label: string
  bucket: string
  weight: number
  direction: string
  unit: string
  actual: number | null
  benchmark: number | null
  score: number
  score_label: string
  gap_pct: number | null
  formatted_actual: string
  formatted_benchmark: string
  colour: string
  has_gap: boolean
  data_source: string
  insight: string
  action: string
  benefit: string
}

export interface BucketResult {
  bucket: string
  icon: string
  score: number | null
  score_label: string
  kpis: KPIResult[]
}

export interface KPIAssessmentResult {
  overall_score: number | null
  overall_label: string
  computed_kpis: string[]
  unavailable_kpis: string[]
  benchmarks: Record<string, number>
  engagement: Record<string, unknown>
  kpi_results: Record<string, KPIResult>
  bucket_results: Record<string, BucketResult>
}

export interface AssessmentResults {
  engagement: Engagement
  overall: OverallResult
  dimension_results: DimensionResult[]
  kpi_assessment: KPIAssessmentResult | null
}

export interface InsightCard {
  category: string
  title: string
  finding: string
  action: string
  severity: 'high' | 'medium' | 'low'
  data: Record<string, unknown>
}

export interface DiagnosticSummary {
  context_paragraph: string
  overall_score: number | null
  maturity_level: string
  weak_dims: Array<{ dim_id: string; name: string; score: number | null }>
  offerings: Array<{ name: string; description: string; relevant_dims: string[]; triggered_by: string[] }>
}

export interface SalientInsight {
  type: 'plant' | 'category'
  severity: 'critical' | 'warning'
  label: string
  text: string
  kpis: string[]
}

export interface OrgSignal {
  type: string
  text: string
  vote: string
}

export interface OrgRecommendation {
  recommended: string
  rationale: string
  signals: OrgSignal[]
  suggested_fte: number
  spend_per_fte: number | null
  plant_count: number
  rc_pct: number | null
}

export interface ValueTreeData {
  rc_pct: number
  asl_pct: number
  rfq_pct: number
  tat_rc: number | null
  tat_asl: number | null
  tat_rfq: number | null
  asis_weighted_tat: number | null
  source: string
}

export interface CategoryChannel {
  category: string
  spend: number
  spend_share_pct: number
  order_freq_months: number
  rc_exists: boolean
  current_channel?: string
  channel: string
  tat: number
  channel_color: 'green' | 'blue' | 'orange'
}

// ── Buying Channel Module ─────────────────────────────────────────────────────
export interface BuyingChannelRow {
  mg_code: string
  mg_desc: string
  archetype: 'BULK' | 'DIRECT' | 'INDIRECT' | 'CAPEX' | 'SERVICE' | 'UNCLASSIFIED'
  current_channel: string
  rec_channel: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  spend: number
  spend_share_pct: number
  po_count: number
  vendor_count: number
  pac_pct: number
  as_is_tat: number | null
  to_be_tat: number | null
  flag: string | null
  signal: string
}

export interface BuyingChannelSlider {
  asis_tat: number
  rc_tat: number
  asl_tat: number
  rfq_tat: number
  asis_rc_pct: number
  asis_asl_pct: number
  asis_rfq_pct: number
  tobe_rc_pct: number
  tobe_asl_pct: number
  tobe_rfq_pct: number
  tat_source: 'computed' | 'benchmark'
}

export interface BuyingChannelData {
  mg_rows: BuyingChannelRow[]
  slider: BuyingChannelSlider
  source: string
  total_mgs: number
  classified_pct: number
}

// ── Session State (Zustand) ───────────────────────────────────────────────────
export type AppScreen = 'setup' | 'upload' | 'columns' | 'configure' | 'running' | 'formula-review' | 'results'
```

---

## frontend/src/lib/utils.ts

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreColor(score: number | null): string {
  if (score === null) return '#96968c'
  if (score >= 3.5) return '#2E7D32'
  if (score >= 2.5) return '#1565C0'
  if (score >= 1.5) return '#E65100'
  return '#C62828'
}

export function scoreBg(score: number | null): string {
  if (score === null) return 'bg-bg-muted text-caption'
  if (score >= 3.5) return 'bg-green-100 text-green-800'
  if (score >= 2.5) return 'bg-blue-100 text-blue-800'
  if (score >= 1.5) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function formatScore(score: number | null): string {
  // Whole-number scores (no decimals) — Math.round rounds .5+ up, .49- down.
  return score !== null && !Number.isNaN(score) ? String(Math.round(score)) : '—'
}

// ── Number / currency formatting ─────────────────────────────────────────────
// User-wide rule: never show decimals. Math.round goes UP at >= 0.5, DOWN below.

/** Round any numeric value to a whole number string. Returns '—' for null/NaN. */
export function roundN(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(Math.round(value))
}

/** Indian-style numeric formatting: 12,34,567 not 1,234,567. */
const _INR_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Format an integer with Indian commas. */
export function formatIndianInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return _INR_FMT.format(Math.round(value))
}

/** Format a percentage as a whole number with the % sign. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value)}%`
}

/**
 * Format ₹ values in short form. Indian convention: Cr (crore = 10M) is the
 * default. Below 1 Cr we drop to L (lakh = 100K). Always whole numbers, with
 * Indian-style commas (12,34,567 not 1,234,567).
 *   1.4 Cr      → "₹1 Cr"
 *   187.4       → "₹187 Cr"
 *   1234.5      → "₹1,234 Cr"
 *   12345       → "₹12,345 Cr"
 *   1234567     → "₹12,34,567 Cr"
 *   0.62        → "₹62 L"
 *   0.05        → "₹5 L"
 *   0.001       → "< ₹1 L"
 */
export function formatCr(valueCr: number | null | undefined): string {
  if (valueCr === null || valueCr === undefined || Number.isNaN(valueCr)) return '—'
  const v = Number(valueCr)
  if (v >= 1) return `₹${formatIndianInt(v)} Cr`
  const lakhs = v * 100
  if (lakhs >= 1) return `₹${formatIndianInt(lakhs)} L`
  return '< ₹1 L'
}

/** Format a numeric range "X–Y" with the given formatter. */
export function formatRange(
  low: number | null | undefined,
  high: number | null | undefined,
  formatter: (v: number) => string,
): string {
  if (low == null || high == null) return '—'
  const a = formatter(low)
  const b = formatter(high)
  return a === b ? a : `${a}–${b}`
}

export function severityColor(severity: string): string {
  if (severity === 'high') return 'text-red-600'
  if (severity === 'medium') return 'text-orange-500'
  return 'text-blue-600'
}
```

---

## frontend/src/lib/api.ts

```ts
import type {
  SkillSummary, UploadResult, ColumnResolutionState,
  ConfigureState, AssessmentResults, InsightCard,
  DiagnosticSummary, Engagement, OrgRecommendation,
  ValueTreeData, CategoryChannel, BuyingChannelData
} from './types'

const BASE = '/api/v1'

function sessionId(): string {
  return localStorage.getItem('acc_assessment_session') || ''
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Session ───────────────────────────────────────────────────────────────────
export const api = {
  createSession: () => req<{ session_id: string }>('/session', { method: 'POST', body: '{}' }),
  deleteSession: (sid: string) => req(`/session/${sid}`, { method: 'DELETE' }),

  // ── Skills ────────────────────────────────────────────────────────────────
  getSkills: () => req<SkillSummary[]>('/skills'),

  // ── Setup ─────────────────────────────────────────────────────────────────
  setup: (sid: string, payload: Partial<Engagement> & { skill_path: string }) =>
    req(`/session/${sid}/setup`, { method: 'POST', body: JSON.stringify(payload) }),

  // ── Upload ────────────────────────────────────────────────────────────────
  // Inspect uploaded files (pre-upload classification + sheet listing)
  inspectFiles: (files: File[]): Promise<{
    files: {
      filename: string
      size_kb?: number
      error?: string
      sheets: {
        name: string
        columns?: string[]
        row_count_sample?: number
        suggested_slot: string
        confidence: 'high' | 'medium' | 'low'
        reasoning?: string
        error?: string
      }[]
    }[]
  }> => {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    return fetch(`${BASE}/files/inspect`, { method: 'POST', body: form })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
          throw new Error(err.detail || 'Inspect failed')
        }
        return r.json()
      })
  },

  uploadFiles: (
    sid: string,
    files: Record<string, File | null>,
    onProgress?: (pct: number) => void,
    sheets: Record<string, string | null> = {},
  ): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      for (const [key, file] of Object.entries(files)) {
        if (file) form.append(key, file)
      }
      // Per-slot sheet selectors — only sent for keys where the user picked a sheet
      for (const [key, sheet] of Object.entries(sheets)) {
        if (sheet) {
          // Convert "po_file" → "po_sheet", "pr_file" → "pr_sheet", etc.
          const sheetKey = key.replace(/_file$/, '_sheet')
          form.append(sheetKey, sheet)
        }
      }
      const xhr = new XMLHttpRequest()
      // Upload progress fires during the actual transfer (0→95%); server processing is 95→100%
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 95))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            if (onProgress) onProgress(100)
            resolve(JSON.parse(xhr.responseText) as UploadResult)
          } catch {
            reject(new Error('Invalid JSON response'))
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            reject(new Error(err.detail || `HTTP ${xhr.status}`))
          } catch {
            reject(new Error(`HTTP ${xhr.status}`))
          }
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed — check your network connection'))
      xhr.ontimeout = () => reject(new Error('Upload timed out'))
      xhr.open('POST', `${BASE}/session/${sid}/upload`)
      xhr.send(form)
    })
  },

  parseTextQre: (sid: string, text: string) =>
    req(`/session/${sid}/parse-text-qre`, { method: 'POST', body: JSON.stringify({ text }) }),

  confirmTextQre: (sid: string, confirmed: Record<string, number>) =>
    req(`/session/${sid}/confirm-text-qre`, { method: 'POST', body: JSON.stringify({ confirmed }) }),

  // ── Click-to-answer questionnaire ─────────────────────────────────────────
  // Returns the question bank embedded in the skill file (D5/D10 in procurement.md)
  getQuestionnaire: (skillPath: string): Promise<{
    questionnaire: {
      dimension_id: string
      title: string
      description: string
      weight_pct: number
      questions: {
        code: string
        text: string
        options: { score: 1 | 2 | 3 | 4; label: string }[]
      }[]
    }[]
  }> => req(`/skills/questionnaire?skill_path=${encodeURIComponent(skillPath)}`),

  // Save per-question evidence (used by AI prompt context)
  saveQuestionnaireDetail: (sid: string, answers: Record<string, Record<string, number>>) =>
    req(`/session/${sid}/questionnaire-detail`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  // ── Column Review ─────────────────────────────────────────────────────────
  getColumns: (sid: string) => req<ColumnResolutionState>(`/session/${sid}/columns`),
  confirmColumns: (sid: string, confirmed: Record<string, string>, unavailable: string[]) =>
    req(`/session/${sid}/columns/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed, unavailable }),
    }),

  // ── Configure ─────────────────────────────────────────────────────────────
  getConfigure: (sid: string) => req<ConfigureState>(`/session/${sid}/configure`),
  saveConfigure: (
    sid: string,
    weight_config: Record<string, number>,
    include_dims: Record<string, boolean>,
    kpi_weight_config?: Record<string, number>,
  ) =>
    req(`/session/${sid}/configure`, {
      method: 'POST',
      body: JSON.stringify({ weight_config, include_dims, kpi_weight_config: kpi_weight_config ?? {} }),
    }),

  // ── Run ───────────────────────────────────────────────────────────────────
  triggerRun: (sid: string, llmKey?: string) =>
    req(`/session/${sid}/run`, {
      method: 'POST',
      body: JSON.stringify({ llm_api_key: llmKey || null }),
    }),

  // SSE URL (used directly with fetch-event-source)
  runStatusUrl: (sid: string) => `${BASE}/session/${sid}/run-status`,

  // ── Results ───────────────────────────────────────────────────────────────
  getResults: (sid: string) => req<AssessmentResults>(`/session/${sid}/results`),
  getInsights: (sid: string) => req<{ insights: InsightCard[] }>(`/session/${sid}/results/insights`),
  getDiagnostic: (sid: string) => req<DiagnosticSummary>(`/session/${sid}/results/diagnostic`),
  getOrganogram: (sid: string, model: string, fte: number) =>
    req<{ html: string }>(`/session/${sid}/results/organogram?model=${encodeURIComponent(model)}&fte=${fte}`),
  getSwimlane: (sid: string, kpiGaps: string[]) =>
    req<{ html: string }>(`/session/${sid}/results/swimlane?kpi_gaps=${kpiGaps.join(',')}`),
  getDownloadUrl: (sid: string) => `${BASE}/session/${sid}/download`,
  getProcessDesign: (sid: string) => req<{ phases: any[]; source: string }>(`/session/${sid}/results/process-design`),
  getProcessDesignL5: (sid: string) => req<{ phases: any[]; source: string }>(`/session/${sid}/results/process-design`),
  getSwimlaneInteractive: (sid: string) => req<{ html: string }>(`/session/${sid}/results/swimlane-interactive`),
  getSalientInsights: (sid: string) => req<{ insights: any[] }>(`/session/${sid}/results/kpi-dashboard/salient-insights`),
  getOrgRecommendation: (sid: string) => req<OrgRecommendation>(`/session/${sid}/results/org-recommendation`),
  getValueTree: (sid: string) => req<ValueTreeData>(`/session/${sid}/results/value-tree`),
  getCategoryChannels: (sid: string) => req<{ categories: CategoryChannel[]; source: string }>(`/session/${sid}/results/category-channels`),
  getBuyingChannel: (sid: string) => req<BuyingChannelData>(`/session/${sid}/results/buying-channel`),
  debugKpiTrace: (sid: string) => req<any>(`/session/${sid}/debug/kpi-trace`),
}
```

---

## frontend/src/components/ui/Skeleton.tsx

```tsx
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export default function Skeleton({ className }: Props) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-bg-secondary/70',
        className,
      )}
    />
  )
}
```

---

## frontend/src/components/ui/EmptyState.tsx

```tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  Icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('text-center py-10 px-4', className)}>
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-full bg-bg-secondary/60 flex items-center justify-center mb-3">
          <Icon size={22} className="text-brand-purple" />
        </div>
      )}
      <p className="text-sm font-semibold text-brand-dark mb-1">{title}</p>
      {description && <p className="text-xs text-caption max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

---

## frontend/src/components/ui/ScoreGauge.tsx

```tsx
import { useEffect, useState } from 'react'

interface Props {
  score: number
  size?: number
  variant?: 'on-dark' | 'on-light'
}

export default function ScoreGauge({ score, size = 96, variant = 'on-dark' }: Props) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const duration = 900
    const target = Math.min(Math.max(score, 0), 4)

    const step = (ts: number) => {
      if (!start) start = ts
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimated(target * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const strokeW = size * 0.09

  const totalAngle = 270
  const startAngle = 135
  const fraction = animated / 4

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const arcPoint = (angleDeg: number) => ({
    x: cx + r * Math.cos(toRad(angleDeg)),
    y: cy + r * Math.sin(toRad(angleDeg)),
  })

  const describeArc = (startDeg: number, endDeg: number) => {
    const s = arcPoint(startDeg)
    const e = arcPoint(endDeg)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  const trackEnd = startAngle + totalAngle
  const fillEnd = startAngle + totalAngle * fraction

  const trackStroke = variant === 'on-dark' ? 'rgba(255,255,255,0.20)' : 'rgba(70,0,115,0.12)'
  const fillStroke  = variant === 'on-dark' ? 'rgba(255,255,255,0.90)' : '#a100ff'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <path
        d={describeArc(startAngle, trackEnd)}
        fill="none"
        stroke={trackStroke}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {fraction > 0.01 && (
        <path
          d={describeArc(startAngle, fillEnd)}
          fill="none"
          stroke={fillStroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
```

---

## frontend/src/components/ui/AnimatedCounter.tsx

```tsx
import { useEffect, useRef, useState } from 'react'

interface Props {
  target: number | null
  duration?: number
  decimals?: number
  className?: string
}

export default function AnimatedCounter({ target, duration = 1200, decimals = 0, className }: Props) {
  const [display, setDisplay] = useState('—')
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === null) { setDisplay('—'); return }
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay((target * eased).toFixed(decimals))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, decimals])

  return <span className={className}>{display}</span>
}
```

---

## frontend/src/components/ui/AccentureMark.tsx

```tsx
/**
 * AccentureMark — official Accenture "Greater Than" (>) symbol.
 * Path extracted from the brand-kit SVG (Acc_GT_Solid_P1_RGB.svg).
 * Renders as an icon; colour is inherited via `currentColor`.
 */
interface Props {
  className?: string
  title?: string
}

export default function AccentureMark({ className, title }: Props) {
  return (
    <svg
      viewBox="0 0 328.0399 360"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={title ?? 'Accenture'}
    >
      <polygon points="0,360 328.0399,226.9993 328.0399,133.0008 0,0 0,93.9987 212.1184,180 0,266.0013" />
    </svg>
  )
}
```

---

## frontend/src/components/ui/AccentureLogo.tsx

```tsx
/**
 * AccentureLogo — full "> accenture" wordmark from the official brand kit
 * (Acc_Logo_Black_Purple_RGB.svg). The ">" is brand-purple (#a100ff); the
 * "accenture" wordmark inherits `currentColor` so it can flip on dark/light.
 */
interface Props {
  className?: string
  /** Color of the wordmark (inherits currentColor by default). GT is always brand-purple. */
}

export default function AccentureLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 163.2 43"
      className={className}
      role="img"
      aria-label="Accenture"
    >
      <polygon fill="#A100FF" points="95.1,12 104.5,8.5 95.1,4.9 95.1,0 111.2,6.5 111.2,10.5 95.1,17" />
      <path
        fill="currentColor"
        d="M6.2,43C2.8,43,0,41.3,0,37.5v-0.2c0-4.6,4-6.2,8.9-6.2h2.3v-0.9c0-1.9-0.8-3-2.8-3c-1.8,0-2.7,1-2.8,2.4h-5 c0.4-4.2,3.7-6.2,8.1-6.2c4.5,0,7.8,1.9,7.8,6.6v12.6h-5.1v-2.2C10.4,41.8,8.7,43,6.2,43z M11.2,36.4v-1.8H9.1 c-2.6,0-3.9,0.7-3.9,2.4v0.2c0,1.3,0.8,2.2,2.6,2.2C9.6,39.3,11.2,38.3,11.2,36.4z M28.4,43c-5.2,0-9-3.2-9-9.6v-0.3 c0-6.4,4-9.8,9-9.8c4.3,0,7.8,2.2,8.2,7.1h-5c-0.3-1.8-1.3-3-3.1-3c-2.2,0-3.8,1.8-3.8,5.5v0.6c0,3.8,1.4,5.5,3.8,5.5 c1.8,0,3.1-1.3,3.4-3.4h4.8C36.4,40,33.5,43,28.4,43z M48,43c-5.2,0-9-3.2-9-9.6v-0.3c0-6.4,4-9.8,9-9.8c4.3,0,7.8,2.2,8.2,7.1h-5 c-0.3-1.8-1.3-3-3.1-3c-2.2,0-3.8,1.8-3.8,5.5v0.6c0,3.8,1.4,5.5,3.8,5.5c1.8,0,3.1-1.3,3.4-3.4h4.8C56,40,53.1,43,48,43z M67.7,43 c-5.4,0-9.1-3.2-9.1-9.5v-0.4c0-6.3,3.9-9.8,9-9.8c4.7,0,8.6,2.6,8.6,8.9v2.3H63.9c0.2,3.4,1.7,4.7,3.9,4.7c2,0,3.1-1.1,3.5-2.4 h4.9C75.6,40.3,72.6,43,67.7,43z M64,31H71c-0.1-2.8-1.4-4-3.5-4C65.9,27.1,64.4,28,64,31z M79.4,23.8h5.3v2.8 c0.9-1.8,2.8-3.2,5.7-3.2c3.4,0,5.7,2.1,5.7,6.6v12.6h-5.3V30.8c0-2.2-0.9-3.2-2.8-3.2c-1.8,0-3.3,1.1-3.3,3.5v11.5h-5.3V23.8z M105.8,18.1v5.7h3.6v3.9h-3.6v8.9c0,1.4,0.6,2.1,1.9,2.1c0.8,0,1.3-0.1,1.8-0.3v4.1c-0.6,0.2-1.7,0.4-3,0.4c-4.1,0-6-1.9-6-5.7 v-9.5h-2.2v-3.9h2.2v-3.5L105.8,18.1z M129.2,42.6H124v-2.8c-0.9,1.8-2.7,3.2-5.5,3.2c-3.4,0-5.9-2.1-5.9-6.5V23.8h5.3v12 c0,2.2,0.9,3.2,2.7,3.2c1.8,0,3.3-1.2,3.3-3.5V23.8h5.3V42.6z M133.1,23.8h5.3v3.5c1.1-2.5,2.9-3.7,5.7-3.7v5.2 c-3.6,0-5.7,1.1-5.7,4.2v9.7h-5.3V23.8z M154.8,43c-5.4,0-9.1-3.2-9.1-9.5v-0.4c0-6.3,3.9-9.8,9-9.8c4.7,0,8.6,2.6,8.6,8.9v2.3 h-12.2c0.2,3.4,1.7,4.7,3.9,4.7c2,0,3.1-1.1,3.5-2.4h4.9C162.6,40.3,159.7,43,154.8,43z M151,31h7.1c-0.1-2.8-1.4-4-3.5-4 C153,27.1,151.5,28,151,31z"
      />
    </svg>
  )
}
```

---

## frontend/src/components/ui/ScoreBadge.tsx

```tsx
import { cn, scoreBg } from '@/lib/utils'

interface Props {
  score: number | null
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const LABELS: Record<number, string> = { 1: 'Foundation', 2: 'Intermediate', 3: 'Advanced', 4: 'Leading' }

export default function ScoreBadge({ score, label, size = 'sm' }: Props) {
  const displayLabel = label ?? (score !== null ? LABELS[Math.floor(score)] ?? '—' : '—')
  return (
    <span className={cn(
      'score-badge',
      scoreBg(score),
      size === 'sm' && 'text-xs px-2 py-0.5',
      size === 'md' && 'text-sm px-3 py-1',
      size === 'lg' && 'text-base px-4 py-1.5',
    )}>
      {score !== null ? score.toFixed(0) : '—'} {displayLabel}
    </span>
  )
}
```

---

## frontend/src/components/ui/Toast.tsx

```tsx
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

type ToastListener = (toasts: Toast[]) => void

// Simple singleton event bus — no external state lib needed
let _toasts: Toast[] = []
const _listeners = new Set<ToastListener>()

function notify() {
  _listeners.forEach(fn => fn([..._toasts]))
}

function addToast(type: ToastType, message: string, duration = 4500) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  _toasts = [..._toasts, { id, type, message, duration }]
  notify()
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id: string) {
  _toasts = _toasts.filter(t => t.id !== id)
  notify()
}

// Public API — import and call anywhere
export const toast = {
  success: (msg: string, duration?: number) => addToast('success', msg, duration),
  error:   (msg: string, duration?: number) => addToast('error',   msg, duration ?? 6000),
  warning: (msg: string, duration?: number) => addToast('warning', msg, duration),
  info:    (msg: string, duration?: number) => addToast('info',    msg, duration),
}

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-white border-green-400 text-green-800',
  error:   'bg-white border-red-400 text-red-800',
  warning: 'bg-white border-amber-400 text-amber-800',
  info:    'bg-white border-brand-purple text-brand-dark',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-brand-purple',
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[t.type]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn(
        'w-80 flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 shadow-lg',
        STYLES[t.type],
      )}
    >
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', ICON_COLORS[t.type])} />
      <p className="text-sm leading-snug flex-1">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-current opacity-40 hover:opacity-80 transition-opacity"
      >
        <X size={13} />
      </button>
    </motion.div>
  )
}

// Mount this once in App.tsx / AppShell.tsx
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener: ToastListener = updated => setToasts(updated)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  const dismiss = useCallback((id: string) => removeToast(id), [])

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

---

## frontend/src/components/upload/QuestionnaireSection.tsx

```tsx
/**
 * QuestionnaireSection — click-to-answer questionnaire for D5 (Workforce) and
 * D10 (Digital). Companion to the Excel QRE upload — both flows write to the
 * same engine override path, so users can pick whichever is faster.
 *
 * For each dimension, we render its questions as 4-option radio cards. The
 * dimension score is computed live (rounded average of answered questions).
 * On Save:
 *   - dimension scores → /confirm-text-qre  (engine override path, existing)
 *   - per-question answers → /questionnaire-detail  (AI prompt evidence)
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface QOption {
  score: 1 | 2 | 3 | 4
  label: string
}
interface Question {
  code: string
  text: string
  options: QOption[]
}
interface DimBlock {
  dimension_id: string
  title: string
  description: string
  weight_pct: number
  questions: Question[]
}

const SCORE_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-amber-100 text-amber-700 border-amber-200',
  3: 'bg-blue-100 text-blue-700 border-blue-200',
  4: 'bg-green-100 text-green-700 border-green-200',
}

interface Props {
  sessionId: string
  skillPath: string | null
}

export default function QuestionnaireSection({ sessionId, skillPath }: Props) {
  const [data, setData] = useState<DimBlock[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // answers shape: { dim_id: { question_code: score (1..4) } }
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({})
  const [openDim, setOpenDim] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [shellOpen, setShellOpen] = useState(false)

  useEffect(() => {
    if (!skillPath) return
    setLoading(true)
    api.getQuestionnaire(skillPath)
      .then((d) => {
        setData(d.questionnaire || [])
        // Auto-expand the first dimension when first opened
        if (d.questionnaire?.[0]?.dimension_id) {
          setOpenDim((prev) => prev ?? d.questionnaire[0].dimension_id)
        }
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [skillPath])

  const setAnswer = (dim: string, qCode: string, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [dim]: { ...(prev[dim] || {}), [qCode]: score },
    }))
  }

  // Computed: per-dimension score (rounded average), answered count, total
  const dimScore = (dim: DimBlock) => {
    const a = answers[dim.dimension_id] || {}
    const scores = Object.values(a).filter((v) => v >= 1 && v <= 4)
    if (scores.length === 0) return { score: null as number | null, answered: 0, total: dim.questions.length }
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    return { score: Math.round(avg), answered: scores.length, total: dim.questions.length }
  }

  // Total answered across all dims for the shell pill
  const totalAnswered = useMemo(() => {
    return Object.values(answers).reduce((s, dim) => s + Object.keys(dim).length, 0)
  }, [answers])
  const totalQuestions = useMemo(() => {
    return (data || []).reduce((s, d) => s + d.questions.length, 0)
  }, [data])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    setError('')
    try {
      // Build dim-level scores (engine override path)
      const confirmed: Record<string, number> = {}
      for (const dim of data) {
        const s = dimScore(dim)
        if (s.score !== null && s.answered >= Math.ceil(s.total * 0.6)) {
          // Only commit a dim score when at least 60% of questions are answered
          confirmed[dim.dimension_id] = s.score
        }
      }
      // Two parallel writes: engine override + per-question evidence for AI
      await Promise.all([
        Object.keys(confirmed).length > 0
          ? api.confirmTextQre(sessionId, confirmed)
          : Promise.resolve(),
        api.saveQuestionnaireDetail(sessionId, answers),
      ])
      setSavedAt(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!skillPath) return null

  return (
    <div className="acc-card mb-5 py-3 px-4 border-l-4 border-l-brand-purple">
      {/* Shell header — click to expand the whole section */}
      <button
        type="button"
        onClick={() => setShellOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">Questionnaire — Workforce & Digital</span>
          <span className="text-[10px] text-caption font-semibold uppercase tracking-wide">click-to-answer · alternative to Excel QRE upload</span>
        </div>
        <div className="flex items-center gap-3">
          {totalQuestions > 0 && (
            <span className="text-[11px] text-caption">
              {totalAnswered}/{totalQuestions} answered
            </span>
          )}
          {savedAt && (
            <span className="text-[10px] text-green-700 flex items-center gap-1">
              <CheckCircle2 size={11} /> saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {shellOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {shellOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-caption">
                  <Loader2 size={12} className="animate-spin text-brand-purple" /> Loading question bank…
                </div>
              )}
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
              )}

              {data && data.length === 0 && (
                <p className="text-xs text-caption italic">
                  This skill has no embedded questionnaire — fall back to the Excel QRE upload above.
                </p>
              )}

              {data && data.map((dim) => {
                const s = dimScore(dim)
                const isOpen = openDim === dim.dimension_id
                return (
                  <div key={dim.dimension_id} className="border border-bg-secondary rounded-lg overflow-hidden">
                    {/* Dimension header */}
                    <button
                      type="button"
                      onClick={() => setOpenDim(isOpen ? null : dim.dimension_id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-bg-secondary/40 hover:bg-bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm font-bold text-brand-dark">{dim.title}</span>
                        {dim.weight_pct > 0 && (
                          <span className="text-[10px] text-brand-purple bg-purple-50 border border-brand-purple/20 rounded px-1.5 py-0.5">
                            {dim.weight_pct}% of overall
                          </span>
                        )}
                        <span className="text-[10px] text-caption">
                          {s.answered}/{s.total} answered
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.score !== null ? (
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded border', SCORE_BADGE[s.score])}>
                            {s.score}/4
                          </span>
                        ) : (
                          <span className="text-[10px] text-caption italic">no score yet</span>
                        )}
                        {isOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
                      </div>
                    </button>

                    {/* Question cards */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          {dim.description && (
                            <p className="px-3 py-2 text-[11px] text-caption italic border-b border-bg-secondary/60">
                              {dim.description}
                            </p>
                          )}
                          <div className="divide-y divide-bg-secondary/60">
                            {dim.questions.map((q) => {
                              const selected = answers[dim.dimension_id]?.[q.code]
                              return (
                                <div key={q.code} className="px-3 py-3">
                                  <p className="text-xs font-semibold text-brand-dark mb-2">
                                    <span className="text-caption font-mono mr-2">{q.code}</span>
                                    {q.text}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {q.options.map((opt) => {
                                      const isSelected = selected === opt.score
                                      return (
                                        <button
                                          key={opt.score}
                                          type="button"
                                          onClick={() => setAnswer(dim.dimension_id, q.code, opt.score)}
                                          className={cn(
                                            'flex items-start gap-2 text-left text-[11px] border rounded px-2.5 py-1.5 transition-colors',
                                            isSelected
                                              ? 'border-brand-purple bg-purple-50/60 text-brand-dark'
                                              : 'border-bg-secondary hover:border-brand-purple/40 hover:bg-purple-50/30 text-brand-dark/85'
                                          )}
                                        >
                                          <span className={cn(
                                            'flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black',
                                            isSelected
                                              ? SCORE_BADGE[opt.score]
                                              : 'bg-white border-bg-secondary text-caption'
                                          )}>
                                            {opt.score}
                                          </span>
                                          <span className="flex-1 leading-snug">{opt.label}</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}

              {data && data.length > 0 && (
                <div className="flex items-center justify-end gap-3 pt-1">
                  <p className="text-[10px] text-caption italic mr-auto">
                    A dimension is committed only when at least 60% of its questions are answered.
                  </p>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || totalAnswered === 0}
                    className="text-xs bg-brand-purple text-white px-4 py-1.5 rounded font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving
                      ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                      : <><CheckCircle2 size={11} /> Save answers</>}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

---

## frontend/src/components/upload/DiscoveryQRESection.tsx

```tsx
/**
 * DiscoveryQRESection — 24-question qualitative discovery questionnaire.
 *
 * Organised into 4 areas (Overall Scope, Op Model & Org Structure,
 * Process & Technology, Governance & Reporting). Each question has its
 * own text-area. Answers are auto-saved to the backend on blur and on
 * explicit "Save" click, then feed directly into AI insight prompts.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, Save, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  text: string
}

interface Area {
  area: string
  area_id: string
  questions: Question[]
}

interface DiscoveryQRESectionProps {
  sessionId: string
}

// ── Fetch questions from backend (or use hardcoded fallback) ──────────────────
const FALLBACK_AREAS: Area[] = [
  {
    area: 'Overall Scope',
    area_id: 'scope',
    questions: [
      { id: 'SC1', text: 'What are the exact entities and business units in scope? Are all distribution and generation units included, or are certain entities excluded at this stage?' },
      { id: 'SC2', text: 'What are the major categories you procure and what is the annual spend & volume? (e.g. CAPEX, civil & construction, contractor services, IT/technology, MRO/O&M)' },
      { id: 'SC3', text: 'Has a procurement maturity assessment been conducted previously? If yes, share key findings and actions taken as a result.' },
    ],
  },
  {
    area: 'Operating Model & Org Structure',
    area_id: 'op_model',
    questions: [
      { id: 'OM1', text: 'How is the procurement team structured? (central vs site teams, headcount, spend coverage) What is the governance model between central and unit-level teams?' },
      { id: 'OM2', text: 'What are the roles & responsibilities of the procurement team? Is there a shared services model? What % of team bandwidth is spent on strategic vs transactional activities?' },
      { id: 'OM3', text: 'What spend categories are centrally managed vs unit-managed? Is the split based on category type, spend value, or other criteria?' },
      { id: 'OM4', text: 'What is the current Delegation of Authority (DoA) framework? Is it value-based, category-based, or entity-based? Is it documented and system-enforced, or manual?' },
      { id: 'OM5', text: 'What are the current KPIs and KRAs for the procurement function and individuals? How are these tracked, calculated, and reported?' },
      { id: 'OM6', text: 'What is the current capability profile of the team (functional expertise, category knowledge, system proficiency)? Are there specific skill gaps?' },
      { id: 'OM7', text: 'What incentive structures exist for the procurement team? What is the current attrition rate (central vs site)?' },
      { id: 'OM8', text: 'Who are the key internal stakeholders whose buy-in is critical for the operating model to be approved and implemented?' },
    ],
  },
  {
    area: 'Process & Technology',
    area_id: 'process_tech',
    questions: [
      { id: 'PT1', text: 'Which systems are currently in use across entities (SAP, Oracle, Coupa, others)? Which entities use which system, and what processes are system-supported vs managed offline?' },
      { id: 'PT2', text: 'Are there any technology transformations planned or underway (e.g. S/4HANA, Ariba, Coupa, other S2P tools)? What are the implementation timelines?' },
      { id: 'PT3', text: 'What are the current source-to-contract (S2C) and procure-to-pay (P2P) processes? Are they documented? Where are the biggest bottlenecks or compliance gaps?' },
      { id: 'PT4', text: 'What buying channels are in use (rate contracts, spot buys, approved vendors, reverse auctions, GeM portal)? Is there a defined channel strategy or is it ad hoc by unit?' },
      { id: 'PT5', text: 'How are contracts currently managed? Is there a central repository, and how is contract compliance (validity, renewals, milestones) monitored?' },
      { id: 'PT6', text: 'How is supplier onboarding, performance management, and vendor risk handled? Is there a formal performance management process with scorecards?' },
      { id: 'PT7', text: 'Is there any interest in procurement aggregators for low-value/tail spend? Which categories are being considered and what is the estimated spend?' },
      { id: 'PT8', text: "What is the organisation's vision for AI and automation in procurement? Are there specific use cases already identified (e.g. demand consolidation, spend analytics, autonomous sourcing)?" },
    ],
  },
  {
    area: 'Governance & Reporting',
    area_id: 'governance',
    questions: [
      { id: 'GR1', text: 'What procurement governance forums currently exist (review meetings, steering committees)? How frequently do they meet and who participates?' },
      { id: 'GR2', text: 'Are there any recent internal audit observations, compliance issues, or regulatory findings related to procurement that should factor into the design?' },
      { id: 'GR3', text: 'Are there specific regulatory or statutory requirements governing procurement (e.g. CERC guidelines, CVC guidelines for public procurement, MSME compliance)?' },
      { id: 'GR4', text: 'Does the organisation have a sustainable procurement policy? Are ESG criteria currently applied to supplier selection or evaluation?' },
    ],
  },
]

const AREA_COLORS: Record<string, string> = {
  scope:        'bg-violet-600',
  op_model:     'bg-indigo-600',
  process_tech: 'bg-blue-600',
  governance:   'bg-teal-600',
}

export default function DiscoveryQRESection({ sessionId }: DiscoveryQRESectionProps) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<Area[]>(FALLBACK_AREAS)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load questions + any previously saved answers on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/discovery-qre/questions').then(r => r.json()).catch(() => null),
      fetch(`/api/v1/session/${sessionId}/discovery-qre`).then(r => r.json()).catch(() => null),
    ]).then(([qData, aData]) => {
      if (qData?.areas) setAreas(qData.areas)
      if (aData?.answers) {
        setAnswers(aData.answers)
        setSavedCount(Object.keys(aData.answers).length)
      }
    })
  }, [sessionId])

  const totalQuestions = areas.reduce((s, a) => s + a.questions.length, 0)
  const answeredCount = Object.values(answers).filter(v => v.trim()).length

  const handleChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setSaved(false)
    // Debounced auto-save after 2 s of inactivity
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave({ ...answers, [id]: value }), 2000)
  }

  const doSave = async (data: Record<string, string>) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/discovery-qre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setSaved(true)
      setSavedCount(json.saved || 0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => doSave(answers)

  return (
    <div className="acc-card mb-6">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ClipboardList size={16} className="text-brand-purple flex-shrink-0" />
          <span className="text-sm font-bold text-brand-dark">Discovery QRE</span>
          <span className="text-xs text-caption">(Optional — qualitative inputs for AI insights)</span>
          {savedCount > 0 && (
            <span className="ml-1 text-xs font-semibold text-brand-purple bg-purple-50 border border-brand-purple/20 px-2 py-0.5 rounded">
              {answeredCount}/{totalQuestions} answered · {savedCount} saved
            </span>
          )}
          {answeredCount > 0 && savedCount === 0 && (
            <span className="ml-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              {answeredCount} unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin text-brand-purple" />}
          {saved && !saving && <CheckCircle size={13} className="text-green-600" />}
          {open ? <ChevronUp size={16} className="text-caption" /> : <ChevronDown size={16} className="text-caption" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-bg-secondary">
              <p className="text-xs text-caption mb-4 leading-relaxed">
                Answer any questions where you have information from stakeholder interviews or Copilot summaries.
                These answers are passed directly to the AI insight engine — mentions of specific tools (e.g. "Coupa"),
                categories, or process gaps will surface in the generated recommendations.
                <strong className="text-brand-dark"> Answers auto-save after 2 seconds of inactivity.</strong>
              </p>

              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  Save failed: {error}
                </div>
              )}

              <div className="space-y-6">
                {areas.map((area) => (
                  <div key={area.area_id}>
                    {/* Area header */}
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md mb-3',
                      AREA_COLORS[area.area_id] || 'bg-brand-purple',
                    )}>
                      <span className="text-xs font-bold text-white uppercase tracking-wide">
                        {area.area}
                      </span>
                      <span className="text-[10px] text-white/70 ml-auto">
                        {area.questions.filter(q => answers[q.id]?.trim()).length}/{area.questions.length} answered
                      </span>
                    </div>

                    <div className="space-y-3">
                      {area.questions.map((q, qi) => {
                        const val = answers[q.id] || ''
                        const filled = val.trim().length > 0
                        return (
                          <div key={q.id} className={cn(
                            'border rounded-lg p-3 transition-colors',
                            filled ? 'border-brand-purple/30 bg-purple-50/30' : 'border-bg-secondary'
                          )}>
                            <div className="flex items-start gap-2 mb-2">
                              <span className="flex-shrink-0 w-7 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-brand-purple/10 text-brand-purple">
                                {q.id}
                              </span>
                              <label
                                htmlFor={`q-${q.id}`}
                                className="text-[11px] text-brand-dark leading-relaxed cursor-pointer"
                              >
                                {q.text}
                              </label>
                            </div>
                            <textarea
                              id={`q-${q.id}`}
                              value={val}
                              onChange={e => handleChange(q.id, e.target.value)}
                              rows={2}
                              placeholder="Enter your response…"
                              className={cn(
                                'w-full text-xs border rounded p-2.5 resize-y focus:outline-none transition-colors text-black placeholder:text-caption',
                                filled
                                  ? 'border-brand-purple/40 focus:border-brand-purple bg-white'
                                  : 'border-bg-secondary focus:border-brand-purple'
                              )}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer save button */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-bg-secondary">
                <p className="text-xs text-caption">
                  {answeredCount}/{totalQuestions} questions answered
                  {saved && ` · ${savedCount} saved to session`}
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || answeredCount === 0}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors',
                    saved
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-brand-purple text-white hover:bg-brand-dark disabled:opacity-50'
                  )}
                >
                  {saving
                    ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                    : saved
                    ? <><CheckCircle size={12} /> Saved</>
                    : <><Save size={12} /> Save Answers</>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

---

## Deployment Instructions

### Prerequisites
- Node.js 18+
- Python 3.11+
- Google Cloud SDK (for Vertex AI / ADC authentication)

### Frontend Setup
```bash
cd "Assessment App v2/frontend"
npm install
npm run dev   # http://localhost:5173
```

### Backend Setup
```bash
cd "Assessment App v2/backend"
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

### Production Build
```bash
cd frontend && npm run build
# Output: frontend/dist/ — serve with nginx or similar
```

### Environment / ADC
The backend uses Google Application Default Credentials for Vertex AI.
Run: `gcloud auth application-default login`
Set project: `gcloud config set project YOUR_PROJECT_ID`

### Vite Proxy
The frontend proxies /api/v1/* to http://localhost:8002 via vite.config.ts.
In production, configure your reverse proxy (nginx/caddy) accordingly.

### Session Storage
Sessions are in-memory (Python dict) with 4-hour TTL. Restart = data loss.
For production, replace with Redis or a database-backed store.
