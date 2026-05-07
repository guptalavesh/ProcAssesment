import { motion } from 'framer-motion'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import ScoreGauge from '@/components/ui/ScoreGauge'
import type { OverallResult, KPIAssessmentResult } from '@/lib/types'

interface Props {
  overall: OverallResult
  kpiAssessment: KPIAssessmentResult | null
  clientName: string
  isProcurement?: boolean
}

const LEVEL_DESC: Record<string, string> = {
  Foundation:    'Reactive, manual, limited visibility',
  Intermediate:  'Some standardisation, partial system enablement',
  Advanced:      'Structured, proactive, good system adoption',
  Leading:       'Best-in-class, predictive, digital-first',
}

export default function ScoreHero({ overall, kpiAssessment, clientName, isProcurement = false }: Props) {
  const primaryScore = kpiAssessment ? kpiAssessment.overall_score : overall.score
  const primaryLabel = kpiAssessment ? kpiAssessment.overall_label : overall.level
  const scoreEyebrow = kpiAssessment ? 'KPI Score' : 'Overall Score'

  const computedKpis = kpiAssessment?.computed_kpis?.length ?? 0
  const totalKpis = 8
  const kpiCoverage = kpiAssessment ? `${computedKpis} / ${totalKpis}` : '—'

  const stripMetrics = isProcurement && kpiAssessment
    ? [
        { label: 'KPIs Computed',  value: kpiCoverage },
        { label: 'KPI Coverage',   value: `${Math.round((computedKpis / totalKpis) * 100)}%` },
        { label: 'Maturity Level', value: primaryLabel || '—' },
      ]
    : [
        { label: 'Dimensions Scored', value: `${overall.scored_dims} / ${overall.total_dims}` },
        { label: 'Active Weight',     value: `${overall.active_weight_pct?.toFixed(0)}%` },
        { label: 'Maturity Level',    value: overall.level || '—' },
      ]

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-semibold mb-1">{clientName}</p>
            <h1 className="text-white text-2xl font-bold m-0">
              {isProcurement ? 'Procurement KPI Assessment' : 'Maturity Assessment Results'}
            </h1>
            {primaryLabel && (
              <p className="text-white/80 text-sm mt-1">{LEVEL_DESC[primaryLabel] || primaryLabel}</p>
            )}
          </div>

          <div className="text-center relative flex flex-col items-center">
            <p className="text-white/70 text-[11px] uppercase tracking-[0.2em] font-bold mb-2">
              {scoreEyebrow}
            </p>
            <div className="relative w-40 h-40 flex items-center justify-center">
              <ScoreGauge score={primaryScore ?? 0} size={160} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[40px] font-black text-white leading-none tracking-tight">
                  <AnimatedCounter target={primaryScore ?? 0} decimals={0} />
                </div>
                <span className="text-[10px] font-semibold text-white/65 tracking-widest mt-1.5">OUT OF 4</span>
              </div>
            </div>
            <div className="mt-2 inline-block px-3.5 py-1 rounded-md text-xs font-bold tracking-wide"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {primaryLabel || '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {stripMetrics.map(m => (
          <div key={m.label} className="acc-card py-3 text-center">
            <p className="text-xs text-caption uppercase tracking-wide">{m.label}</p>
            <p className="text-lg font-bold text-brand-dark mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
