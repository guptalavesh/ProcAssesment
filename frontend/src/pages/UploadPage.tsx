import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, X, ChevronRight, ChevronLeft, Loader2, CheckCircle } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import QuestionnaireSection from '@/components/upload/QuestionnaireSection'
import DiscoveryQRESection from '@/components/upload/DiscoveryQRESection'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import { cn } from '@/lib/utils'

interface FileSlot {
  key: string
  label: string
  required?: boolean
  hint?: string
  scOnly?: boolean
}

const FILE_SLOTS: FileSlot[] = [
  { key: 'po_file',             label: 'PO Dump',              required: true,  hint: 'SAP ME2N export' },
  { key: 'pr_file',             label: 'PR Dump',              required: true,  hint: 'SAP ME5A export' },
  { key: 'invoice_file',        label: 'Invoice / AP Data',    hint: 'SAP MIR5 export' },
  { key: 'qre_file',            label: 'QRE (Excel)',          hint: 'Qualitative responses' },
  { key: 'workforce_file',      label: 'Workforce Data',       hint: 'FTE breakdown' },
  { key: 'quality_file',        label: 'Quality / Rejection',  hint: 'For Defect Rate KPI' },
  { key: 'inventory_file',      label: 'Inventory Snapshot',   hint: 'SAP MB52/MMBE', scOnly: true },
  { key: 'goods_movement_file', label: 'Goods Movement',       hint: 'SAP MB51', scOnly: true },
  { key: 'po_gr_file',          label: 'PO + GR Data',         hint: 'SAP ME2M+MIGO', scOnly: true },
  { key: 'production_file',     label: 'Production Orders',    hint: 'SAP COOIS', scOnly: true },
  { key: 'maintenance_file',    label: 'Maintenance Orders',   hint: 'SAP IW38', scOnly: true },
]

function DropZone({ slot, file, onChange }: { slot: FileSlot; file: File | null; onChange: (f: File | null) => void }) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) onChange(accepted[0]) }, [onChange])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'] }
  })
  return (
    <div className={cn('border-2 rounded p-3 transition-all cursor-pointer',
      isDragActive ? 'border-brand-purple bg-bg-secondary' : file ? 'border-green-400 bg-green-50' : 'border-dashed border-bg-secondary hover:border-brand-purple')}
      {...getRootProps()}>
      <input {...getInputProps()} />
      <div className="flex items-center gap-2">
        {file ? <CheckCircle size={16} className="text-green-600 flex-shrink-0" /> : <Upload size={16} className="text-caption flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{file ? file.name : slot.label}</p>
          {!file && <p className="text-xs text-caption">{slot.hint}</p>}
          {file && <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB</p>}
        </div>
        {file && <button onClick={(e) => { e.stopPropagation(); onChange(null) }} className="text-caption hover:text-red-500"><X size={14} /></button>}
      </div>
    </div>
  )
}

const COVERAGE_COLORS: Record<string, string> = {
  scoreable: 'text-green-700 bg-green-100',
  partial: 'text-orange-700 bg-orange-100',
  insufficient: 'text-red-700 bg-red-100',
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { sessionId, isProcurement, skillPath, setUploadResult, setScreen } = useAssessmentStore()
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [sheets, setSheets] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState('')
  const [coverage, setCoverage] = useState<Record<string, string> | null>(null)

  const setFile = (key: string) => (f: File | null) => {
    setFiles(prev => ({ ...prev, [key]: f }))
    setSheets(prev => ({ ...prev, [key]: null }))
  }

  const visibleSlots = FILE_SLOTS.filter(s => {
    if (s.scOnly && isProcurement) return false
    return true
  })

  const handleNext = async () => {
    if (!sessionId) return
    const po = files['po_file']
    if (!po) { setError('PO Dump is required.'); return }
    setError('')
    setLoading(true)
    setUploadPct(0)
    try {
      const result = await api.uploadFiles(sessionId, files, setUploadPct, sheets)
      setUploadResult(result)
      setCoverage(result.coverage)
      setScreen(result.next_screen as any)
      navigate(result.next_screen === 'column_review' ? '/columns' : '/configure')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const requiredCount = visibleSlots.filter(s => s.required).length
  const uploadedRequired = visibleSlots.filter(s => s.required && files[s.key]).length
  const uploadedOptional = visibleSlots.filter(s => !s.required && files[s.key]).length
  const totalUploaded = uploadedRequired + uploadedOptional

  return (
    <div>
      <PageHeader title="Upload Data Files" subtitle="Upload SAP exports and optional supporting data" />

      <p className="text-[11px] uppercase tracking-widest text-brand-purple font-semibold mb-3">Step 2 of 4 · Data upload</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      <div className="acc-card mb-5 py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-caption font-semibold">File coverage</p>
            <p className="text-sm font-bold text-brand-dark mt-0.5">
              {uploadedRequired}/{requiredCount} required
              {uploadedOptional > 0 && <span className="text-caption font-normal"> · +{uploadedOptional} optional</span>}
            </p>
          </div>
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="relative w-full h-1.5 bg-bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-1.5 rounded-full bg-accent"
                initial={false}
                animate={{ width: `${requiredCount ? (uploadedRequired / requiredCount) * 100 : 0}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-[10px] text-caption mt-1">
              {uploadedRequired === requiredCount
                ? 'Ready to continue — all required files present.'
                : `Upload ${requiredCount - uploadedRequired} more required file${requiredCount - uploadedRequired !== 1 ? 's' : ''} to unlock the next step.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-caption font-semibold">Files uploaded</p>
            <p className="text-2xl font-black text-brand-dark leading-none mt-0.5">{totalUploaded}<span className="text-sm font-normal text-caption"> / {visibleSlots.length}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {visibleSlots.map((slot) => (
          <div key={slot.key}>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs font-semibold text-brand-dark">{slot.label}</label>
              {slot.required && <span className="text-red-500 text-xs">*</span>}
              {sheets[slot.key] && (
                <span className="text-[10px] text-brand-purple bg-accent-50 border border-brand-purple/20 rounded px-1.5 py-0.5 ml-1">
                  sheet: {sheets[slot.key]}
                </span>
              )}
            </div>
            <DropZone slot={slot} file={files[slot.key] || null} onChange={setFile(slot.key)} />
          </div>
        ))}
      </div>

      {sessionId && <DiscoveryQRESection sessionId={sessionId} />}

      {sessionId && skillPath && (
        <QuestionnaireSection sessionId={sessionId} skillPath={skillPath} />
      )}

      {coverage && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          <h3 className="text-sm font-bold text-brand-dark mb-3">Dimension Coverage Preview</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(coverage).map(([dim, status]) => (
              <span key={dim} className={cn('text-xs px-2 py-1 rounded font-medium', COVERAGE_COLORS[status] || 'bg-bg-muted text-caption')}>
                {dim}: {status}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button onClick={() => { setScreen('setup'); navigate('/setup') }}
          className="flex items-center gap-2 border border-bg-secondary text-brand-dark px-5 py-2 rounded text-sm hover:bg-bg-secondary transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex flex-col items-end gap-2">
          {loading && (
            <div className="w-48">
              <div className="w-full bg-bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-1.5 rounded-full bg-brand-purple"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadPct}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-caption text-right mt-1">
                {uploadPct < 100 ? `${uploadPct}% uploaded…` : 'Processing…'}
              </p>
            </div>
          )}
          <button onClick={handleNext} disabled={loading}
            className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-dark transition-colors disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
