import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown, ChevronUp, Loader2, Building2, GitBranch, DollarSign, Cpu, Users2,
  GraduationCap, Sparkles, Clock, Construction, type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import IframeViewer from './IframeViewer'
import AiUsecasesTab from './AiUsecasesTab'
import AiInsightsMini from './AiInsightsMini'
import { cn } from '@/lib/utils'
import type { KPIAssessmentResult, DimensionResult, Engagement } from '@/lib/types'

interface Props {
  kpiAssessment: KPIAssessmentResult | null
  engagement: Engagement
  sessionId: string
  dimResults: DimensionResult[]
}

// ── Offerings catalogue (per REBUILD_04 spec) ────────────────────────────────
//
// Each offering has:
//   triggerKpis — KPI ids whose `has_gap` flips this offering to "Relevant"
//   benefits    — bullet points the user expands to see
//   isPlaceholder — true for the Cost Takeout card (rendered as a "coming
//                   soon" tile so the catalogue stays at 7 offerings).
interface Offering {
  id: string
  title: string
  timeline: string
  desc: string
  Icon: LucideIcon
  triggerKpis: string[]
  benefits: string[]
  isPlaceholder?: boolean
}

const OFFERINGS: Offering[] = [
  {
    id: 'op_model',
    title: 'Organisation Structure & Operating Model',
    timeline: '3 months',
    desc: 'Right-size and re-design the procurement organisation for category focus and efficiency.',
    Icon: Building2,
    triggerKpis: ['spend_per_fte', 'tat_pr_to_po', 'tail_spend', 'tail_spend_pct'],
    benefits: [
      '15–25% improvement in Spend per FTE through right-sized org design',
      'Faster decisions via simplified DoP and reduced approval layers',
      'Category-focused structure with Lead Buyers and Category Councils',
      'KRA-driven governance cadence for procurement accountability',
    ],
  },
  {
    id: 'process',
    title: 'Process Design & Optimisation',
    timeline: '3 months',
    desc: 'To-Be S2P process flows with controls, RACI and buying-channel routing per category.',
    Icon: GitBranch,
    triggerKpis: ['tat_pr_to_po', 'pac_3way_match', 'pac_prs', 'rc_adoption_volume'],
    benefits: [
      '30–50% TAT reduction through streamlined PR-to-PO workflows',
      'Higher compliance via system-enforced buying channel routing per category',
      'Reduced emergency procurement through structured category governance',
      'Structured payment KPI tracking → improved vendor delivery reliability',
    ],
  },
  {
    id: 'category_offering',
    title: 'Category Offering',
    timeline: '3 months',
    desc: 'Buying-channel framework, category-mix optimisation and channel-wise TAT modelling by material group.',
    Icon: DollarSign,
    triggerKpis: ['savings_lpo', 'savings_per_lpo', 'rc_adoption_volume', 'pac_prs'],
    benefits: [
      '2–5% incremental savings through structured negotiation and category strategies',
      '40–60% RC coverage improvement — from spot to rate contracts',
      'Volume consolidation by category → stronger pricing leverage',
      'Buying channel policy (RC / ASL / RFQ) reduces spot procurement incidence',
    ],
  },
  {
    id: 'cost_takeout',
    title: 'Cost Takeout',
    timeline: '3–6 months',
    desc: 'Structured cost takeout programme — spend analytics, should-cost modelling and savings tracking.',
    Icon: DollarSign,
    triggerKpis: [],
    benefits: [],
    isPlaceholder: true,
  },
  {
    id: 'tech',
    title: 'Technology, Digital & AI',
    timeline: '6 months',
    desc: 'Agentic AI across the S2P process — from PR validation to PO award.',
    Icon: Cpu,
    triggerKpis: ['tat_pr_to_po', 'savings_lpo', 'savings_per_lpo', 'rc_adoption_volume', 'pac_prs', 'pac_3way_match'],
    benefits: [
      '40–60% of transactional activities automated via Agentic AI (PR validation, LPO fetch, PO creation)',
      'AI-assisted negotiation → 1–3% additional savings from better buyer preparation',
      'Real-time spend dashboards with AI-driven root-cause insights',
      'System-based LPO deviation checks and compliance monitoring',
    ],
  },
  {
    id: 'srm',
    title: 'Supplier Relationship Management',
    timeline: '3 months',
    desc: 'SRM operating model, vendor scorecards and supplier development programme.',
    Icon: Users2,
    triggerKpis: ['otd', 'supplier_otd', 'pac_prs'],
    benefits: [
      '15–20% improvement in On-time Delivery through vendor scorecards and performance clauses',
      'Approved Supplier List reduces TAT for vendor shortlisting by 60–70%',
      'Reduced single-source risk through structured vendor development and diversification',
      'Stronger vendor relationships via timely payments and engagement programmes',
    ],
  },
  {
    id: 'capability',
    title: 'Capability Development',
    timeline: '1 month',
    desc: 'Competency QRE, training roadmaps and category intelligence workbooks.',
    Icon: GraduationCap,
    triggerKpis: ['tat_pr_to_po', 'savings_lpo', 'savings_per_lpo'],
    benefits: [
      'Procurement workforce equipped with right skills for category management and negotiation',
      'Category intelligence workbooks → buyers enter negotiations with market data',
      'Structured on-boarding halves ramp-up time for new recruits',
      'KRA-aligned training roadmaps drive measurable improvement in team productivity',
    ],
  },
]

const TABS: { id: string; label: string }[] = [
  { id: 'offerings',       label: 'Offerings' },
  { id: 'ai_usecases',     label: 'Agentic AI Use-Cases' },
  { id: 'process',         label: 'Process Map' },
  { id: 'buying_channel',  label: 'Buying Channel' },
]

export default function OfferingsTab({ kpiAssessment, sessionId }: Props) {
  const [tab, setTab] = useState<string>('offerings')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [swimlaneHtml, setSwimlaneHtml] = useState<string>('')
  const [swimlaneLoading, setSwimlaneLoading] = useState(false)
  const [buyingChannel, setBuyingChannel] = useState<any>(null)
  const [bcLoading, setBcLoading] = useState(false)

  useEffect(() => {
    if (tab === 'process' && !swimlaneHtml) {
      setSwimlaneLoading(true)
      api.getSwimlaneInteractive(sessionId)
        .then((r: any) => setSwimlaneHtml(r.html))
        .catch(() => setSwimlaneHtml('<p style="padding:20px">Process map not available</p>'))
        .finally(() => setSwimlaneLoading(false))
    }
    if (tab === 'buying_channel' && !buyingChannel) {
      setBcLoading(true)
      api.getBuyingChannel(sessionId)
        .then((r: any) => setBuyingChannel(r))
        .catch(() => {})
        .finally(() => setBcLoading(false))
    }
  }, [tab, sessionId, swimlaneHtml, buyingChannel])

  // Build the set of KPI ids that have gaps. The serializer sets
  // `has_gap=true` when a KPI is below benchmark on its preferred direction
  // OR scored ≤ 2 — same definition the Status pill uses, so the relevance
  // mark stays in sync with the rest of the page.
  const gapKpiIds = new Set(
    Object.values(kpiAssessment?.kpi_results || {})
      .filter(k => k.has_gap)
      .map(k => k.kpi_id),
  )

  const isRelevant = (offering: Offering) =>
    !offering.isPlaceholder && offering.triggerKpis.some(k => gapKpiIds.has(k))

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-neutral-150">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'text-[13px] font-medium px-3 py-2 border-b-2 transition-colors',
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral-500 hover:text-neutral-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'offerings' && (
        <div className="space-y-3">
          <p className="text-[13px] text-neutral-500 leading-relaxed">
            Transformation offerings auto-matched to your assessment gaps. Items flagged
            with <span className="text-accent font-semibold">★ Relevant</span> address one or
            more KPIs that landed below benchmark.
          </p>

          {sessionId && (
            <AiInsightsMini sessionId={sessionId} context="offerings" />
          )}

          {OFFERINGS.map((o, i) => {
            const relevant = isRelevant(o)
            const isOpen = expanded.has(o.id)
            const Icon = o.Icon
            const triggerLabels = o.triggerKpis
              .map(kid => kpiAssessment?.kpi_results?.[kid]?.label)
              .filter(Boolean) as string[]
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'acc-card p-0 overflow-hidden',
                  relevant && 'border-accent/40 bg-accent-50/30',
                  o.isPlaceholder && 'opacity-70',
                )}
              >
                <button
                  onClick={() => toggle(o.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0',
                    relevant ? 'bg-accent text-white' : 'bg-accent-50 text-accent',
                  )}>
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px] text-neutral-900">{o.title}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-sm">
                        <Clock size={10} /> {o.timeline}
                      </span>
                      {relevant && (
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase font-semibold tracking-wide text-accent">
                          <Sparkles size={10} /> Relevant
                        </span>
                      )}
                      {o.isPlaceholder && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-warning-fg bg-warning-soft px-1.5 py-0.5 rounded-sm">
                          <Construction size={10} /> Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-neutral-500 mt-0.5 line-clamp-1">{o.desc}</p>
                  </div>
                  {isOpen
                    ? <ChevronUp   size={14} className="text-neutral-400 flex-shrink-0" />
                    : <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />}
                </button>

                {isOpen && !o.isPlaceholder && (
                  <div className="px-4 pb-4 pt-1 border-t border-neutral-150 space-y-3">
                    <p className="text-[13px] text-neutral-700 leading-relaxed">{o.desc}</p>

                    {triggerLabels.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1.5">Triggered by</p>
                        <div className="flex flex-wrap gap-1.5">
                          {triggerLabels.map(l => (
                            <span key={l} className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-sm font-medium">
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="eyebrow mb-1.5">Expected benefits</p>
                      <ul className="space-y-1">
                        {o.benefits.map((b, idx) => (
                          <li key={idx} className="text-[13px] text-neutral-700 flex items-start gap-2">
                            <span className="text-accent mt-1 flex-shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {isOpen && o.isPlaceholder && (
                  <div className="px-4 pb-4 pt-1 border-t border-neutral-150">
                    <p className="text-[13px] text-neutral-700 leading-relaxed">{o.desc}</p>
                    <p className="text-[12px] text-neutral-500 mt-2">
                      Detailed benefits, savings calculator and tracking dashboards arrive in a follow-up release.
                    </p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {tab === 'ai_usecases' && <AiUsecasesTab sessionId={sessionId} />}

      {tab === 'process' && (
        <div>
          {swimlaneLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          ) : swimlaneHtml ? (
            <IframeViewer html={swimlaneHtml} height={600} />
          ) : (
            <p className="text-neutral-500 text-sm text-center py-6">Process map not available.</p>
          )}
        </div>
      )}

      {tab === 'buying_channel' && (
        <div>
          {bcLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          ) : buyingChannel?.rows && buyingChannel.rows.length > 0 ? (
            <div className="acc-card p-0 overflow-hidden">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Material group</th>
                    <th>Description</th>
                    <th>Archetype</th>
                    <th>Channel</th>
                    <th>Spend (₹ Cr)</th>
                    <th>RC %</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {buyingChannel.rows.slice(0, 50).map((row: any) => (
                    <tr key={row.mg_code}>
                      <td className="num text-[12px]">{row.mg_code}</td>
                      <td className="text-[13px]">{row.mg_desc}</td>
                      <td><span className="text-[11px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded-sm font-medium">{row.archetype}</span></td>
                      <td className="text-[13px]">{row.recommended_channel}</td>
                      <td className="text-[13px] num">{row.spend_cr}</td>
                      <td className="text-[12px] text-neutral-500">{row.signal}</td>
                      <td>
                        <span className={cn(
                          'text-[11px] px-1.5 py-0.5 rounded-sm font-semibold',
                          row.confidence === 'HIGH'   ? 'bg-success-soft text-success-fg'  :
                          row.confidence === 'MEDIUM' ? 'bg-warning-soft text-warning-fg'  :
                                                        'bg-danger-soft  text-danger-fg',
                        )}>
                          {row.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-sm text-center py-6">Buying channel data not available.</p>
          )}
        </div>
      )}
    </div>
  )
}
