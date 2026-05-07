import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Loader2, AlertCircle, ChevronRight, Clock, Sparkles } from 'lucide-react'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ProgressEvent } from '@/lib/types'
import PageHeader from '@/components/layout/PageHeader'

const DID_YOU_KNOW: string[] = [
  'Top-quartile procurement teams see RC adoption above 60% — the largest single lever on TAT.',
  'A 10% reduction in single-source PRs typically unlocks 2–3% in category savings.',
  'Leading organisations review supplier performance quarterly, not annually.',
  'PO compliance above 85% correlates strongly with predictable cash-out and fewer audit flags.',
  'Digitised sourcing cycles are 38% faster than email/RFQ-driven ones, on average.',
]

export default function RunningPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen, clientName } = useAssessmentStore()
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [pct, setPct] = useState(0)
  const [currentMsg, setCurrentMsg] = useState('Starting assessment…')
  const [stepLabel, setStepLabel] = useState('')
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [errorMsg, setErrorMsg] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) return
    const url = `/api/v1/session/${sessionId}/run-status`
    let active = true

    const run = async () => {
      try {
        const res = await fetch(url)
        if (!res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const evt: ProgressEvent = JSON.parse(line.slice(6))
                if (evt.pct !== undefined) setPct(evt.pct)
                if (evt.message) {
                  setCurrentMsg(evt.message)
                  setEvents(prev => [...prev, evt])
                }
                if (evt.step !== undefined && evt.total !== undefined) {
                  setStepLabel(`Step ${evt.step} of ${evt.total}`)
                }
                if (evt.status === 'done') {
                  setStatus('done')
                  setPct(100)
                  setTimeout(() => { setScreen('formula-review'); navigate('/formula-review') }, 1500)
                }
                if (evt.status === 'error') {
                  setStatus('error')
                  setErrorMsg(evt.message || 'Unknown error')
                }
              } catch {}
            }
          }
        }
      } catch (e: any) {
        if (active) { setStatus('error'); setErrorMsg(e.message) }
      }
    }

    run()
    return () => { active = false }
  }, [sessionId, navigate, setScreen])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const [factIdx, setFactIdx] = useState(0)
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => setFactIdx(i => (i + 1) % DID_YOU_KNOW.length), 6000)
    return () => clearInterval(id)
  }, [status])

  return (
    <div className="px-4">
      <PageHeader
        title={status === 'running' ? `Running Assessment${clientName ? ` — ${clientName}` : ''}` : status === 'done' ? 'Assessment Complete!' : 'Assessment Failed'}
        subtitle={status === 'running' ? 'Calculating KPIs, scoring dimensions, and generating insights…' : undefined}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mx-auto">

        <div className="text-center mb-6">
          {status === 'running' && <Loader2 size={44} className="text-brand-purple animate-spin mx-auto mb-3" />}
          {status === 'done'    && <CheckCircle size={44} className="text-green-600 mx-auto mb-3" />}
          {status === 'error'   && <AlertCircle size={44} className="text-red-600 mx-auto mb-3" />}
          {status === 'error' && <p className="text-sm text-red-600 mt-1">{errorMsg}</p>}
          {status === 'running' && pct < 50 && (
            <p className="text-xs text-caption flex items-center justify-center gap-1 mt-2">
              <Clock size={11} /> Typically completes in 30–60 seconds
            </p>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between text-xs text-caption font-medium">
          <span>{stepLabel}</span>
          <span className="tabular-nums font-bold text-brand-purple">{pct}%</span>
        </div>
        <div className="w-full bg-bg-muted rounded-full h-3 mb-3 overflow-hidden">
          <motion.div
            className="h-3 rounded-full bg-accent"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {status === 'running' && (
          <p className="text-sm text-center text-brand-dark font-medium mb-4 min-h-[1.25rem]">
            {currentMsg}
          </p>
        )}

        {status === 'running' && (
          <div className="mb-6 rounded-lg border border-bg-secondary bg-bg-secondary/30 px-4 py-3">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-brand-purple flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-purple mb-0.5">Did you know?</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={factIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-brand-dark leading-relaxed"
                  >
                    {DID_YOU_KNOW[factIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((evt, i) => {
              const isLast = i === events.length - 1 && status === 'running'
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border text-sm ${
                    isLast
                      ? 'border-brand-purple bg-bg-secondary text-brand-dark font-semibold'
                      : 'border-bg-secondary bg-white text-black'
                  }`}>
                  {isLast
                    ? <Loader2 size={15} className="text-brand-purple animate-spin flex-shrink-0" />
                    : <CheckCircle size={15} className="text-green-600 flex-shrink-0" />}
                  <span className="flex-1">{evt.message}</span>
                  <span className="text-xs text-caption tabular-nums">{evt.pct}%</span>
                  {isLast && <ChevronRight size={13} className="text-brand-purple flex-shrink-0" />}
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={logEndRef} />
        </div>

        {status === 'error' && (
          <button onClick={() => { setScreen('configure'); navigate('/configure') }}
            className="mt-6 mx-auto block border border-brand-purple text-brand-purple px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
            ← Back to Configure
          </button>
        )}

      </motion.div>
    </div>
  )
}
