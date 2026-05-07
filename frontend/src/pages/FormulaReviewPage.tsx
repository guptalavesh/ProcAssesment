import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, RefreshCw, CheckCircle2,
  Pencil, RotateCcw, ArrowRight, Info, AlertTriangle, Save, SlidersHorizontal,
} from 'lucide-react'
import { useAssessmentStore } from '@/store/assessmentStore'
import { cn, formatIndianInt } from '@/lib/utils'

interface KpiFormula {
  kpi_id: string
  label: string
  bucket: string
  weight: number
  unit: string
  direction: 'lower_is_better' | 'higher_is_better'
  formula: string
  description: string
  benchmark: number
  benchmark_unit: string
  thresholds: Record<string, { label: string; condition: string }>
  multipliers: Record<string, number>
  has_override: boolean
}

interface FormulaConfig {
  kpis: KpiFormula[]
  score_labels: Record<string, string>
  score_colors: Record<string, string>
  bucket_order: string[]
  overrides_active: boolean
  override_count: number
}

interface KpiOverride {
  benchmark?: number
  formula?: string
  description?: string
}

interface ParamDef {
  key: string
  type: 'number' | 'boolean'
  label: string
  unit?: string
  min?: number
  max?: number
  step?: number
  default: number | boolean
  description: string
  value: number | boolean
}

interface FormulaParamGroup {
  label: string
  description: string
  params: ParamDef[]
  has_override: boolean
}

const SCORE_BG: Record<string, string> = {
  Leading:      'bg-green-100 text-green-800 border-green-300',
  Advanced:     'bg-blue-100 text-blue-800 border-blue-300',
  Intermediate: 'bg-orange-100 text-orange-800 border-orange-300',
  Foundation:   'bg-red-100 text-red-800 border-red-300',
}

function scoreThresholds(kpi: KpiFormula, bench: number) {
  const { direction, multipliers, unit } = kpi
  const m4 = multipliers.score_4
  const m3 = multipliers.score_3
  const m2 = multipliers.score_2
  const fmt = (v: number) =>
    unit === '₹ Cr' ? `₹${formatIndianInt(v)} Cr`
    : unit === 'days' ? `${v.toFixed(0)} days`
    : `${v.toFixed(0)}%`

  if (direction === 'lower_is_better') {
    return [
      { score: 4, label: 'Leading',      range: `< ${fmt(bench * m4)}` },
      { score: 3, label: 'Advanced',     range: `${fmt(bench * m4)} – ${fmt(bench * m3)}` },
      { score: 2, label: 'Intermediate', range: `${fmt(bench * m3)} – ${fmt(bench * m2)}` },
      { score: 1, label: 'Foundation',   range: `≥ ${fmt(bench * m2)}` },
    ]
  }
  return [
    { score: 4, label: 'Leading',      range: `> ${fmt(bench * m4)}` },
    { score: 3, label: 'Advanced',     range: `${fmt(bench * m3)} – ${fmt(bench * m4)}` },
    { score: 2, label: 'Intermediate', range: `${fmt(bench * m2)} – ${fmt(bench * m3)}` },
    { score: 1, label: 'Foundation',   range: `< ${fmt(bench * m2)}` },
  ]
}

function NumberParam({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number) => void }) {
  const isDefault = value === def.default
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-dark">{def.label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="w-16 border border-gray-300 rounded-md px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-purple"
            value={value}
            min={def.min}
            max={def.max}
            step={def.step}
            onChange={e => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onChange(Math.min(def.max ?? 999, Math.max(def.min ?? 0, n)))
            }}
          />
          <span className="text-[10px] text-caption">{def.unit}</span>
          {!isDefault && (
            <button onClick={() => onChange(def.default as number)} className="text-[10px] text-caption hover:text-brand-purple" title="Reset to default">
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      </div>
      <input type="range" className="w-full h-1.5 accent-brand-purple"
        min={def.min} max={def.max} step={def.step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
      <div className="flex justify-between">
        <span className="text-[9px] text-caption">{def.min}{def.unit}</span>
        <span className="text-[9px] text-caption">{def.max}{def.unit}</span>
      </div>
      {!isDefault && (
        <p className="text-[10px] text-brand-purple font-medium">Changed from default ({def.default as number}{def.unit})</p>
      )}
    </div>
  )
}

function BooleanParam({ def, value, onChange }: { def: ParamDef; value: boolean; onChange: (v: boolean) => void }) {
  const isDefault = value === def.default
  return (
    <div className="flex items-start gap-3">
      <button onClick={() => onChange(!value)}
        className={cn('flex-shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5', value ? 'bg-brand-purple' : 'bg-gray-200')}>
        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-brand-dark">{def.label}</p>
        <p className="text-[10px] text-caption">{def.description}</p>
        {!isDefault && (
          <button onClick={() => onChange(def.default as boolean)} className="text-[10px] text-caption hover:text-brand-purple mt-0.5 flex items-center gap-0.5">
            <RotateCcw size={9} /> Reset to default ({(def.default as boolean) ? 'On' : 'Off'})
          </button>
        )}
      </div>
    </div>
  )
}

function KpiCard({ kpi, override, paramGroup, onSave, onReset, onParamChange }: {
  kpi: KpiFormula; override: KpiOverride | null; paramGroup: FormulaParamGroup | null
  onSave: (id: string, patch: KpiOverride) => void; onReset: (id: string) => void
  onParamChange: (kpiId: string, key: string, value: number | boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingFormula, setEditingFormula] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editingBench, setEditingBench] = useState(false)
  const [formulaInput, setFormulaInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [benchInput, setBenchInput] = useState('')

  const effectiveFormula = override?.formula ?? kpi.formula
  const effectiveDesc = override?.description ?? kpi.description
  const effectiveBench = override?.benchmark ?? kpi.benchmark
  const hasOverride = override !== null && Object.keys(override).length > 0
  const hasParamChange = paramGroup?.params.some(p => p.value !== p.default) ?? false
  const thresholds = scoreThresholds(kpi, effectiveBench)

  const saveFormula = () => { if (formulaInput.trim()) onSave(kpi.kpi_id, { formula: formulaInput.trim() }); setEditingFormula(false) }
  const saveDesc = () => { if (descInput.trim()) onSave(kpi.kpi_id, { description: descInput.trim() }); setEditingDesc(false) }
  const saveBench = () => { const n = parseFloat(benchInput); if (!isNaN(n) && n > 0) onSave(kpi.kpi_id, { benchmark: n }); setEditingBench(false) }

  return (
    <div className={cn('rounded-xl border overflow-hidden shadow-sm transition-all',
      (hasOverride || hasParamChange) ? 'border-brand-purple/50 bg-purple-50/20' : 'border-gray-200 bg-white')}>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-brand-dark">{kpi.label}</span>
            <span className="text-[10px] text-caption bg-gray-100 px-2 py-0.5 rounded-full border">{kpi.bucket}</span>
            <span className="text-[10px] text-caption">{(kpi.weight * 100).toFixed(0)}% weight</span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium',
              kpi.direction === 'lower_is_better' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200')}>
              {kpi.direction === 'lower_is_better' ? '↓ lower = better' : '↑ higher = better'}
            </span>
            {hasOverride && <span className="text-[10px] text-brand-purple font-semibold bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">✎ Benchmark</span>}
            {hasParamChange && <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">⚙ Parameters</span>}
          </div>
          <p className="text-[11px] text-caption mt-0.5 font-mono truncate">{effectiveFormula}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-caption">Benchmark</p>
            <p className="text-sm font-bold text-brand-dark">{effectiveBench.toFixed(0)} <span className="text-caption font-normal text-xs">{kpi.benchmark_unit}</span></p>
          </div>
          {expanded ? <ChevronUp size={15} className="text-caption" /> : <ChevronDown size={15} className="text-caption" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="border-t border-gray-100 px-4 py-4 space-y-5">
              {paramGroup && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal size={13} className="text-amber-600" />
                    <p className="text-[10px] text-amber-700 uppercase font-bold tracking-wide">Calculation Parameters</p>
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">affects computed values</span>
                  </div>
                  <p className="text-[11px] text-caption mb-3">{paramGroup.description}</p>
                  <div className="space-y-4">
                    {paramGroup.params.map(p => (
                      <div key={p.key} className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-3">
                        {p.type === 'number' ? (
                          <>
                            <NumberParam def={p} value={p.value as number} onChange={v => onParamChange(kpi.kpi_id, p.key, v)} />
                            <p className="text-[10px] text-caption mt-1.5">{p.description}</p>
                          </>
                        ) : (
                          <BooleanParam def={p} value={p.value as boolean} onChange={v => onParamChange(kpi.kpi_id, p.key, v)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">Formula Display Text<span className="ml-1 normal-case font-normal text-[10px]">(display only)</span></p>
                  {!editingFormula ? (
                    <button onClick={() => { setFormulaInput(effectiveFormula); setEditingFormula(true) }}
                      className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium">
                      <Pencil size={10} /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveFormula} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold"><Save size={10} /> Save</button>
                      <button onClick={() => setEditingFormula(false)} className="text-[11px] text-caption hover:text-brand-dark">Cancel</button>
                    </div>
                  )}
                </div>
                {editingFormula ? (
                  <textarea className="w-full border border-brand-purple rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                    rows={2} value={formulaInput} onChange={e => setFormulaInput(e.target.value)} autoFocus />
                ) : (
                  <code className="block text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-brand-dark font-mono whitespace-pre-wrap">{effectiveFormula}</code>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">Description</p>
                  {!editingDesc ? (
                    <button onClick={() => { setDescInput(effectiveDesc); setEditingDesc(true) }}
                      className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium">
                      <Pencil size={10} /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveDesc} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold"><Save size={10} /> Save</button>
                      <button onClick={() => setEditingDesc(false)} className="text-[11px] text-caption hover:text-brand-dark">Cancel</button>
                    </div>
                  )}
                </div>
                {editingDesc ? (
                  <textarea className="w-full border border-brand-purple rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                    rows={2} value={descInput} onChange={e => setDescInput(e.target.value)} autoFocus />
                ) : (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Info size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">{effectiveDesc}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-caption uppercase font-bold tracking-wide">Industry Benchmark<span className="ml-1 normal-case font-normal">(drives 1–4 scoring)</span></p>
                  {!editingBench ? (
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setBenchInput(effectiveBench.toFixed(0)); setEditingBench(true) }}
                        className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline font-medium">
                        <Pencil size={10} /> Edit benchmark
                      </button>
                      {hasOverride && (
                        <button onClick={() => onReset(kpi.kpi_id)} className="flex items-center gap-1 text-[11px] text-caption hover:text-red-600 transition-colors">
                          <RotateCcw size={10} /> Reset
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={saveBench} className="flex items-center gap-1 text-[11px] text-green-700 hover:underline font-semibold"><Save size={10} /> Save</button>
                      <button onClick={() => setEditingBench(false)} className="text-[11px] text-caption hover:text-brand-dark">Cancel</button>
                    </div>
                  )}
                </div>
                {editingBench ? (
                  <div className="flex items-center gap-2">
                    <input type="number" className="border border-brand-purple rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                      value={benchInput} onChange={e => setBenchInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBench(); if (e.key === 'Escape') setEditingBench(false) }}
                      autoFocus />
                    <span className="text-xs text-caption">{kpi.benchmark_unit}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-bold', override?.benchmark != null ? 'text-brand-purple' : 'text-brand-dark')}>
                      {effectiveBench.toFixed(0)} {kpi.benchmark_unit}
                    </span>
                    {override?.benchmark != null && <span className="text-[10px] text-caption">(default: {kpi.benchmark.toFixed(0)})</span>}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] text-caption uppercase font-bold tracking-wide mb-2">
                  Score Thresholds
                  {override?.benchmark != null && <span className="ml-1 normal-case font-normal text-brand-purple">(updated)</span>}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {thresholds.map(t => (
                    <div key={t.score} className={cn('rounded-lg border px-2.5 py-2 text-center text-xs', SCORE_BG[t.label] ?? '')}>
                      <p className="font-black text-sm">{t.score}/4</p>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-[10px] opacity-75 mt-0.5">{t.range}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FormulaReviewPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen } = useAssessmentStore()

  const [config, setConfig] = useState<FormulaConfig | null>(null)
  const [formulaParamsConfig, setFormulaParamsConfig] = useState<Record<string, FormulaParamGroup>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, KpiOverride>>({})
  const [saving, setSaving] = useState(false)
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      fetch(`/api/v1/session/${sessionId}/results/formula-config`).then(r => r.json()),
      fetch(`/api/v1/session/${sessionId}/results/formula-params`).then(r => r.json()),
    ])
      .then(([configData, paramsData]) => {
        setConfig(configData)
        const pre: Record<string, KpiOverride> = {}
        configData.kpis?.forEach((kpi: KpiFormula) => {
          if (kpi.has_override) pre[kpi.kpi_id] = { benchmark: kpi.benchmark }
        })
        setOverrides(pre)
        const bucketState: Record<string, boolean> = {}
        configData.bucket_order?.forEach((b: string) => { bucketState[b] = false })
        setExpandedBuckets(bucketState)
        setFormulaParamsConfig(paramsData.formula_params ?? {})
      })
      .catch(() => setError('Failed to load formula configuration.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const handleSave = useCallback((id: string, patch: KpiOverride) => {
    setOverrides(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }))
  }, [])

  const handleReset = useCallback((id: string) => {
    setOverrides(prev => { const next = { ...prev }; delete next[id]; return next })
  }, [])

  const handleParamChange = useCallback((kpiId: string, key: string, value: number | boolean) => {
    setFormulaParamsConfig(prev => {
      const group = prev[kpiId]
      if (!group) return prev
      return { ...prev, [kpiId]: { ...group, params: group.params.map(p => p.key === key ? { ...p, value } : p) } }
    })
  }, [])

  const overrideCount = Object.keys(overrides).length
  const paramChangeCount = Object.values(formulaParamsConfig).flatMap(g => g.params).filter(p => p.value !== p.default).length

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const benchOverrides = Object.entries(overrides).filter(([, ov]) => ov.benchmark != null).map(([kpi_id, ov]) => ({ kpi_id, benchmark: ov.benchmark }))
      if (benchOverrides.length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/formula-overrides`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: benchOverrides }),
        })
      }
      const paramsPayload: Record<string, Record<string, number | boolean>> = {}
      for (const [kpiId, group] of Object.entries(formulaParamsConfig)) {
        const vals: Record<string, number | boolean> = {}
        for (const p of group.params) { if (p.value !== p.default) vals[p.key] = p.value }
        if (Object.keys(vals).length > 0) paramsPayload[kpiId] = vals
      }
      if (Object.keys(paramsPayload).length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/formula-params`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: paramsPayload }),
        })
      }
      if (benchOverrides.length > 0 || Object.keys(paramsPayload).length > 0) {
        await fetch(`/api/v1/session/${sessionId}/results/apply-formula-overrides`, { method: 'POST' })
      }
      setScreen('results')
      navigate('/results')
    } catch {
      setSaving(false)
    }
  }

  const handleSkip = () => { setScreen('results'); navigate('/results') }

  const grouped = config
    ? config.bucket_order.reduce<Record<string, KpiFormula[]>>((acc, bucket) => {
        const kpis = config.kpis.filter(k => k.bucket === bucket)
        if (kpis.length) acc[bucket] = kpis
        return acc
      }, {})
    : {}

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw size={32} className="text-brand-purple animate-spin mb-3" />
        <p className="text-brand-dark font-medium">Loading formula configuration…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 space-y-3">
        <AlertTriangle size={36} className="text-amber-500" />
        <p className="text-red-600 font-semibold">{error}</p>
        <button onClick={handleSkip} className="text-brand-purple text-sm hover:underline">Skip to Results →</button>
      </div>
    )
  }

  const totalChanges = overrideCount + paramChangeCount

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="page-header rounded-xl px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-xl">Formula Review</h2>
            <p className="text-white/70 text-sm mt-1">
              Review KPI formulas and benchmarks before viewing results.
              <strong className="text-white/90"> Calculation parameters</strong> (sliders) re-compute raw values.
              <strong className="text-white/90"> Benchmark changes</strong> re-score the 1–4 ratings.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-white/60 text-xs">Step 6 of 6</p>
            <p className="text-white font-bold text-sm mt-0.5">Pre-Results</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
          <SlidersHorizontal size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Calculation Parameters</p>
            <p className="text-amber-700">Change how KPI values are computed from raw data (e.g. outlier trim, grace period).</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
          <Pencil size={13} className="text-brand-purple flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-purple">Benchmarks</p>
            <p className="text-purple-700">Change the reference target that determines the 1–4 maturity score.</p>
          </div>
        </div>
      </div>

      {totalChanges > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-purple-50 border border-brand-purple/30 rounded-xl px-4 py-3">
          <CheckCircle2 size={15} className="text-brand-purple flex-shrink-0" />
          <p className="text-sm text-brand-purple font-medium flex-1">
            {paramChangeCount > 0 && `${paramChangeCount} parameter${paramChangeCount !== 1 ? 's' : ''} changed (re-computes values)`}
            {paramChangeCount > 0 && overrideCount > 0 && ' · '}
            {overrideCount > 0 && `${overrideCount} benchmark${overrideCount !== 1 ? 's' : ''} overridden (re-scores)`}
          </p>
          <button onClick={() => {
            setOverrides({})
            setFormulaParamsConfig(prev => {
              const reset: typeof prev = {}
              for (const [k, g] of Object.entries(prev)) {
                reset[k] = { ...g, params: g.params.map(p => ({ ...p, value: p.default })) }
              }
              return reset
            })
          }} className="text-xs text-caption hover:text-red-600 transition-colors flex items-center gap-1">
            <RotateCcw size={11} /> Reset all
          </button>
        </motion.div>
      )}

      {Object.entries(grouped).map(([bucket, kpis]) => {
        const isOpen = expandedBuckets[bucket] ?? false
        const modifiedCount = kpis.filter(k =>
          overrides[k.kpi_id] != null ||
          (formulaParamsConfig[k.kpi_id]?.params ?? []).some(p => p.value !== p.default)
        ).length
        return (
          <div key={bucket} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button onClick={() => setExpandedBuckets(prev => ({ ...prev, [bucket]: !prev[bucket] }))}
              className="w-full flex items-center gap-3 px-4 py-3 bg-brand-dark/95 text-white text-left hover:bg-brand-dark transition-colors">
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span className="font-bold text-sm flex-1">{bucket}</span>
              <span className="text-xs opacity-60">{kpis.length} KPI{kpis.length !== 1 ? 's' : ''}</span>
              {modifiedCount > 0 && <span className="text-[10px] bg-brand-purple px-2 py-0.5 rounded-full font-semibold">{modifiedCount} modified</span>}
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="p-4 space-y-3 bg-gray-50/20">
                    {kpis.map(kpi => (
                      <KpiCard key={kpi.kpi_id} kpi={kpi}
                        override={overrides[kpi.kpi_id] ?? null}
                        paramGroup={formulaParamsConfig[kpi.kpi_id] ?? null}
                        onSave={handleSave} onReset={handleReset} onParamChange={handleParamChange} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      <div className="sticky bottom-4 z-10 flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-lg">
        <div>
          <p className="text-sm font-semibold text-brand-dark">
            {totalChanges > 0 ? `${totalChanges} change${totalChanges !== 1 ? 's' : ''} pending` : 'No changes — using defaults'}
          </p>
          <p className="text-xs text-caption mt-0.5">
            {totalChanges > 0 ? 'Applying will re-compute KPI values and re-score results.' : 'Expand any bucket to review or adjust formulas and parameters.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSkip} className="text-sm text-caption hover:text-brand-dark transition-colors px-3 py-2">Skip</button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex items-center gap-2 bg-brand-purple text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {totalChanges > 0 ? 'Apply & View Results' : 'View Results'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
