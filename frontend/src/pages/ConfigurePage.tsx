import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, CheckCircle, AlertCircle, Loader2, Play, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ConfigureState } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function ConfigurePage() {
  const navigate = useNavigate()
  const { sessionId, isProcurement, setConfigureState, setScreen } = useAssessmentStore()
  const [config, setConfig] = useState<ConfigureState | null>(null)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [includes, setIncludes] = useState<Record<string, boolean>>({})
  const [kpiWeights, setKpiWeights] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    api.getConfigure(sessionId).then(data => {
      setConfig(data)
      setConfigureState(data)
      const w: Record<string, number> = {}
      const inc: Record<string, boolean> = {}
      data.dimensions.forEach((d: any) => { w[d.dim_id] = d.weight; inc[d.dim_id] = true })
      setWeights(w)
      setIncludes(inc)
      if (data.kpi_meta) {
        const kw: Record<string, number> = {}
        Object.entries(data.kpi_meta).forEach(([kid, m]: any) => {
          kw[kid] = parseFloat((m.weight * 100).toFixed(0))
        })
        setKpiWeights(kw)
      }
    }).catch(e => setError(e.message))
  }, [sessionId, setConfigureState])

  const totalWeight = Object.entries(weights).reduce((sum, [id, w]) => sum + (includes[id] ? w : 0), 0)
  const weightOk = Math.abs(totalWeight - 100) < 0.5

  const totalKpiWeight = Object.values(kpiWeights).reduce((s, w) => s + w, 0)
  const kpiWeightOk = Math.abs(totalKpiWeight - 100) < 0.5

  const autoRedistribute = () => {
    const active = Object.keys(includes).filter(id => includes[id])
    if (!active.length) return
    const each = parseFloat((100 / active.length).toFixed(0))
    const newW = { ...weights }
    active.forEach(id => { newW[id] = each })
    setWeights(newW)
  }

  const autoRedistributeKpi = () => {
    const keys = Object.keys(kpiWeights)
    if (!keys.length) return
    const each = parseFloat((100 / keys.length).toFixed(0))
    const newW: Record<string, number> = {}
    keys.forEach(k => { newW[k] = each })
    setKpiWeights(newW)
  }

  const resetKpiWeights = () => {
    if (!config?.kpi_meta) return
    const defaults: Record<string, number> = {
      tat: 25, savings_lpo: 20, spend_per_fte: 15, rc_adoption: 10,
      otd: 10, defect_rate: 10, sourcing_tool: 5, pac_prs: 5,
    }
    const kw: Record<string, number> = {}
    Object.keys(config.kpi_meta).forEach(kid => {
      kw[kid] = defaults[kid] ?? parseFloat((config.kpi_meta![kid].weight * 100).toFixed(0))
    })
    setKpiWeights(kw)
  }

  const handleRun = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      await api.saveConfigure(sessionId, weights, includes, isProcurement ? kpiWeights : undefined)
      await api.triggerRun(sessionId)
      setScreen('running')
      navigate('/running')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!config) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Configure Assessment"
        subtitle={isProcurement ? 'Adjust KPI weights for the 8-KPI procurement model' : 'Adjust dimension weights'}
      />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {isProcurement ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          {config.engagement.fte_count !== null && (
            <p className="text-xs text-caption mb-4">
              FTE: <strong>{config.engagement.fte_count}</strong> · Annual Spend:{' '}
              <strong>₹{config.engagement.annual_spend} Cr</strong> · Industry:{' '}
              <strong>{config.engagement.industry}</strong>
            </p>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-brand-dark">KPI Weights</h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded',
                kpiWeightOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                Total: {totalKpiWeight.toFixed(0)}% {kpiWeightOk ? '✓' : '(must = 100%)'}
              </span>
              <button onClick={autoRedistributeKpi}
                className="text-xs text-brand-purple border border-brand-purple px-2 py-1 rounded hover:bg-bg-secondary transition-colors flex items-center gap-1">
                <RefreshCw size={11} /> Equal
              </button>
              <button onClick={resetKpiWeights}
                className="text-xs text-caption border border-bg-secondary px-2 py-1 rounded hover:bg-bg-secondary transition-colors">
                Reset
              </button>
            </div>
          </div>

          {Object.entries(config.buckets ?? {}).map(([bucket, kpiIds]) => (
            <div key={bucket} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-caption">{bucket}</span>
                <div className="flex-1 border-t border-bg-secondary" />
              </div>
              <div className="space-y-3">
                {(kpiIds as string[]).map(kid => {
                  const meta = config.kpi_meta?.[kid]
                  if (!meta) return null
                  const w = kpiWeights[kid] ?? (meta.weight * 100)
                  const hasData = config.data_ready?.[kid]
                  return (
                    <div key={kid} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm font-medium text-brand-dark truncate">{meta.label}</span>
                          {hasData
                            ? <CheckCircle size={12} className="text-green-600 flex-shrink-0" />
                            : <AlertCircle size={12} className="text-orange-500 flex-shrink-0" />}
                          <span className="text-[10px] text-caption ml-auto flex-shrink-0">
                            {meta.direction === 'lower_is_better' ? '↓ Lower better' : '↑ Higher better'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={50} step={1}
                            value={w}
                            onChange={e => setKpiWeights(prev => ({ ...prev, [kid]: parseFloat(e.target.value) }))}
                            className="flex-1 accent-brand-purple h-1.5"
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number" min={0} max={50} step={1}
                              value={w}
                              onChange={e => setKpiWeights(prev => ({ ...prev, [kid]: parseFloat(e.target.value) || 0 }))}
                              className="w-14 border border-bg-secondary rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:border-brand-purple"
                            />
                            <span className="text-xs text-caption">%</span>
                          </div>
                        </div>
                        {config.benchmarks_display?.[kid] && (
                          <p className="text-[10px] text-caption mt-0.5">
                            Benchmark: <span className="font-mono">{config.benchmarks_display[kid]}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand-dark">Dimension Weights</h3>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-bold', weightOk ? 'text-green-700' : 'text-red-600')}>
                Total: {totalWeight.toFixed(0)}% {weightOk ? '✓' : '(must equal 100%)'}
              </span>
              <button onClick={autoRedistribute}
                className="text-xs text-brand-purple border border-brand-purple px-2 py-1 rounded hover:bg-bg-secondary transition-colors">
                Auto-redistribute
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {config.dimensions.map((dim) => (
              <div key={dim.dim_id} className="flex items-center gap-3 py-1.5 border-b border-bg-secondary/50">
                <input type="checkbox" checked={includes[dim.dim_id] ?? true}
                  onChange={e => setIncludes(prev => ({ ...prev, [dim.dim_id]: e.target.checked }))}
                  className="accent-brand-purple" />
                <span className="text-xs font-medium w-8 text-caption">{dim.dim_id}</span>
                <span className="text-sm flex-1">{dim.name}</span>
                <span className="text-xs text-caption">{dim.kpi_count} KPI{dim.kpi_count !== 1 ? 's' : ''}</span>
                <input type="number" min={0} max={100} step={0.1}
                  value={weights[dim.dim_id] ?? dim.weight}
                  onChange={e => setWeights(prev => ({ ...prev, [dim.dim_id]: parseFloat(e.target.value) || 0 }))}
                  disabled={!includes[dim.dim_id]}
                  className="w-16 border border-bg-secondary rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-brand-purple disabled:opacity-40" />
                <span className="text-xs text-caption">%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button onClick={() => { setScreen('upload'); navigate('/upload') }}
          className="flex items-center gap-2 border border-bg-secondary text-brand-dark px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={handleRun}
          disabled={loading || (isProcurement ? !kpiWeightOk : !weightOk)}
          className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run Assessment
        </button>
      </div>
    </div>
  )
}
