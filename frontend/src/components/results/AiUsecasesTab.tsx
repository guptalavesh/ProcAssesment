import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap, Loader2, AlertCircle, Briefcase } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface UseCase {
  title: string
  description: string
  relevant_kpis: string[]
  maturity_required: string
  effort: string
  benefit: string
  is_relevant?: boolean
}

interface Props { sessionId: string }

const EFFORT_COLOR: Record<string, string> = {
  Low:    'bg-green-100 text-green-700 border-green-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  High:   'bg-red-100 text-red-700 border-red-200',
}

const MATURITY_COLOR: Record<string, string> = {
  Foundation:   'bg-red-50 text-red-700',
  Intermediate: 'bg-orange-50 text-orange-700',
  Advanced:     'bg-blue-50 text-blue-700',
  Leading:      'bg-green-50 text-green-700',
}

export default function AiUsecasesTab({ sessionId }: Props) {
  const [cases, setCases] = useState<UseCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAiUsecases(sessionId)
      .then((res: any) => setCases(res.use_cases || []))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="animate-spin text-brand-purple" size={24} />
    </div>
  )

  if (error) return (
    <div className="acc-card text-center py-6">
      <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="acc-card bg-accent-50/40 border-brand-purple/30">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-brand-purple" />
          <p className="text-sm font-bold text-brand-dark">Agentic AI &amp; Use-Case Library</p>
        </div>
        <p className="text-xs text-caption">
          AI use-cases curated from Accenture's procurement reference library.
          Items flagged "Relevant" map to gaps surfaced in your assessment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cases.map((uc, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn('acc-card p-4', uc.is_relevant && 'border-brand-purple/40 bg-accent-50/20')}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-purple/10 flex items-center justify-center">
                  <Briefcase size={16} className="text-brand-purple" />
                </div>
                <div>
                  <p className="font-bold text-sm text-brand-dark">{uc.title}</p>
                  {uc.is_relevant && (
                    <span className="text-[10px] uppercase font-bold tracking-wide text-brand-purple">
                      ★ Relevant to your assessment
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-caption leading-relaxed mb-3">{uc.description}</p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {uc.relevant_kpis.map(k => (
                <span key={k} className="text-[10px] bg-bg-secondary text-brand-dark px-2 py-0.5 rounded font-mono">{k}</span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-bg-secondary">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', EFFORT_COLOR[uc.effort] || 'bg-bg-muted text-caption')}>
                {uc.effort} effort
              </span>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', MATURITY_COLOR[uc.maturity_required] || 'bg-bg-muted text-caption')}>
                {uc.maturity_required}+
              </span>
              <span className="text-[10px] text-green-700 flex items-center gap-1 ml-auto">
                <Zap size={10} /> {uc.benefit}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
