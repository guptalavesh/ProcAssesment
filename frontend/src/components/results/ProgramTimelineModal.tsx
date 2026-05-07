import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  sessionId: string
  onClose: () => void
  onExport: () => void
  exporting?: boolean
}

const DURATIONS = [
  { value: '90d', label: '90 days' },
  { value: '6m',  label: '6 months' },
  { value: '12m', label: '12 months' },
]

const SLIDE_OPTIONS = [
  { id: 'cover',          label: 'Cover & Executive Summary' },
  { id: 'kpi_scorecard',  label: 'KPI Scorecard' },
  { id: 'bucket_deepdive',label: 'Bucket Deep Dive' },
  { id: 'spend_analysis', label: 'Spend Analysis' },
  { id: 'rca',            label: 'Root Cause Analysis' },
  { id: 'priorities',     label: 'Priority Actions' },
  { id: 'quick_wins',     label: 'Quick Wins' },
  { id: 'offerings',      label: 'Recommended Offerings' },
  { id: 'roadmap',        label: 'Programme Roadmap' },
]

export default function ProgramTimelineModal({ sessionId, onClose, onExport, exporting }: Props) {
  const [duration, setDuration] = useState('12m')
  const [includeSlides, setIncludeSlides] = useState<Record<string, boolean>>(
    SLIDE_OPTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/session/${sessionId}/program-timeline`)
      .then(r => r.json())
      .then(data => {
        if (data.duration) setDuration(data.duration)
        if (data.include_slides && Object.keys(data.include_slides).length > 0) {
          setIncludeSlides(data.include_slides)
        }
      })
      .catch(() => {})
  }, [sessionId])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/v1/session/${sessionId}/program-timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, include_slides: includeSlides }),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    await save()
    onExport()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-brand-purple" />
            <h2 className="text-base font-bold text-brand-dark">Configure KPI Deck</h2>
          </div>
          <button onClick={onClose} className="text-caption hover:text-red-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-caption mb-4">
          Choose the programme duration and slides to include in the export.
        </p>

        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-wide font-bold text-brand-dark mb-2">Programme Duration</p>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={cn(
                  'flex-1 text-xs font-semibold px-3 py-2 rounded border transition-colors',
                  duration === d.value
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-white text-brand-dark border-bg-secondary hover:border-brand-purple'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-wide font-bold text-brand-dark mb-2">Slides to Include</p>
          <div className="space-y-1.5">
            {SLIDE_OPTIONS.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSlides[s.id] || false}
                  onChange={e => setIncludeSlides(prev => ({ ...prev, [s.id]: e.target.checked }))}
                  className="accent-brand-purple"
                />
                <span className="text-brand-dark">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-bg-secondary">
          <button
            onClick={onClose}
            className="text-xs text-caption hover:text-brand-dark px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || saving}
            className="flex items-center gap-2 bg-brand-purple text-white px-5 py-2 rounded font-semibold text-xs hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {(exporting || saving) ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export PPT
          </button>
        </div>
      </motion.div>
    </div>
  )
}
