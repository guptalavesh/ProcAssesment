import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Loader2, Pencil, X } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { ColumnResolutionState } from '@/lib/types'
import { cn } from '@/lib/utils'

type Action = 'use_suggested' | 'manual' | 'unavailable'

export default function ColumnReviewPage() {
  const navigate = useNavigate()
  const { sessionId, setScreen } = useAssessmentStore()
  const [state, setState] = useState<ColumnResolutionState | null>(null)
  const [actions, setActions] = useState<Record<string, Action>>({})
  const [manuals, setManuals] = useState<Record<string, string>>({})
  const [unmatchedPicks, setUnmatchedPicks] = useState<Record<string, string>>({})
  const [autoOverrides, setAutoOverrides] = useState<Record<string, string>>({})
  const [editingAuto, setEditingAuto] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setScreen('columns')
    if (!sessionId) return
    api.getColumns(sessionId).then(data => {
      setState(data)
      const defaultActions: Record<string, Action> = {}
      Object.keys(data.suggestions).forEach(k => { defaultActions[k] = 'use_suggested' })
      setActions(defaultActions)
    }).catch(e => setError(e.message))
  }, [sessionId, setScreen])

  const handleConfirm = async () => {
    if (!sessionId || !state) return
    setLoading(true)
    try {
      const confirmed: Record<string, string> = {}
      const unavailable: string[] = []

      for (const [logical, actual] of Object.entries(state.resolved)) {
        confirmed[logical] = autoOverrides[logical] || actual
      }

      for (const [logical, action] of Object.entries(actions)) {
        if (action === 'use_suggested') {
          const sug = state.suggestions[logical]?.suggested
          if (sug) confirmed[logical] = sug
        } else if (action === 'manual') {
          const pick = manuals[logical]
          if (pick) confirmed[logical] = pick
        } else {
          unavailable.push(logical)
        }
      }

      for (const logical of state.unmatched) {
        const pick = unmatchedPicks[logical]
        if (pick === '__unavailable__' || !pick) {
          unavailable.push(logical)
        } else {
          confirmed[logical] = pick
        }
      }

      await api.confirmColumns(sessionId, confirmed, unavailable)
      setScreen('configure')
      navigate('/configure')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!state) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  return (
    <div>
      <PageHeader title="Column Review" subtitle="Confirm how your file columns map to expected fields" />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {Object.keys(state.resolved).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="acc-card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-600" />
            <h3 className="text-sm font-bold text-brand-dark">Auto-Resolved ({Object.keys(state.resolved).length})</h3>
            <span className="text-xs text-caption ml-1">— click ✏ to override any mapping</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(state.resolved).map(([logical, actual]) => (
              <div key={logical} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1.5 flex items-center gap-2">
                <span className="text-caption w-36 flex-shrink-0">{logical}</span>
                <span className="text-brand-purple font-bold">→</span>
                {editingAuto[logical] ? (
                  <div className="flex items-center gap-1 flex-1">
                    <select
                      value={autoOverrides[logical] || actual}
                      onChange={e => setAutoOverrides(prev => ({ ...prev, [logical]: e.target.value }))}
                      className="text-xs border border-brand-purple rounded px-2 py-0.5 flex-1 focus:outline-none bg-white"
                    >
                      {state.available_columns.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={() => setEditingAuto(prev => ({ ...prev, [logical]: false }))}
                      className="text-caption hover:text-green-600"
                    >
                      <CheckCircle size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setAutoOverrides(prev => { const n = { ...prev }; delete n[logical]; return n })
                        setEditingAuto(prev => ({ ...prev, [logical]: false }))
                      }}
                      className="text-caption hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className={cn('font-medium flex-1', autoOverrides[logical] ? 'text-brand-purple' : 'text-green-800')}>
                      {autoOverrides[logical] || actual}
                      {autoOverrides[logical] && <span className="ml-1 text-[10px] text-brand-purple font-bold">(overridden)</span>}
                    </span>
                    <button
                      onClick={() => setEditingAuto(prev => ({ ...prev, [logical]: true }))}
                      className="text-caption hover:text-brand-purple transition-colors flex-shrink-0"
                      title="Override this mapping"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {Object.keys(state.suggestions).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="acc-card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-brand-dark">Suggestions ({Object.keys(state.suggestions).length})</h3>
          </div>
          <table className="w-full acc-table text-xs">
            <thead><tr><th>Expected Field</th><th>Suggested Column</th><th>Confidence</th><th>Action</th></tr></thead>
            <tbody>
              {Object.entries(state.suggestions).map(([logical, sug]) => (
                <tr key={logical}>
                  <td className="font-medium">{logical}<br /><span className="text-caption font-normal">{state.skill_aliases[logical]}</span></td>
                  <td className="font-mono text-brand-dark">{sug.suggested}</td>
                  <td>
                    <span className={cn('font-semibold', sug.confidence > 0.9 ? 'text-green-700' : sug.confidence > 0.8 ? 'text-orange-600' : 'text-red-600')}>
                      {(sug.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <select value={actions[logical] || 'use_suggested'}
                      onChange={e => setActions(prev => ({ ...prev, [logical]: e.target.value as Action }))}
                      className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple">
                      <option value="use_suggested">Use suggested</option>
                      <option value="manual">Choose manually</option>
                      <option value="unavailable">Mark unavailable</option>
                    </select>
                    {actions[logical] === 'manual' && (
                      <select value={manuals[logical] || ''}
                        onChange={e => setManuals(prev => ({ ...prev, [logical]: e.target.value }))}
                        className="mt-1 text-xs border border-bg-secondary rounded px-2 py-1 w-full focus:outline-none focus:border-brand-purple">
                        <option value="">— pick column —</option>
                        {state.available_columns.map(c => <option key={c}>{c}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {state.unmatched.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="acc-card mb-4">
          <h3 className="text-sm font-bold text-red-700 mb-3">Unmatched Fields ({state.unmatched.length})</h3>
          <div className="space-y-2">
            {state.unmatched.map(logical => (
              <div key={logical} className="flex items-center gap-3">
                <span className="text-xs font-medium text-brand-dark w-40 flex-shrink-0">{logical}</span>
                <select value={unmatchedPicks[logical] || ''}
                  onChange={e => setUnmatchedPicks(prev => ({ ...prev, [logical]: e.target.value }))}
                  className="text-xs border border-bg-secondary rounded px-2 py-1 flex-1 focus:outline-none focus:border-brand-purple">
                  <option value="">— pick column or leave —</option>
                  <option value="__unavailable__">Mark as unavailable</option>
                  {state.available_columns.map(c => <option key={c}>{c}</option>)}
                </select>
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
        <button onClick={handleConfirm} disabled={loading}
          className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Confirm & Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
