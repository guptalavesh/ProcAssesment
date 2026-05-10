import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface QOption {
  score: 1 | 2 | 3 | 4
  label: string
}
interface Question {
  code: string
  text: string
  options: QOption[]
}
interface DimBlock {
  dim_id?: string
  dimension_id?: string
  title: string
  guidance?: string
  description?: string
  weight?: number
  weight_pct?: number
  questions: Question[]
}

const SCORE_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-amber-100 text-amber-700 border-amber-200',
  3: 'bg-blue-100 text-blue-700 border-blue-200',
  4: 'bg-green-100 text-green-700 border-green-200',
}

interface Props {
  sessionId: string
  skillPath: string | null
}

export default function QuestionnaireSection({ sessionId, skillPath }: Props) {
  const [data, setData] = useState<DimBlock[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({})
  const [openDim, setOpenDim] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [shellOpen, setShellOpen] = useState(false)

  useEffect(() => {
    if (!skillPath) return
    setLoading(true)
    api.getQuestionnaire(skillPath)
      .then((d: any) => {
        const blocks = d.questionnaire || d.blocks || []
        const normalized: DimBlock[] = blocks.map((b: any) => ({
          dimension_id: b.dimension_id || b.dim_id,
          dim_id: b.dim_id || b.dimension_id,
          title: b.title,
          description: b.description || b.guidance || '',
          weight_pct: b.weight_pct ?? b.weight ?? 0,
          questions: b.questions || [],
        }))
        setData(normalized)
        if (normalized[0]?.dimension_id) {
          setOpenDim((prev) => prev ?? normalized[0].dimension_id!)
        }
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [skillPath])

  const setAnswer = (dim: string, qCode: string, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [dim]: { ...(prev[dim] || {}), [qCode]: score },
    }))
  }

  const dimScore = (dim: DimBlock) => {
    const dimId = dim.dimension_id || dim.dim_id || ''
    const a = answers[dimId] || {}
    const scores = Object.values(a).filter((v) => v >= 1 && v <= 4)
    if (scores.length === 0) return { score: null as number | null, answered: 0, total: dim.questions.length }
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    return { score: Math.round(avg), answered: scores.length, total: dim.questions.length }
  }

  const totalAnswered = useMemo(() => {
    return Object.values(answers).reduce((s, dim) => s + Object.keys(dim).length, 0)
  }, [answers])
  const totalQuestions = useMemo(() => {
    return (data || []).reduce((s, d) => s + d.questions.length, 0)
  }, [data])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    setError('')
    try {
      const confirmed: Record<string, number> = {}
      for (const dim of data) {
        const s = dimScore(dim)
        const dimId = dim.dimension_id || dim.dim_id || ''
        if (s.score !== null && s.answered >= Math.ceil(s.total * 0.6)) {
          confirmed[dimId] = s.score
        }
      }
      await Promise.all([
        Object.keys(confirmed).length > 0
          ? api.confirmTextQre(sessionId, confirmed)
          : Promise.resolve(),
        api.saveQuestionnaireDetail(sessionId, answers),
      ])
      setSavedAt(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!skillPath) return null

  return (
    <div className="acc-card mb-5 py-3 px-4 border-l-4 border-l-brand-purple">
      <button
        type="button"
        onClick={() => setShellOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">Questionnaire — Click-to-answer</span>
          <span className="text-[10px] text-caption font-semibold uppercase tracking-wide">alternative to Excel QRE upload</span>
        </div>
        <div className="flex items-center gap-3">
          {totalQuestions > 0 && (
            <span className="text-[11px] text-caption">
              {totalAnswered}/{totalQuestions} answered
            </span>
          )}
          {savedAt && (
            <span className="text-[10px] text-green-700 flex items-center gap-1">
              <CheckCircle2 size={11} /> saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {shellOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {shellOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-caption">
                  <Loader2 size={12} className="animate-spin text-brand-purple" /> Loading question bank…
                </div>
              )}
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
              )}

              {data && data.length === 0 && (
                <p className="text-xs text-caption italic">
                  This skill has no embedded questionnaire — fall back to the Excel QRE upload above.
                </p>
              )}

              {data && data.map((dim) => {
                const s = dimScore(dim)
                const dimId = dim.dimension_id || dim.dim_id || ''
                const isOpen = openDim === dimId
                return (
                  <div key={dimId} className="border border-bg-secondary rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenDim(isOpen ? null : dimId)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-bg-secondary/40 hover:bg-bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm font-bold text-brand-dark">{dim.title}</span>
                        {((dim.weight_pct ?? dim.weight ?? 0) > 0) && (
                          <span className="text-[10px] text-brand-purple bg-accent-50 border border-brand-purple/20 rounded px-1.5 py-0.5">
                            {dim.weight_pct ?? dim.weight}% of overall
                          </span>
                        )}
                        <span className="text-[10px] text-caption">
                          {s.answered}/{s.total} answered
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.score !== null ? (
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded border', SCORE_BADGE[s.score])}>
                            {s.score}/4
                          </span>
                        ) : (
                          <span className="text-[10px] text-caption italic">no score yet</span>
                        )}
                        {isOpen ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          {(dim.description || dim.guidance) && (
                            <p className="px-3 py-2 text-[11px] text-caption italic border-b border-bg-secondary/60">
                              {dim.description || dim.guidance}
                            </p>
                          )}
                          <div className="divide-y divide-bg-secondary/60">
                            {dim.questions.map((q) => {
                              const selected = answers[dimId]?.[q.code]
                              return (
                                <div key={q.code} className="px-3 py-3">
                                  <p className="text-xs font-semibold text-brand-dark mb-2">
                                    <span className="text-caption font-mono mr-2">{q.code}</span>
                                    {q.text}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {q.options.map((opt) => {
                                      const isSelected = selected === opt.score
                                      return (
                                        <button
                                          key={opt.score}
                                          type="button"
                                          onClick={() => setAnswer(dimId, q.code, opt.score)}
                                          className={cn(
                                            'flex items-start gap-2 text-left text-[11px] border rounded px-2.5 py-1.5 transition-colors',
                                            isSelected
                                              ? 'border-brand-purple bg-accent-50/60 text-brand-dark'
                                              : 'border-bg-secondary hover:border-brand-purple/40 hover:bg-accent-50/30 text-brand-dark/85'
                                          )}
                                        >
                                          <span className={cn(
                                            'flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black',
                                            isSelected
                                              ? SCORE_BADGE[opt.score]
                                              : 'bg-white border-bg-secondary text-caption'
                                          )}>
                                            {opt.score}
                                          </span>
                                          <span className="flex-1 leading-snug">{opt.label}</span>
                                        </button>
                                      )
                                    })}
                                  </div>
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

              {data && data.length > 0 && (
                <div className="flex items-center justify-end gap-3 pt-1">
                  <p className="text-[10px] text-caption italic mr-auto">
                    A dimension is committed only when at least 60% of its questions are answered.
                  </p>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || totalAnswered === 0}
                    className="text-xs bg-brand-purple text-white px-4 py-1.5 rounded font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving
                      ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                      : <><CheckCircle2 size={11} /> Save answers</>}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
