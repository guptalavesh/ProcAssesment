import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, GitBranch, DollarSign, Cpu, Users2, GraduationCap,
  ChevronDown, ChevronUp, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIAssessmentResult } from '@/lib/types'

interface RCARow {
  kpi_id: string             // engine KPI id (matches kpi_engine.KPI_META)
  kpi_label: string          // human-readable for display
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
  key: keyof Omit<RCARow, 'kpi_id' | 'kpi_label' | 'root_cause' | 'child_kpi' | 'benefit'>
  label: string
  Icon: LucideIcon
}[] = [
  { key: 'op_model',   label: 'Operating model',   Icon: Building2 },
  { key: 'process',    label: 'Process',           Icon: GitBranch },
  { key: 'category',   label: 'Category strategy', Icon: DollarSign },
  { key: 'tech',       label: 'Tech & AI',         Icon: Cpu },
  { key: 'srm',        label: 'SRM',               Icon: Users2 },
  { key: 'capability', label: 'Capability',        Icon: GraduationCap },
]

// ── RCA catalogue keyed by engine KPI id (kpi_engine.KPI_META). ───────────────
//
// The Results page passes us the kpi_assessment from the backend; we read each
// KPIResult's kpi_id (e.g. "tat_pr_to_po") to look up matching root causes.
// Previously this table was keyed by display label ("TAT", "RC Adoption %"),
// which never matched the engine's labels ("PR-to-PO turnaround", "Rate-
// contract adoption (volume)") — so the filter dropped every row and the page
// rendered "No gap KPIs to analyse".
const RCA_DATA: RCARow[] = [
  // ── tat_pr_to_po ────────────────────────────────────────────────────────
  { kpi_id: 'tat_pr_to_po', kpi_label: 'PR-to-PO TAT',
    root_cause: 'Procurement team capacity is insufficient relative to transaction volumes, creating backlogs and extending cycle times.',
    child_kpi: 'Procurement Spend / FTE',
    op_model: 'Org structure to be reviewed and right-sized — recruit, redeploy, or restructure based on workload analysis.',
    capability: 'Structured onboarding and upskilling programme for new and existing procurement staff.',
    benefit: 'Right-sizing team capacity reduces average TAT and improves throughput per procurement FTE.' },
  { kpi_id: 'tat_pr_to_po', kpi_label: 'PR-to-PO TAT',
    root_cause: 'Multi-tiered approval structures create bottlenecks in the sourcing cycle.',
    op_model: 'Delegation of Powers to be simplified — rationalise approval layers.',
    tech: 'System-enable parallel approval workflows in the digital procurement platform.',
    benefit: 'Rationalising and digitising the approval chain accelerates the award cycle.' },
  { kpi_id: 'tat_pr_to_po', kpi_label: 'PR-to-PO TAT',
    root_cause: 'Incomplete or poorly defined purchase requisitions drive significant rework.',
    tech: 'AI-enabled PR validation at point of creation — completeness checks, open-inventory alerts, SoW validation, material-group accuracy, duplicate-PR detection.',
    benefit: 'Higher-quality requisitions reduce rework in the sourcing cycle.' },
  { kpi_id: 'tat_pr_to_po', kpi_label: 'PR-to-PO TAT',
    root_cause: 'Absence of a maintained Approved Supplier List makes vendor identification time-intensive.',
    op_model: 'Formalise a Supplier Relationship Management function.',
    tech: 'Vendor shortlisting driven by internal and external intelligence — prior OTD, quality, technical capability, financials.',
    srm: 'Approved Supplier List to be established, segmented by category, and kept current through periodic review.',
    benefit: 'A structured approved supplier base accelerates vendor shortlisting.' },

  // ── rc_adoption_volume ──────────────────────────────────────────────────
  { kpi_id: 'rc_adoption_volume', kpi_label: 'Rate-contract adoption (volume)',
    root_cause: 'Category-level buying-channel analysis has not been conducted.',
    op_model: 'Category channel analysis to be made a formal KRA.',
    category: 'Appropriate buying channel defined for each category — rate contract, ASL, catalogue, or open market.',
    benefit: 'Channel optimisation significantly reduces TAT and administrative overhead.' },
  { kpi_id: 'rc_adoption_volume', kpi_label: 'Rate-contract adoption (volume)',
    root_cause: 'Negotiated contracts are not system-enabled — buyers cannot consume them at PO creation.',
    op_model: 'All active contracts to be loaded and maintained in the procurement system.',
    tech: 'Rate Contracts and Catalogues enabled in the digital procurement platform for direct order creation.',
    benefit: 'System-enabled contracts allow buyers to raise POs in minutes and eliminate maverick spend.' },

  // ── otd ─────────────────────────────────────────────────────────────────
  { kpi_id: 'otd', kpi_label: 'Supplier on-time delivery',
    root_cause: 'Vendor performance is not formally measured through scorecards.',
    op_model: 'Vendor performance tracking dashboards established; ownership assigned within procurement.',
    srm: 'Structured supplier rating mechanism with periodic vendor scorecards and performance improvement plans.',
    benefit: 'Scorecard-driven supplier management improves delivery reliability.' },
  { kpi_id: 'otd', kpi_label: 'Supplier on-time delivery',
    root_cause: 'No formal vendor development pipeline for under-performing suppliers.',
    srm: 'Vendor development programme with structured technical assistance, capability building, and joint recovery plans.',
    benefit: 'Active vendor development converts laggards into reliable suppliers.' },

  // ── savings_per_lpo ─────────────────────────────────────────────────────
  { kpi_id: 'savings_per_lpo', kpi_label: 'Savings vs Last PO Price',
    root_cause: 'Buyers lack the category intelligence and market benchmarks needed to negotiate effectively.',
    category: 'Category-focused structure to enable targeted market analysis and negotiation strategy.',
    tech: 'AI assistance in collating last-price-paid history, vendor bid behaviour, and category price movement.',
    benefit: 'Category-intelligent buyers deliver consistently stronger savings outcomes.' },
  { kpi_id: 'savings_per_lpo', kpi_label: 'Savings vs Last PO Price',
    root_cause: 'Last price paid is not systematically applied as a negotiation benchmark.',
    tech: 'System-based last-price-paid tracking with automated deviation alerts at PO creation.',
    benefit: 'Systematic LPO benchmarking prevents price drift.' },

  // ── pac_3way_match ──────────────────────────────────────────────────────
  { kpi_id: 'pac_3way_match', kpi_label: '3-way match',
    root_cause: '3-way match exceptions accumulate because there is no SLA-driven exception clearance.',
    process: 'Define a 3-way match exception SLA with weekly clearance review; tag exceptions to root cause owner.',
    tech: 'Auto-route exceptions to the right owner (buyer / AP / vendor); auto-resolve clean ones.',
    benefit: 'Tighter exception loop pushes first-time-right invoice rate to 95%+.' },

  // ── emergency_pr_pct ────────────────────────────────────────────────────
  { kpi_id: 'emergency_pr_pct', kpi_label: 'Emergency PR rate',
    root_cause: 'Demand forecasting is weak; safety stocks are not category-specific.',
    process: 'Demand-forecast and safety-stock review for the top 5 categories driving emergency PRs.',
    tech: 'AI demand-prediction agent on PR history, consumption, production plan, and market signals.',
    benefit: 'Better demand visibility shrinks emergency PRs by 40–60%.' },
  { kpi_id: 'emergency_pr_pct', kpi_label: 'Emergency PR rate',
    root_cause: 'No vendor SLAs / penalty clauses for missed lead times — vendors absorb shortfalls into emergency requests.',
    srm: 'Insert lead-time SLAs and penalty clauses into strategic vendor contracts.',
    benefit: 'Lead-time discipline reduces process disruptions and emergency demand.' },

  // ── tail_spend ──────────────────────────────────────────────────────────
  { kpi_id: 'tail_spend', kpi_label: 'Tail spend',
    root_cause: 'Long tail of low-spend vendors — no consolidation programme.',
    category: 'Tail-vendor consolidation drive — target 80/20 to top 50 suppliers via sourcing-as-a-service.',
    benefit: 'Tail consolidation cuts vendor count, reduces P2P overhead, and unlocks volume leverage.' },

  // ── spend_per_fte ───────────────────────────────────────────────────────
  { kpi_id: 'spend_per_fte', kpi_label: 'Spend managed per FTE',
    root_cause: 'High share of transactional procurement work — buyers spend most of their time on POs and invoices.',
    op_model: 'Shared services centre / transactional procurement hub — reroutes routine activity off category teams.',
    tech: 'Catalogue + touchless PO + agentic transactional automation lifts touchless-PO rate to 60%+.',
    benefit: 'Higher Spend / FTE through automation and operating-model leverage.' },
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

  // Group RCA rows by engine kpi_id so we can join on the same key the
  // backend emits.
  const grouped: Record<string, RCARow[]> = {}
  for (const row of RCA_DATA) {
    if (!grouped[row.kpi_id]) grouped[row.kpi_id] = []
    grouped[row.kpi_id].push(row)
  }

  // Headline list — gap KPIs first; if none, fall back to every KPI we have
  // root-cause data for so the page never renders empty.
  const visibleKpiIds = gapKpis.length > 0
    ? gapKpis.map(k => k.kpi_id).filter(id => grouped[id])
    : Object.keys(grouped)

  if (visibleKpiIds.length === 0) {
    return (
      <div className="acc-card text-center py-8">
        <p className="text-neutral-500 text-sm">
          No gap KPIs to analyse{activeBucket ? ` in "${activeBucket}"` : ''}.
        </p>
      </div>
    )
  }

  // For display: prefer the engine's label, fall back to the catalogue label.
  const labelFor = (kpiId: string): string => {
    const fromEngine = allKpis.find(k => k.kpi_id === kpiId)?.label
    if (fromEngine) return fromEngine
    return grouped[kpiId]?.[0]?.kpi_label ?? kpiId
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
      {visibleKpiIds.map(kpiId => {
        const rows = grouped[kpiId] || []
        const isOpen = openKpis.has(kpiId)
        const kpiName = labelFor(kpiId)
        return (
          <div key={kpiId} className="acc-card overflow-hidden p-0">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left border-b border-neutral-150"
              onClick={() => toggleKpi(kpiId)}
            >
              <div className="flex items-center gap-2">
                {isOpen
                  ? <ChevronUp size={14} className="text-neutral-500" />
                  : <ChevronDown size={14} className="text-neutral-500" />}
                <span className="text-[14px] font-semibold text-neutral-900">{kpiName}</span>
                <span className="text-[12px] text-neutral-500">
                  {rows.length} root cause{rows.length !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {rows.map((row, i) => {
                      const interventionsKey = `${kpiId}-${i}`
                      const openIntervention = openInterventions[interventionsKey]
                      const detailText = openIntervention
                        ? (row[openIntervention as keyof RCARow] as string | undefined)
                        : undefined
                      return (
                        <div key={i} className="border border-neutral-200 rounded-md p-3 bg-white">
                          <p className="text-[13px] font-semibold text-neutral-900 mb-1">{row.root_cause}</p>
                          {row.child_kpi && (
                            <p className="text-[11px] text-neutral-500 mb-2">
                              Linked KPI: <span className="num">{row.child_kpi}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {INTERVENTIONS.filter(int => row[int.key]).map(int => {
                              const isActive = openIntervention === int.key
                              return (
                                <button
                                  key={int.key}
                                  onClick={() => setOpenInterventions(prev => ({
                                    ...prev,
                                    [interventionsKey]: prev[interventionsKey] === int.key ? null : int.key,
                                  }))}
                                  className={cn(
                                    'flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border font-medium transition-colors',
                                    isActive
                                      ? 'bg-accent-50 text-accent-700 border-accent'
                                      : 'bg-white text-neutral-700 border-neutral-200 hover:border-accent',
                                  )}
                                >
                                  <int.Icon size={11} /> {int.label}
                                </button>
                              )
                            })}
                          </div>
                          {detailText && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-2 p-2.5 rounded-sm text-[12px] bg-accent-50 text-neutral-700 border border-accent-100"
                            >
                              {detailText}
                            </motion.div>
                          )}
                          {row.benefit && (
                            <p className="mt-2 text-[12px] text-success-fg bg-success-soft border border-success/20 rounded-sm p-2">
                              <span className="font-semibold">Expected benefit: </span>
                              {row.benefit}
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
