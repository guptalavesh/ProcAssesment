import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DimensionResult } from '@/lib/types'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { cn, scoreBg } from '@/lib/utils'

interface Props { dims: DimensionResult[] }

export default function DimensionsTab({ dims }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {dims.map((dim, i) => (
        <motion.div key={dim.dim_id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="border border-bg-secondary rounded overflow-hidden">
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary/30 transition-colors text-left"
            onClick={() => setOpen(open === dim.dim_id ? null : dim.dim_id)}>
            <span className="text-xs font-bold text-caption w-8">{dim.dim_id}</span>
            <span className="flex-1 text-sm font-semibold text-black">{dim.name}</span>
            <ScoreBadge score={dim.score_display} label={dim.level ?? undefined} />
            <span className="text-xs text-caption ml-2">{(dim.weight * 100).toFixed(0)}%</span>
            {open === dim.dim_id ? <ChevronUp size={16} className="text-caption" /> : <ChevronDown size={16} className="text-caption" />}
          </button>

          <AnimatePresence>
            {open === dim.dim_id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }} className="border-t border-bg-secondary overflow-hidden">
                <div className="p-4 bg-white">
                  <p className="text-xs text-caption mb-3 italic">{dim.rationale}</p>

                  {Object.values(dim.kpi_scores).length > 0 && (
                    <table className="w-full acc-table text-xs mb-3">
                      <thead><tr><th>KPI</th><th>Value</th><th>Score</th><th>Status</th></tr></thead>
                      <tbody>
                        {Object.values(dim.kpi_scores).map(kpi => (
                          <tr key={kpi.kpi_id}>
                            <td>{kpi.label}</td>
                            <td className="font-mono">{kpi.value !== null ? `${kpi.value?.toFixed?.(2) ?? kpi.value} ${kpi.unit}` : '—'}</td>
                            <td><span className={cn('score-badge', scoreBg(kpi.score), 'text-xs')}>{kpi.score ?? '—'}</span></td>
                            <td className="text-caption">{kpi.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {dim.evidence.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-bold text-brand-dark mb-1">Evidence</p>
                      <ul className="space-y-0.5">
                        {dim.evidence.filter(Boolean).map((e, i) => (
                          <li key={i} className="text-xs text-black flex gap-1.5"><span className="text-brand-purple">•</span>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dim.gaps.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-brand-dark mb-1">Key Gaps</p>
                      <ul className="space-y-0.5">
                        {dim.gaps.map((g, i) => (
                          <li key={i} className="text-xs text-black flex gap-1.5"><span className="text-orange-500">→</span>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}
