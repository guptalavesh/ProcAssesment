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
  status?: 'done' | 'error' | 'running'
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
  description?: string
  dimension_score?: number | null
  score_display?: number | null
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

// ── KPI Dashboard ─────────────────────────────────────────────────────────────
export interface KpiTrendPoint {
  month: string
  value: number
}

export interface KpiDrillItem {
  name: string
  value: number
  pct?: number
}

export interface KpiData {
  id: string
  label: string
  available: boolean
  value: number | null
  unit: string
  benchmark: number | null
  direction: 'higher_is_better' | 'lower_is_better'
  trend: KpiTrendPoint[]
  by_plant: KpiDrillItem[]
  by_vendor: KpiDrillItem[]
  by_category: KpiDrillItem[]
  by_purchase_group: KpiDrillItem[]
  confidence?: 'low' | 'medium' | 'high'
  confidence_reason?: string
  row_count?: number
}

export interface DashboardSummary {
  total_spend_cr: number
  po_count: number
  vendor_count: number
  date_range?: { min: string; max: string }
}

export interface DashboardFilters {
  plants: string[]
  categories: string[]
  purchase_groups: string[]
}

export interface DashboardData {
  kpis: Record<string, KpiData>
  summary: DashboardSummary
  filters: DashboardFilters
  low_confidence: boolean
  row_count: number
}

// ── Session State (Zustand) ───────────────────────────────────────────────────
export type AppScreen = 'setup' | 'upload' | 'columns' | 'configure' | 'running' | 'formula-review' | 'results'
