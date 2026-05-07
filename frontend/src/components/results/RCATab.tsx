import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, GitBranch, DollarSign, Cpu, Users2, GraduationCap,
  ChevronDown, ChevronUp, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIAssessmentResult } from '@/lib/types'

interface RCARow {
  kpi: string
  root_cause: string
  child_kpi?: string
  op_model?: string
  process?: string
  category?: string
  tech?: string
  srm?: string
  capability?: string
  benefit?: string
}

const INTERVENTIONS: {
  key: keyof Omit<RCARow, 'kpi' | 'root_cause' | 'child_kpi' | 'benefit'>
  label: string
  Icon: LucideIcon
  text: string
  border: string
  lightBg: string
}[] = [
  { key: 'op_model',   label: 'Operating Model',   Icon: Building2,    text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'process',    label: 'Process',           Icon: GitBranch,    text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'category',   label: 'Category Strategy', Icon: DollarSign,   text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'tech',       label: 'Tech & AI',         Icon: Cpu,          text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
  { key: 'srm',        label: 'SRM',               Icon: Users2,       text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
  { key: 'capability', label: 'Capability',        Icon: GraduationCap, text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
]

const RCA_DATA: RCARow[] = [
  { kpi: 'TAT', root_cause: 'Procurement team capacity is insufficient relative to transaction volumes, creating backlogs and extending cycle times.', child_kpi: 'Procurement Spend/FTE',
    op_model: 'Org structure to be reviewed and right-sized — recruit, redeploy, or restructure based on workload analysis.',
    capability: 'Structured onboarding and upskilling programme for new and existing procurement staff.',
    benefit: 'Right-sizing team capacity reduces average TAT and improves throughput per procurement FTE.' },
  { kpi: 'TAT', root_cause: 'Multi-tiered approval structures create bottlenecks in the sourcing cycle.',
    op_model: 'Delegation of Powers to be simplified — rationalise approval layers.',
    tech: 'System-enable parallel approval workflows in the digital procurement platform.',
    benefit: 'Rationalising and digitising the approval chain accelerates the award cycle.' },
  { kpi: 'TAT', root_cause: 'Incomplete or poorly defined purchase requisitions drive significant rework.',
    tech: 'AI-enabled PR validation at point of creation: completeness checks, open inventory alerts, SoW validation, material group accuracy, duplicate PR detection.',
    benefit: 'Higher-quality requisitions reduce rework in the sourcing cycle.' },
  { kpi: 'TAT', root_cause: 'Absence of a maintained Approved Supplier List makes vendor identification time-intensive.',
    op_model: 'Formalise a Supplier Relationship Management function.',
    tech: 'Vendor shortlisting driven by internal and external intelligence — prior OTD, quality, technical capability, financials.',
    srm: 'Approved Supplier List to be established, segmented by category, and kept current through periodic review.',
    benefit: 'A structured approved supplier base accelerates vendor shortlisting.' },
  { kpi: 'RC Adoption %', root_cause: 'Category-level buying channel analysis has not been conducted.',
    op_model: 'Category channel analysis to be made a formal KRA.',
    category: 'Appropriate buying channel defined for each category — rate contract, ASL, catalogue, or open market.',
    benefit: 'Channel optimisation significantly reduces TAT and administrative overhead.' },
  { kpi: 'RC Adoption %', root_cause: 'Negotiated contracts are not system-enabled.',
    op_model: 'All active contracts to be loaded and maintained in the procurement system.',
    tech: 'Rate Contracts and Catalogues enabled in the digital procurement platform for direct order creation.',
    benefit: 'System-enabled contracts allow buyers to raise POs in minutes and eliminate maverick spend.' },
  { kpi: 'Savings over LPO', root_cause: 'Buyers lack the category intelligence and market benchmarks needed to negotiate effectively.',
    category: 'Category-focused structure to enable targeted market analysis and negotiation strategy.',
    tech: 'AI assistance in collating last-price-paid history, vendor bid behaviour, and category price movement.',
    benefit: 'Category-intelligent buyers deliver consistently stronger savings outcomes.' },
  { kpi: 'Savings over LPO', root_cause: 'Last price paid is not systematically applied as a negotiation benchmark.',
    tech: 'System-based last-price-paid tracking with automated deviation alerts at PO creation.',
    benefit: 'Systematic LPO benchmarking prevents price drift.' },
  { kpi: 'Supplier On-time Delivery Rate', root_cause: 'Vendor performance is not formally measured through scorecards.',
    op_model: 'Vendor performance tracking dashboards established; ownership assigned within procurement.',
    srm: 'Structured supplier rating mechanism with periodic vendor scorecards and performance improvement plans.',
    benefit: 'Scorecard-driven supplier management improves delivery reliability.' },
  { kpi: 'Supplier Defect Rate', root_cause: 'Absence of regular vendor assessments and structured development programmes.',
    srm: 'Structured supplier rating mechanism, vendor scorecards, and formal vendor development programmes.',
    benefit: 'Structured vendor development progressively improves quality compliance and reduces defect rates.' },
  { kpi: 'Sourcing Tool Usage Rate', root_cause: 'Procurement staff have not received adequate training on digital sourcing tools.',
    capability: 'Structured procurement tool training programme to be developed and rolled out across all buyer grades.',
    benefit: 'Higher tool adoption reduces manual effort and improves data completeness.' },
  { kpi: 'Single-Source Vendors PRs', root_cause: 'Operational urgency overrides competitive sourcing requirements.',
    process: 'PR raising process to mandate competitive sourcing for non-emergency PRs above a threshold.',
    op_model: 'Define exception approval pathways for genuine emergency procurement.',
    benefit: 'Reducing single-source PRs improves price discovery and savings outcomes.' },
]

interface Props {
  kpiAssessment: KPIAssessmentResult | null
  activeBucket?: string | null
}

export default function RCATab({ kpiAssessment, activeBucket }: Props) {
  const [openInterventions, setOpenInterventions] = useState<Record<string, string | null>>({})
  const [openKpis, setOpenKpis] = useState<Set<string>>(new Set())

  const allKpis = kpiAssessment ? Object.values(kpiAssessment.kpi_results) : []
  const gapKpis = activeBucket
    ? allKpis.filter(k => k.bucket === activeBucket && k.has_gap)
    : allKpis.filter(k => k.has_gap)

  const grouped: Record<string, RCARow[]> = {}
  for (const row of RCA_DATA) {
    if (!grouped[row.kpi]) grouped[row.kpi] = []
    grouped[row.kpi].push(row)
  }

  const visibleKpiNames = gapKpis.length > 0
    ? gapKpis.map(k => k.label).filter(name => grouped[name])
    : Object.keys(grouped)

  if (visibleKpiNames.length === 0) {
    return (
      <div className="acc-card text-center py-8">
        <p className="text-caption text-sm">No gap KPIs to analyse{activeBucket ? ` in "${activeBucket}"` : ''}.</p>
      </div>
    )
  }

  const toggleKpi = (k: string) => {
    setOpenKpis(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {visibleKpiNames.map(kpiName => {
        const rows = grouped[kpiName] || []
        const isOpen = openKpis.has(kpiName)
        return (
          <div key={kpiName} className="acc-card overflow-hidden p-0">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary/60 hover:bg-bg-secondary transition-colors text-left"
              onClick={() => toggleKpi(kpiName)}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
                <span className="text-sm font-bold text-brand-dark">{kpiName}</span>
                <span className="text-xs text-caption">{rows.length} root cause{rows.length !== 1 ? 's' : ''}</span>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    {rows.map((row, i) => {
                      const interventionsKey = `${kpiName}-${i}`
                      const openIntervention = openInterventions[interventionsKey]
                      return (
                        <div key={i} className="border border-bg-secondary rounded-lg p-3 bg-white">
                          <p className="text-sm font-semibold text-brand-dark mb-1">{row.root_cause}</p>
                          {row.child_kpi && <p className="text-[11px] text-caption mb-2">Linked KPI: <span className="font-mono">{row.child_kpi}</span></p>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {INTERVENTIONS.filter(int => row[int.key]).map(int => {
                              const isActive = openIntervention === int.key
                              return (
                                <button key={int.key}
                                  onClick={() => setOpenInterventions(prev => ({
                                    ...prev,
                                    [interventionsKey]: prev[interventionsKey] === int.key ? null : int.key,
                                  }))}
                                  className={cn(
                                    'flex items-center gap-1 text-[10px] px-2 py-1 rounded border font-semibold transition-colors',
                                    isActive ? `${int.lightBg} ${int.text} ${int.border}` : 'bg-white text-caption border-bg-secondary hover:border-brand-purple',
                                  )}
                                >
                                  <int.Icon size={10} /> {int.label}
                                </button>
                              )
                            })}
                          </div>
                          {openIntervention && row[openIntervention] && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('mt-2 p-2 rounded text-xs',
                              INTERVENTIONS.find(i => i.key === openIntervention)?.lightBg)}>
                              {row[openIntervention]}
                            </motion.div>
                          )}
                          {row.benefit && (
                            <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded p-2">
                              <span className="font-semibold">Expected benefit: </span>{row.benefit}
                            </p>
                          )}
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
    </div>
  )
}
