import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Zap, Loader2, AlertCircle, Briefcase, Calculator, ChevronDown, ChevronUp, Bot } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatIndianInt } from '@/lib/utils'

interface UseCase {
  title: string
  description: string
  relevant_kpis: string[]
  maturity_required: string
  effort: string
  benefit: string
  is_relevant?: boolean
}

interface AgentProfile {
  id: string
  name: string
  phase: string
  edge: string
  complexity: string
  fte_automation_pct: number
  tat_reduction_pct: number
  linked_kpis: string[]
}

interface BusinessCaseResult {
  agent_id: string
  agent_name: string
  phase: string
  edge: string
  complexity: string
  inputs: {
    fte_count: number
    tx_per_month: number
    cost_per_fte_lakhs: number
    hours_per_tx: number
  }
  results: {
    annual_transactions: number
    total_manual_hours_pa: number
    hours_saved_pa: number
    fte_equivalent_saved: number
    cost_saving_cr: number
    tat_reduction_pct: number
    fte_automation_pct: number
  }
  kpis_addressed: string[]
  narrative: string
}

interface Props { sessionId: string }

const EFFORT_COLOR: Record<string, string> = {
  Low:    'bg-success-soft text-success-fg border-success/20',
  Medium: 'bg-warning-soft text-warning-fg border-warning/20',
  High:   'bg-danger-soft  text-danger-fg  border-danger/20',
}
const MATURITY_COLOR: Record<string, string> = {
  Foundation:   'bg-danger-soft  text-danger-fg',
  Intermediate: 'bg-warning-soft text-warning-fg',
  Advanced:     'bg-info-soft    text-info-fg',
  Leading:      'bg-success-soft text-success-fg',
}


// ── Agent business-case calculator card ──────────────────────────────────────
function AgentCard({ agent, sessionId }: { agent: AgentProfile; sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [inputs, setInputs] = useState({
    fte_count: 5, tx_per_month: 1000, cost_per_fte_lakhs: 12, hours_per_tx: 0.25,
  })
  const [result, setResult] = useState<BusinessCaseResult | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState('')

  const compute = async () => {
    setComputing(true); setError('')
    try {
      const r = await fetch(`/api/v1/session/${sessionId}/ai-usecases/business-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id, ...inputs }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
        throw new Error(j.detail || 'Business-case failed')
      }
      setResult(await r.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="acc-card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-md bg-accent-50 text-accent flex items-center justify-center flex-shrink-0">
          <Bot size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[14px] text-neutral-900">{agent.name}</p>
            <span className="text-[11px] text-neutral-500">{agent.phase}</span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border',
              EFFORT_COLOR[agent.complexity] || 'border-neutral-200 text-neutral-700')}>
              {agent.complexity} complexity
            </span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-0.5 line-clamp-1">{agent.edge}</p>
        </div>
        {open
          ? <ChevronUp   size={14} className="text-neutral-400 mt-2 flex-shrink-0" />
          : <ChevronDown size={14} className="text-neutral-400 mt-2 flex-shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-neutral-150"
          >
            <div className="p-4 space-y-3">
              <p className="text-[13px] text-neutral-700 leading-relaxed">{agent.edge}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'fte_count',          label: 'FTEs on task',     suffix: '',       step: 0.5,  min: 0.5 },
                  { key: 'tx_per_month',       label: 'Tx / month',       suffix: '',       step: 100,  min: 10  },
                  { key: 'cost_per_fte_lakhs', label: '₹L per FTE / yr',  suffix: 'L',      step: 1,    min: 1   },
                  { key: 'hours_per_tx',       label: 'Manual hrs / tx',  suffix: 'h',      step: 0.05, min: 0.05 },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] text-neutral-500 font-medium">{f.label}</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number" min={f.min} step={f.step}
                        value={inputs[f.key as keyof typeof inputs]}
                        onChange={(e) => setInputs(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                        className="input flex-1 text-right num"
                      />
                      {f.suffix && <span className="text-[11px] text-neutral-500">{f.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button onClick={compute} disabled={computing} className="btn btn-pri">
                  {computing
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Calculator size={13} />}
                  Compute business case
                </button>
              </div>

              {error && (
                <div className="px-3 py-2 bg-danger-soft text-danger-fg text-[12px] rounded-sm">{error}</div>
              )}

              {result && (
                <div className="rounded-md border border-neutral-150 bg-neutral-50 p-3 space-y-3">
                  <p className="text-[13px] text-neutral-700 leading-relaxed">{result.narrative}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Hours saved / yr',    value: formatIndianInt(result.results.hours_saved_pa) + ' h' },
                      { label: 'FTE equivalent',      value: result.results.fte_equivalent_saved.toFixed(2) },
                      { label: 'Cost saving / yr',    value: '₹' + result.results.cost_saving_cr + ' Cr' },
                      { label: 'TAT reduction',       value: result.results.tat_reduction_pct + '%' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-sm border border-neutral-150 px-2.5 py-2">
                        <p className="eyebrow">{s.label}</p>
                        <p className="num text-[16px] font-semibold text-neutral-900 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {result.kpis_addressed && result.kpis_addressed.length > 0 && (
                    <div>
                      <p className="eyebrow mb-1">Addresses these gap KPIs in your assessment</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.kpis_addressed.map(k => (
                          <span key={k} className="text-[11px] bg-accent-50 text-accent-700 border border-accent-100 px-2 py-0.5 rounded-sm font-medium">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


export default function AiUsecasesTab({ sessionId }: Props) {
  const [cases, setCases] = useState<UseCase[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getAiUsecases(sessionId).then((r: any) => r.use_cases || []).catch(() => []),
      fetch('/api/v1/ai-usecases/agents').then(r => r.json()).then(j => j.agents || []).catch(() => []),
    ]).then(([cs, ag]) => {
      if (cancelled) return
      setCases(cs); setAgents(ag); setLoading(false)
    }).catch((e: any) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="animate-spin text-accent" size={24} />
    </div>
  )

  if (error) return (
    <div className="acc-card text-center py-6">
      <AlertCircle size={24} className="text-danger mx-auto mb-2" />
      <p className="text-[13px] text-danger-fg">{error}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="agent-surface rounded-md px-4 py-3 flex items-start gap-3">
        <Sparkles size={16} className="text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-neutral-900">Agentic AI &amp; use-case library</p>
          <p className="text-[12px] text-neutral-700 mt-0.5">
            Use-cases curated from the procurement reference library, mapped to your assessment gaps.
            Click any agent to compute a quantified business case for your engagement.
          </p>
        </div>
      </div>

      {/* Top: agent business-case cards */}
      {agents.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Agents · click to compute business case</p>
          <div className="space-y-2">
            {agents.map(a => (
              <AgentCard key={a.id} agent={a} sessionId={sessionId} />
            ))}
          </div>
        </div>
      )}

      {/* Bottom: legacy use-cases catalogue (still useful as a flat list) */}
      {cases.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Use-case library</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cases.map((uc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn('acc-card p-4', uc.is_relevant && 'border-accent/40 bg-accent-50/20')}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-9 h-9 rounded-md bg-accent-50 text-accent flex items-center justify-center flex-shrink-0">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-neutral-900">{uc.title}</p>
                    {uc.is_relevant && (
                      <span className="text-[11px] uppercase font-semibold tracking-wide text-accent">
                        ★ Relevant
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-neutral-500 leading-relaxed mb-3">{uc.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {uc.relevant_kpis.map(k => (
                    <span key={k} className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-sm font-mono">{k}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-neutral-150">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-sm border', EFFORT_COLOR[uc.effort] || 'border-neutral-200 text-neutral-700')}>
                    {uc.effort} effort
                  </span>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-sm', MATURITY_COLOR[uc.maturity_required] || 'bg-neutral-100 text-neutral-700')}>
                    {uc.maturity_required}+
                  </span>
                  <span className="text-[11px] text-success-fg flex items-center gap-1 ml-auto">
                    <Zap size={11} /> {uc.benefit}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
