import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, ChevronDown, ChevronUp, Loader2, Building, Truck, Users, BarChart, Cpu, Settings, FileCheck } from 'lucide-react'
import { api } from '@/lib/api'
import IframeViewer from './IframeViewer'
import AiUsecasesTab from './AiUsecasesTab'
import { cn } from '@/lib/utils'
import type { KPIAssessmentResult, DimensionResult, Engagement } from '@/lib/types'

interface Props {
  kpiAssessment: KPIAssessmentResult | null
  engagement: Engagement
  sessionId: string
  dimResults: DimensionResult[]
}

interface Offering {
  id: string
  title: string
  description: string
  icon: any
  triggers: string[]
  workstreams: string[]
}

const OFFERINGS: Offering[] = [
  {
    id: 'op_model',
    title: 'Procurement Operating Model Redesign',
    description: 'Centralised, decentralised, or hybrid model design with role architecture, organisation structure, and category council governance.',
    icon: Building,
    triggers: ['fragmented org', 'unclear ownership', 'tail spend'],
    workstreams: ['Org structure', 'Role design', 'Governance', 'Category councils'],
  },
  {
    id: 'sourcing',
    title: 'Strategic Sourcing & Category Strategy',
    description: 'Category-by-category sourcing strategies with should-cost models, market intelligence, and digital RFx execution.',
    icon: BarChart,
    triggers: ['low rc adoption', 'savings gap', 'tail spend'],
    workstreams: ['Category strategies', 'Should-cost models', 'Negotiation playbooks'],
  },
  {
    id: 'p2p',
    title: 'Purchase-to-Pay Automation',
    description: 'End-to-end P2P process redesign with catalog buying, automated 3-way matching, and AI-driven exception management.',
    icon: Settings,
    triggers: ['high tat', 'pac prs', 'sourcing tool low'],
    workstreams: ['Catalog enablement', 'Workflow automation', 'Invoice matching'],
  },
  {
    id: 'srm',
    title: 'Supplier Relationship Management',
    description: 'Vendor segmentation, performance scorecards, supplier development programmes, and risk monitoring.',
    icon: Users,
    triggers: ['low otd', 'defect rate', 'no scorecards'],
    workstreams: ['Vendor segmentation', 'Performance scorecards', 'Development programs'],
  },
  {
    id: 'tech',
    title: 'Digital Procurement Technology',
    description: 'ERP/Ariba/Coupa platform implementation, AI-augmented sourcing, agentic procurement workflows, and analytics.',
    icon: Cpu,
    triggers: ['low digital adoption', 'manual processes', 'limited spend visibility'],
    workstreams: ['Platform setup', 'AI/ML enablement', 'Analytics'],
  },
  {
    id: 'capability',
    title: 'Capability Building & Change Management',
    description: 'Procurement competency framework, training roadmaps, certifications, and category intelligence workbooks.',
    icon: Users,
    triggers: ['skills gap', 'training need', 'change management'],
    workstreams: ['Competency model', 'Training programmes', 'Change management'],
  },
  {
    id: 'risk',
    title: 'Procurement Risk & Compliance',
    description: 'Supplier risk assessment, business continuity planning, ESG sourcing, and contract compliance management.',
    icon: FileCheck,
    triggers: ['risk gaps', 'compliance issues', 'esg priority'],
    workstreams: ['Risk framework', 'Contract management', 'ESG sourcing'],
  },
  {
    id: 'logistics',
    title: 'Supply Chain & Logistics Optimization',
    description: 'Inbound logistics design, inventory optimisation, working capital improvements, and S&OP integration.',
    icon: Truck,
    triggers: ['inventory issues', 'working capital', 'logistics cost'],
    workstreams: ['Inventory design', 'Logistics network', 'Working capital'],
  },
]

interface Tab {
  id: string
  label: string
}

const TABS: Tab[] = [
  { id: 'offerings', label: 'Offerings' },
  { id: 'ai_usecases', label: 'Agentic AI Use-Cases' },
  { id: 'process', label: 'Process Map' },
  { id: 'buying_channel', label: 'Buying Channel' },
]

export default function OfferingsTab({ kpiAssessment, engagement, sessionId, dimResults }: Props) {
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

  const allKpis = kpiAssessment ? Object.values(kpiAssessment.kpi_results) : []
  const gapKpiNames = allKpis.filter(k => k.has_gap).map(k => k.label.toLowerCase())

  const isRelevant = (offering: Offering) =>
    offering.triggers.some(trig => gapKpiNames.some(g => g.includes(trig.split(' ')[0])))

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-bg-secondary">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'text-xs font-semibold px-3 py-2 border-b-2 transition-colors',
              tab === t.id ? 'border-brand-purple text-brand-purple' : 'border-transparent text-caption hover:text-brand-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'offerings' && (
        <div className="space-y-2">
          <p className="text-xs text-caption">
            Accenture transformation offerings auto-matched to your assessment gaps.
            Items flagged with ★ are most relevant given your KPIs.
          </p>
          {OFFERINGS.map((o, i) => {
            const relevant = isRelevant(o)
            const isOpen = expanded.has(o.id)
            const Icon = o.icon
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn('acc-card p-0 overflow-hidden', relevant && 'border-brand-purple/40 bg-accent-50/20')}
              >
                <button
                  onClick={() => toggle(o.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary/40 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-brand-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-brand-dark">{o.title}</p>
                      {relevant && <span className="text-[10px] uppercase font-bold tracking-wide text-brand-purple">★ Relevant</span>}
                    </div>
                    <p className="text-xs text-caption mt-0.5 line-clamp-1">{o.description}</p>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-bg-secondary/50">
                    <p className="text-xs text-caption leading-relaxed mb-3">{o.description}</p>
                    <p className="text-[11px] uppercase tracking-wide font-bold text-brand-dark mb-1">Workstreams</p>
                    <div className="flex flex-wrap gap-1.5">
                      {o.workstreams.map(w => (
                        <span key={w} className="text-[10px] bg-bg-secondary text-brand-dark px-2 py-0.5 rounded font-medium">{w}</span>
                      ))}
                    </div>
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
              <Loader2 className="animate-spin text-brand-purple" size={24} />
            </div>
          ) : swimlaneHtml ? (
            <IframeViewer html={swimlaneHtml} height={600} />
          ) : (
            <p className="text-caption text-sm text-center py-6">Process map not available.</p>
          )}
        </div>
      )}

      {tab === 'buying_channel' && (
        <div>
          {bcLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-brand-purple" size={24} />
            </div>
          ) : buyingChannel?.rows && buyingChannel.rows.length > 0 ? (
            <div className="acc-card p-0 overflow-hidden">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Material Group</th>
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
                      <td className="font-mono text-xs">{row.mg_code}</td>
                      <td className="text-xs">{row.mg_desc}</td>
                      <td><span className="text-[10px] bg-bg-secondary px-1.5 py-0.5 rounded font-semibold">{row.archetype}</span></td>
                      <td className="text-xs">{row.recommended_channel}</td>
                      <td className="text-xs font-mono">{row.spend_cr}</td>
                      <td className="text-xs">{row.signal}</td>
                      <td>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold',
                          row.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                          row.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700')}>{row.confidence}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-caption text-sm text-center py-6">Buying channel data not available.</p>
          )}
        </div>
      )}
    </div>
  )
}
