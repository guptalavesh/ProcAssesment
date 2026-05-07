import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, Save, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  text: string
}

interface Area {
  area: string
  area_id?: string
  questions: Question[]
}

interface DiscoveryQRESectionProps {
  sessionId: string
}

const FALLBACK_AREAS: Area[] = [
  {
    area: 'Overall Scope',
    area_id: 'scope',
    questions: [
      { id: 'SC1', text: 'What are the exact entities and business units in scope? Are all distribution and generation units included, or are certain entities excluded at this stage?' },
      { id: 'SC2', text: 'What are the major categories you procure and what is the annual spend & volume? (e.g. CAPEX, civil & construction, contractor services, IT/technology, MRO/O&M)' },
      { id: 'SC3', text: 'Has a procurement maturity assessment been conducted previously? If yes, share key findings and actions taken as a result.' },
    ],
  },
  {
    area: 'Operating Model & Org Structure',
    area_id: 'op_model',
    questions: [
      { id: 'OM1', text: 'How is the procurement team structured? (central vs site teams, headcount, spend coverage) What is the governance model between central and unit-level teams?' },
      { id: 'OM2', text: 'What are the roles & responsibilities of the procurement team? Is there a shared services model? What % of team bandwidth is spent on strategic vs transactional activities?' },
      { id: 'OM3', text: 'What spend categories are centrally managed vs unit-managed? Is the split based on category type, spend value, or other criteria?' },
      { id: 'OM4', text: 'What is the current Delegation of Authority (DoA) framework? Is it value-based, category-based, or entity-based? Is it documented and system-enforced, or manual?' },
      { id: 'OM5', text: 'What are the current KPIs and KRAs for the procurement function and individuals? How are these tracked, calculated, and reported?' },
      { id: 'OM6', text: 'What is the current capability profile of the team (functional expertise, category knowledge, system proficiency)? Are there specific skill gaps?' },
      { id: 'OM7', text: 'What incentive structures exist for the procurement team? What is the current attrition rate (central vs site)?' },
      { id: 'OM8', text: 'Who are the key internal stakeholders whose buy-in is critical for the operating model to be approved and implemented?' },
    ],
  },
  {
    area: 'Process & Technology',
    area_id: 'process_tech',
    questions: [
      { id: 'PT1', text: 'Which systems are currently in use across entities (SAP, Oracle, Coupa, others)? Which entities use which system, and what processes are system-supported vs managed offline?' },
      { id: 'PT2', text: 'Are there any technology transformations planned or underway (e.g. S/4HANA, Ariba, Coupa, other S2P tools)? What are the implementation timelines?' },
      { id: 'PT3', text: 'What are the current source-to-contract (S2C) and procure-to-pay (P2P) processes? Are they documented? Where are the biggest bottlenecks or compliance gaps?' },
      { id: 'PT4', text: 'What buying channels are in use (rate contracts, spot buys, approved vendors, reverse auctions, GeM portal)? Is there a defined channel strategy or is it ad hoc by unit?' },
      { id: 'PT5', text: 'How are contracts currently managed? Is there a central repository, and how is contract compliance (validity, renewals, milestones) monitored?' },
      { id: 'PT6', text: 'How is supplier onboarding, performance management, and vendor risk handled? Is there a formal performance management process with scorecards?' },
      { id: 'PT7', text: 'Is there any interest in procurement aggregators for low-value/tail spend? Which categories are being considered and what is the estimated spend?' },
      { id: 'PT8', text: "What is the organisation's vision for AI and automation in procurement? Are there specific use cases already identified (e.g. demand consolidation, spend analytics, autonomous sourcing)?" },
    ],
  },
  {
    area: 'Governance & Reporting',
    area_id: 'governance',
    questions: [
      { id: 'GR1', text: 'What procurement governance forums currently exist (review meetings, steering committees)? How frequently do they meet and who participates?' },
      { id: 'GR2', text: 'Are there any recent internal audit observations, compliance issues, or regulatory findings related to procurement that should factor into the design?' },
      { id: 'GR3', text: 'Are there specific regulatory or statutory requirements governing procurement (e.g. CERC guidelines, CVC guidelines for public procurement, MSME compliance)?' },
      { id: 'GR4', text: 'Does the organisation have a sustainable procurement policy? Are ESG criteria currently applied to supplier selection or evaluation?' },
    ],
  },
]

const AREA_COLORS: Record<string, string> = {
  scope:        'bg-violet-600',
  op_model:     'bg-indigo-600',
  process_tech: 'bg-blue-600',
  governance:   'bg-teal-600',
}

export default function DiscoveryQRESection({ sessionId }: DiscoveryQRESectionProps) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<Area[]>(FALLBACK_AREAS)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/discovery-qre/questions').then(r => r.json()).catch(() => null),
      fetch(`/api/v1/session/${sessionId}/discovery-qre`).then(r => r.json()).catch(() => null),
    ]).then(([qData, aData]) => {
      if (qData?.areas) {
        const areasNormalized: Area[] = qData.areas.map((a: any, i: number) => ({
          area: a.area,
          area_id: a.area_id || ['scope', 'op_model', 'process_tech', 'governance'][i] || 'area_' + i,
          questions: a.questions,
        }))
        setAreas(areasNormalized)
      }
      if (aData?.answers) {
        setAnswers(aData.answers)
        setSavedCount(Object.keys(aData.answers).length)
      }
    })
  }, [sessionId])

  const totalQuestions = areas.reduce((s, a) => s + a.questions.length, 0)
  const answeredCount = Object.values(answers).filter(v => v.trim()).length

  const handleChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave({ ...answers, [id]: value }), 2000)
  }

  const doSave = async (data: Record<string, string>) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/discovery-qre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: data }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
      setSavedCount(Object.keys(data).filter(k => data[k]?.trim()).length)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => doSave(answers)

  return (
    <div className="acc-card mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ClipboardList size={16} className="text-brand-purple flex-shrink-0" />
          <span className="text-sm font-bold text-brand-dark">Discovery QRE</span>
          <span className="text-xs text-caption">(Optional — qualitative inputs for AI insights)</span>
          {savedCount > 0 && (
            <span className="ml-1 text-xs font-semibold text-brand-purple bg-accent-50 border border-brand-purple/20 px-2 py-0.5 rounded">
              {answeredCount}/{totalQuestions} answered · {savedCount} saved
            </span>
          )}
          {answeredCount > 0 && savedCount === 0 && (
            <span className="ml-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              {answeredCount} unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin text-brand-purple" />}
          {saved && !saving && <CheckCircle size={13} className="text-green-600" />}
          {open ? <ChevronUp size={16} className="text-caption" /> : <ChevronDown size={16} className="text-caption" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-bg-secondary">
              <p className="text-xs text-caption mb-4 leading-relaxed">
                Answer any questions where you have information from stakeholder interviews or Copilot summaries.
                These answers are passed directly to the AI insight engine — mentions of specific tools (e.g. "Coupa"),
                categories, or process gaps will surface in the generated recommendations.
                <strong className="text-brand-dark"> Answers auto-save after 2 seconds of inactivity.</strong>
              </p>

              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  Save failed: {error}
                </div>
              )}

              <div className="space-y-6">
                {areas.map((area) => (
                  <div key={area.area_id || area.area}>
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md mb-3',
                      AREA_COLORS[area.area_id || ''] || 'bg-brand-purple',
                    )}>
                      <span className="text-xs font-bold text-white uppercase tracking-wide">
                        {area.area}
                      </span>
                      <span className="text-[10px] text-white/70 ml-auto">
                        {area.questions.filter(q => answers[q.id]?.trim()).length}/{area.questions.length} answered
                      </span>
                    </div>

                    <div className="space-y-3">
                      {area.questions.map((q) => {
                        const val = answers[q.id] || ''
                        const filled = val.trim().length > 0
                        return (
                          <div key={q.id} className={cn(
                            'border rounded-lg p-3 transition-colors',
                            filled ? 'border-brand-purple/30 bg-accent-50/30' : 'border-bg-secondary'
                          )}>
                            <div className="flex items-start gap-2 mb-2">
                              <span className="flex-shrink-0 w-7 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-brand-purple/10 text-brand-purple">
                                {q.id}
                              </span>
                              <label
                                htmlFor={`q-${q.id}`}
                                className="text-[11px] text-brand-dark leading-relaxed cursor-pointer"
                              >
                                {q.text}
                              </label>
                            </div>
                            <textarea
                              id={`q-${q.id}`}
                              value={val}
                              onChange={e => handleChange(q.id, e.target.value)}
                              rows={2}
                              placeholder="Enter your response…"
                              className={cn(
                                'w-full text-xs border rounded p-2.5 resize-y focus:outline-none transition-colors text-black placeholder:text-caption',
                                filled
                                  ? 'border-brand-purple/40 focus:border-brand-purple bg-white'
                                  : 'border-bg-secondary focus:border-brand-purple'
                              )}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-bg-secondary">
                <p className="text-xs text-caption">
                  {answeredCount}/{totalQuestions} questions answered
                  {saved && ` · ${savedCount} saved to session`}
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || answeredCount === 0}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors',
                    saved
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-brand-purple text-white hover:bg-brand-dark disabled:opacity-50'
                  )}
                >
                  {saving
                    ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                    : saved
                    ? <><CheckCircle size={12} /> Saved</>
                    : <><Save size={12} /> Save Answers</>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
