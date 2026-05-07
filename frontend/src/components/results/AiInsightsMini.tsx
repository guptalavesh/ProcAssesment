import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Zap, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAssessmentStore, type AiContext } from '@/store/assessmentStore'

interface AiInsightsMiniProps {
  sessionId: string
  context: AiContext
  onKpiClick?: (kpiName: string) => void
}

interface KpiOverviewInsights {
  headline: string
  top_performers: { kpi: string; insight: string }[]
  urgent_gaps: { kpi: string; root_cause: string; fix: string }[]
  '30_day_priorities': string[]
  source: string
}

interface RcaInsights {
  rca_summary: string
  root_causes: { issue: string; evidence: string; intervention: string; urgency: string }[]
  intervention_priority: { area: string; rationale: string; expected_impact: string }[]
  source: string
}

interface OfferingsInsights {
  recommendation_summary: string
  top_offerings: { offering: string; priority: string; rationale: string; kpi_links: string[]; expected_benefit: string }[]
  quick_start: string
  source: string
}

const CONTEXT_LABELS: Record<AiContext, string> = {
  kpi_overview: 'KPI Commentary',
  rca:          'Root Cause Analysis',
  offerings:    'Offering Recommendations',
}

const urgencyColor = (u: string) =>
  u === 'High' ? 'bg-red-50 border-red-200 text-red-800'
  : u === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-800'
  : 'bg-bg-secondary/40 border-bg-secondary text-black/70'

function KpiChip({ name, onClick, tone = 'neutral' }: { name: string; onClick?: () => void; tone?: 'red' | 'green' | 'neutral' }) {
  const toneCls =
    tone === 'red'   ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
    : tone === 'green' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
    : 'bg-purple-50 text-brand-purple border-purple-200 hover:bg-purple-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors',
        toneCls,
        onClick && 'cursor-pointer underline-offset-2 hover:underline',
        !onClick && 'cursor-default opacity-90'
      )}
      title={onClick ? `Filter table to ${name}` : name}
    >
      {name}
    </button>
  )
}

function KpiOverviewContent({ data, onKpiClick }: { data: KpiOverviewInsights; onKpiClick?: (k: string) => void }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.headline}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertTriangle size={10} /> Urgent Gaps
          </p>
          <div className="space-y-2">
            {data.urgent_gaps?.map((g, i) => (
              <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <KpiChip name={g.kpi} tone="red" onClick={onKpiClick ? () => onKpiClick(g.kpi) : undefined} />
                <p className="text-[11px] text-red-700 mt-1.5">{g.root_cause}</p>
                <p className="text-[10px] text-red-600 mt-1 flex items-start gap-1">
                  <ArrowRight size={9} className="flex-shrink-0 mt-0.5" />{g.fix}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
              <CheckCircle size={10} /> Strengths
            </p>
            <div className="space-y-1.5">
              {data.top_performers?.map((p, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <KpiChip name={p.kpi} tone="green" onClick={onKpiClick ? () => onKpiClick(p.kpi) : undefined} />
                  <p className="text-[11px] text-green-700 mt-1">{p.insight}</p>
                </div>
              ))}
            </div>
          </div>

          {data['30_day_priorities']?.length > 0 && (
            <div>
              <p className="text-[10px] text-brand-dark font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap size={10} /> 30-Day Priorities
              </p>
              <ul className="space-y-1">
                {data['30_day_priorities'].map((p, i) => (
                  <li key={i} className="text-[11px] text-brand-dark flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-brand-purple/15 text-brand-purple text-[9px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">{i+1}</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RcaContent({ data }: { data: RcaInsights }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.rca_summary}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-2">Root Causes</p>
          <div className="space-y-2">
            {data.root_causes?.map((rc, i) => (
              <div key={i} className={cn('rounded-lg border px-3 py-2', urgencyColor(rc.urgency))}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold">{rc.issue}</p>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border',
                    rc.urgency === 'High' ? 'bg-red-100 border-red-300 text-red-700'
                    : rc.urgency === 'Medium' ? 'bg-amber-100 border-amber-300 text-amber-700'
                    : 'bg-bg-secondary border-bg-secondary text-black/60'
                  )}>{rc.urgency}</span>
                </div>
                <p className="text-[10px] mt-0.5 opacity-80">{rc.evidence}</p>
                <p className="text-[10px] mt-1 font-semibold">→ {rc.intervention}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-brand-dark font-bold uppercase tracking-wide mb-2">Intervention Priority</p>
          <div className="space-y-2">
            {data.intervention_priority?.map((ip, i) => (
              <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-purple text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <p className="text-xs font-bold text-brand-dark">{ip.area}</p>
                </div>
                <p className="text-[10px] text-brand-dark/80 mt-1">{ip.rationale}</p>
                <p className="text-[10px] text-brand-purple mt-0.5 font-medium">{ip.expected_impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function OfferingsContent({ data, onKpiClick }: { data: OfferingsInsights; onKpiClick?: (k: string) => void }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.recommendation_summary}</p>
      <div className="space-y-2">
        <p className="text-[10px] text-brand-purple font-bold uppercase tracking-wide">Top Recommended Offerings</p>
        {data.top_offerings?.map((o, i) => (
          <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-purple text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{o.priority}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-dark">{o.offering}</p>
                <p className="text-[11px] text-black/60 mt-0.5">{o.rationale}</p>
                {o.kpi_links?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {o.kpi_links.map(k => (
                      <KpiChip key={k} name={k} onClick={onKpiClick ? () => onKpiClick(k) : undefined} />
                    ))}
                  </div>
                )}
                {o.expected_benefit && (
                  <p className="text-[10px] text-brand-purple mt-1 font-medium">{o.expected_benefit}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.quick_start && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap size={10} /> Where to Start
          </p>
          <p className="text-xs text-green-800">{data.quick_start}</p>
        </div>
      )}
    </div>
  )
}

export default function AiInsightsMini({ sessionId, context, onKpiClick }: AiInsightsMiniProps) {
  const data = useAssessmentStore((s) => s.aiInsights[context]) as any
  const loading = useAssessmentStore((s) => s.aiLoading[context])
  const error = useAssessmentStore((s) => s.aiError[context])
  const setAiInsight = useAssessmentStore((s) => s.setAiInsight)
  const setAiLoading = useAssessmentStore((s) => s.setAiLoading)
  const setAiError = useAssessmentStore((s) => s.setAiError)
  const [open, setOpen] = useState(false)

  const refresh = async () => {
    setAiLoading(context, true)
    setAiError(context, '')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/ai-tab-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, force_refresh: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || 'Failed')
      }
      const d = await res.json()
      setAiInsight(context, d.insights || d)
    } catch (e: any) {
      setAiError(context, e.message)
    } finally {
      setAiLoading(context, false)
    }
  }

  const isAi = data?.source === 'vertex-gemini'

  const canExpand = !!data || !!error
  const headerCls = cn(
    'w-full flex items-center justify-between px-4 py-2.5 bg-purple-50/60 transition-colors text-left',
    canExpand && 'hover:bg-purple-100/60 cursor-pointer',
    !canExpand && 'cursor-default',
    open && canExpand && 'border-b border-bg-secondary',
  )

  return (
    <div className="bg-white border-l-4 border-l-brand-purple border border-bg-secondary rounded-xl shadow-sm overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        aria-expanded={open}
        aria-label={open ? 'Collapse AI commentary' : 'Expand AI commentary'}
        className={headerCls}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">
            AI {CONTEXT_LABELS[context]}
          </span>
          {data && (
            isAi ? (
              <span className="text-[10px] bg-brand-purple/15 text-brand-purple px-1.5 py-0.5 rounded font-medium">Gemini · grounded</span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">Rule-based</span>
            )
          )}
          {data && !open && (
            <span className="text-[11px] text-caption ml-1">— click to expand</span>
          )}
          {loading && !data && (
            <span className="text-[11px] text-caption ml-1">— generating…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(data || error) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); refresh() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); refresh() } }}
              aria-label="Regenerate AI insights"
              className={cn(
                'text-[11px] text-caption hover:text-brand-purple border border-bg-secondary rounded px-2 py-1 flex items-center gap-1 transition-colors',
                loading && 'opacity-50 pointer-events-none'
              )}
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Refresh
            </span>
          )}
          {canExpand && (
            open
              ? <ChevronUp size={14} className="text-caption" />
              : <ChevronDown size={14} className="text-caption" />
          )}
        </div>
      </button>

      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-start justify-between gap-3">
          <p className="text-xs text-red-700">{error}</p>
          <button
            onClick={refresh}
            className="text-[11px] text-red-700 hover:text-red-900 underline font-semibold whitespace-nowrap"
          >
            Try again
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && data && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {context === 'kpi_overview' && <KpiOverviewContent data={data as KpiOverviewInsights} onKpiClick={onKpiClick} />}
              {context === 'rca'          && <RcaContent data={data as RcaInsights} />}
              {context === 'offerings'    && <OfferingsContent data={data as OfferingsInsights} onKpiClick={onKpiClick} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && !data && (
        <div className="px-4 py-5 space-y-3">
          <div className="h-3 bg-bg-secondary/80 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-bg-secondary/60 rounded animate-pulse w-full" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="h-16 bg-bg-secondary/40 rounded animate-pulse" />
            <div className="h-16 bg-bg-secondary/40 rounded animate-pulse" />
          </div>
          <p className="text-[11px] text-caption flex items-center gap-1.5">
            <Sparkles size={10} className="text-brand-purple animate-pulse" />
            Reading your data and generating commentary…
          </p>
        </div>
      )}
    </div>
  )
}
