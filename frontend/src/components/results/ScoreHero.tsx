import { motion } from 'framer-motion'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import ScoreGauge from '@/components/ui/ScoreGauge'
import { scoreBg } from '@/lib/utils'
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
  const scoreEyebrow = kpiAssessment ? 'KPI score' : 'Overall score'

  const computedKpis = kpiAssessment?.computed_kpis?.length ?? 0
  const totalKpis = 8
  const kpiCoverage = kpiAssessment ? `${computedKpis} / ${totalKpis}` : '—'

  const stripMetrics = isProcurement && kpiAssessment
    ? [
        { label: 'KPIs computed',  value: kpiCoverage },
        { label: 'KPI coverage',   value: `${Math.round((computedKpis / totalKpis) * 100)}%` },
        { label: 'Maturity level', value: primaryLabel || '—' },
      ]
    : [
        { label: 'Dimensions scored', value: `${overall.scored_dims} / ${overall.total_dims}` },
        { label: 'Active weight',     value: `${overall.active_weight_pct?.toFixed(0)}%` },
        { label: 'Maturity level',    value: overall.level || '—' },
      ]

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="acc-card px-6 py-6">
        <div className="flex items-center justify-between flex-wrap gap-6">
          <div>
            <p className="eyebrow mb-2">{clientName}</p>
            <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-neutral-900 m-0">
              {isProcurement ? 'Procurement KPI assessment' : 'Maturity assessment results'}
            </h1>
            {primaryLabel && (
              <p className="text-[13px] text-neutral-500 mt-1.5">{LEVEL_DESC[primaryLabel] || primaryLabel}</p>
            )}
          </div>

          <div className="text-center relative flex flex-col items-center">
            <p className="eyebrow mb-2">{scoreEyebrow}</p>
            <div className="relative w-40 h-40 flex items-center justify-center">
              <ScoreGauge score={primaryScore ?? 0} size={160} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="num text-[40px] font-semibold text-neutral-900 leading-none tracking-[-0.02em]">
                  <AnimatedCounter target={primaryScore ?? 0} decimals={1} />
                </div>
                <span className="text-[10px] font-medium text-neutral-500 tracking-widest mt-1.5 uppercase">out of 4</span>
              </div>
            </div>
            <span className={`score-badge mt-2 text-xs px-3 py-1 ${scoreBg(primaryScore)}`}>
              {primaryLabel || '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {stripMetrics.map(m => (
          <div key={m.label} className="acc-card py-3 text-center">
            <p className="eyebrow">{m.label}</p>
            <p className="text-[18px] font-semibold text-neutral-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
