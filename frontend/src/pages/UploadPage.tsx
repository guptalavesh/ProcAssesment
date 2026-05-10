import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, ChevronRight, ChevronLeft, Loader2, CheckCircle, FileSpreadsheet, Sparkles, AlertTriangle } from 'lucide-react'
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

const SLOT_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  FILE_SLOTS.map(s => [s.key, s.label]),
)

interface SheetMeta {
  name: string
  columns?: string[]
  row_count_sample?: number
  suggested_slot: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  error?: string
}

interface InspectedFile {
  filename: string
  size_kb?: number
  error?: string
  sheets: SheetMeta[]
}

// ── Per-slot drop zone with inline sheet picker ──────────────────────────────
function DropZone({
  slot, file, sheetName, sheetOptions, onChange, onSheetChange,
}: {
  slot: FileSlot
  file: File | null
  sheetName: string | null
  sheetOptions: string[]
  onChange: (f: File | null) => void
  onSheetChange: (s: string | null) => void
}) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) onChange(accepted[0]) }, [onChange])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
    },
  })
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'border rounded-md p-3 transition-colors cursor-pointer bg-white',
          isDragActive ? 'border-accent bg-accent-50' :
          file ? 'border-success bg-success-soft' :
          'border-dashed border-neutral-200 hover:border-neutral-300',
        )}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-2">
          {file ? <CheckCircle size={16} className="text-success flex-shrink-0" />
                : <Upload size={16} className="text-neutral-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate text-neutral-900">{file ? file.name : slot.label}</p>
            {!file && <p className="text-[11px] text-neutral-500">{slot.hint}</p>}
            {file && <p className="text-[11px] text-success-fg">{(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          {file && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              className="text-neutral-400 hover:text-danger"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Sheet picker — only when xlsx has > 1 sheet */}
      {file && sheetOptions.length > 1 && (
        <div className="flex items-center gap-2 pl-1">
          <label className="text-[11px] text-neutral-500 font-medium">Sheet:</label>
          <select
            value={sheetName ?? sheetOptions[0]}
            onChange={(e) => onSheetChange(e.target.value)}
            className="text-[12px] border border-neutral-200 rounded-sm px-1.5 py-0.5 bg-white focus:outline-none focus:border-accent"
          >
            {sheetOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Smart multi-drop zone — auto-classify many files at once ─────────────────
function SmartUploadZone({
  visibleSlots, isProcurement, onApply,
}: {
  visibleSlots: FileSlot[]
  isProcurement: boolean
  onApply: (assigned: { file: File; slotKey: string; sheetName: string | null }[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [inspecting, setInspecting] = useState(false)
  const [inspected, setInspected] = useState<InspectedFile[]>([])
  const [picks, setPicks] = useState<Record<string, { slot: string; enabled: boolean }>>({}) // key = filename::sheetName
  const [error, setError] = useState('')

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return
    setPendingFiles(accepted)
    setOpen(true)
    setInspecting(true)
    setError('')
    try {
      const result = await api.inspectFiles(accepted)
      setInspected(result.files)
      const initial: typeof picks = {}
      for (const f of result.files) {
        for (const s of f.sheets) {
          const key = `${f.filename}::${s.name}`
          initial[key] = { slot: s.suggested_slot, enabled: s.confidence !== 'low' }
        }
      }
      setPicks(initial)
    } catch (e: any) {
      setError(e.message || 'Failed to inspect files')
    } finally {
      setInspecting(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
    },
  })

  const cancel = () => {
    setOpen(false)
    setPendingFiles([])
    setInspected([])
    setPicks({})
    setError('')
  }

  const apply = () => {
    const out: { file: File; slotKey: string; sheetName: string | null }[] = []
    const usedSlots = new Set<string>()
    for (const f of inspected) {
      const localFile = pendingFiles.find(pf => pf.name === f.filename)
      if (!localFile) continue
      // For each file, pick the first ENABLED sheet (multi-sheet → user picks
      // explicitly via the slot dropdowns; we route the file via the
      // *_sheet form param the backend already supports).
      for (const s of f.sheets) {
        const key = `${f.filename}::${s.name}`
        const pick = picks[key]
        if (!pick || !pick.enabled) continue
        if (usedSlots.has(pick.slot)) continue   // one file per slot
        usedSlots.add(pick.slot)
        out.push({
          file: localFile,
          slotKey: pick.slot,
          sheetName: f.sheets.length > 1 ? s.name : null,
        })
        break
      }
    }
    onApply(out)
    cancel()
  }

  return (
    <>
      <div
        {...getRootProps()}
        className={cn(
          'rounded-md border border-dashed p-4 cursor-pointer transition-colors mb-5 bg-white flex items-center gap-3',
          isDragActive ? 'border-accent bg-accent-50' : 'border-neutral-200 hover:border-accent',
        )}
      >
        <input {...getInputProps()} />
        <div className="w-10 h-10 rounded-md bg-accent-50 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">Smart upload — drop multiple files at once</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            We'll inspect each file (and each sheet for xlsx), auto-classify it to the right slot, and let you confirm before applying.
          </p>
        </div>
        <span className="text-[11px] text-accent font-medium flex-shrink-0">Drop files here</span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6"
            onClick={cancel}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-neutral-150 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-neutral-900">Review smart upload</p>
                  <p className="text-[12px] text-neutral-500 mt-0.5">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ·{' '}
                    {inspected.reduce((s, f) => s + f.sheets.length, 0)} sheet{inspected.reduce((s, f) => s + f.sheets.length, 0) !== 1 ? 's' : ''} detected
                  </p>
                </div>
                <button onClick={cancel} aria-label="Close" className="text-neutral-500 hover:text-neutral-900">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {inspecting && (
                  <div className="flex items-center gap-2 text-neutral-500 text-[13px]">
                    <Loader2 size={14} className="animate-spin" /> Inspecting…
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-danger-soft border border-danger/20 rounded-sm text-[13px] text-danger-fg">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
                  </div>
                )}
                {inspected.map((f) => (
                  <div key={f.filename} className="border border-neutral-150 rounded-sm">
                    <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-150 flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-neutral-500" />
                      <span className="text-[13px] font-medium text-neutral-900 truncate flex-1">{f.filename}</span>
                      <span className="text-[11px] text-neutral-500">{f.size_kb?.toFixed?.(0)} KB</span>
                    </div>
                    {f.error ? (
                      <p className="px-3 py-2 text-[12px] text-danger-fg">{f.error}</p>
                    ) : f.sheets.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-neutral-500">No sheets detected</p>
                    ) : (
                      <div className="divide-y divide-neutral-150">
                        {f.sheets.map(s => {
                          const key = `${f.filename}::${s.name}`
                          const pick = picks[key] || { slot: s.suggested_slot, enabled: false }
                          const confColor = s.confidence === 'high' ? 'bg-success-soft text-success-fg'
                                          : s.confidence === 'medium' ? 'bg-warning-soft text-warning-fg'
                                          : 'bg-neutral-100 text-neutral-500'
                          return (
                            <div key={key} className="px-3 py-2 flex items-center gap-3 flex-wrap">
                              <input
                                type="checkbox"
                                checked={pick.enabled}
                                onChange={(e) => setPicks(p => ({ ...p, [key]: { ...pick, enabled: e.target.checked } }))}
                                className="accent-accent"
                              />
                              <span className="text-[13px] text-neutral-900 min-w-0 truncate flex-1">
                                {s.name}{' '}
                                {s.row_count_sample !== undefined && <span className="text-neutral-400 text-[11px]">· {s.row_count_sample}+ rows sampled</span>}
                              </span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', confColor)}>
                                {s.confidence}
                              </span>
                              <select
                                value={pick.slot}
                                onChange={(e) => setPicks(p => ({ ...p, [key]: { ...pick, slot: e.target.value } }))}
                                className="text-[12px] border border-neutral-200 rounded-sm px-1.5 py-0.5 bg-white"
                              >
                                {visibleSlots.map(slot => (
                                  <option key={slot.key} value={slot.key}>→ {slot.label}</option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-neutral-150 flex items-center justify-between gap-3">
                <p className="text-[11px] text-neutral-500">
                  Only enabled rows are applied. One file per slot — multi-sheet picks the chosen sheet via the backend's <code className="text-[11px] font-mono">_sheet</code> form param.
                </p>
                <div className="flex gap-2">
                  <button onClick={cancel} className="btn btn-sec">Cancel</button>
                  <button onClick={apply} disabled={inspecting} className="btn btn-pri">
                    Apply assignments
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const COVERAGE_COLORS: Record<string, string> = {
  scoreable:    'text-success-fg bg-success-soft',
  partial:      'text-warning-fg bg-warning-soft',
  insufficient: 'text-danger-fg bg-danger-soft',
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { sessionId, isProcurement, skillPath, setUploadResult, setScreen } = useAssessmentStore()
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [sheets, setSheets] = useState<Record<string, string | null>>({})
  // Per-slot list of available sheet names — populated when a file is dropped.
  const [sheetOptions, setSheetOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState('')
  const [coverage, setCoverage] = useState<Record<string, string> | null>(null)

  // Inspect a single dropped file to learn its sheet names. The backend
  // /files/inspect endpoint also returns a slot suggestion, but here we only
  // care about the sheet list so the per-slot dropdown can populate.
  const inspectAndStore = useCallback(async (slotKey: string, file: File) => {
    try {
      const res = await api.inspectFiles([file])
      const meta = res.files[0]
      if (meta?.sheets?.length) {
        const names = meta.sheets.map(s => s.name)
        setSheetOptions(prev => ({ ...prev, [slotKey]: names }))
        // Default to the first sheet so the backend gets an explicit pick.
        setSheets(prev => ({ ...prev, [slotKey]: names.length > 1 ? names[0] : null }))
      } else {
        setSheetOptions(prev => ({ ...prev, [slotKey]: [] }))
      }
    } catch {
      setSheetOptions(prev => ({ ...prev, [slotKey]: [] }))
    }
  }, [])

  const setFile = (key: string) => (f: File | null) => {
    setFiles(prev => ({ ...prev, [key]: f }))
    setSheets(prev => ({ ...prev, [key]: null }))
    setSheetOptions(prev => ({ ...prev, [key]: [] }))
    if (f && f.name.toLowerCase().endsWith('.xlsx')) {
      inspectAndStore(key, f)
    }
  }

  const setSheet = (key: string) => (s: string | null) => {
    setSheets(prev => ({ ...prev, [key]: s }))
  }

  // Smart-upload apply: replace per-slot files in one shot.
  const applySmartUpload = (assignments: { file: File; slotKey: string; sheetName: string | null }[]) => {
    const newFiles: Record<string, File | null> = { ...files }
    const newSheets: Record<string, string | null> = { ...sheets }
    for (const a of assignments) {
      newFiles[a.slotKey] = a.file
      newSheets[a.slotKey] = a.sheetName
    }
    setFiles(newFiles)
    setSheets(newSheets)
    // Refresh sheet options for each newly-assigned file so the per-slot
    // picker shows the right list.
    for (const a of assignments) {
      if (a.file.name.toLowerCase().endsWith('.xlsx')) {
        inspectAndStore(a.slotKey, a.file)
      }
    }
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
      <PageHeader title="Upload data files" subtitle="Upload SAP exports and optional supporting data" />

      <p className="eyebrow mb-4">Step 2 of 4 · Data upload</p>

      {error && <div className="mb-4 px-3 py-2 bg-danger-soft border border-danger/20 text-danger-fg rounded-sm text-[13px]">{error}</div>}

      <SmartUploadZone visibleSlots={visibleSlots} isProcurement={isProcurement} onApply={applySmartUpload} />

      <div className="acc-card mb-5 py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="eyebrow">File coverage</p>
            <p className="text-[15px] font-semibold text-neutral-900 mt-0.5">
              <span className="num">{uploadedRequired}/{requiredCount}</span> required
              {uploadedOptional > 0 && <span className="text-neutral-500 font-normal"> · +{uploadedOptional} optional</span>}
            </p>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative w-full h-1.5 bg-neutral-150 rounded-full overflow-hidden">
              <motion.div
                className="h-1.5 rounded-full bg-accent"
                initial={false}
                animate={{ width: `${requiredCount ? (uploadedRequired / requiredCount) * 100 : 0}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {uploadedRequired === requiredCount
                ? 'Ready to continue — all required files present.'
                : `Upload ${requiredCount - uploadedRequired} more required file${requiredCount - uploadedRequired !== 1 ? 's' : ''} to unlock the next step.`}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Files uploaded</p>
            <p className="text-[24px] num font-semibold text-neutral-900 leading-none mt-1">
              {totalUploaded}<span className="text-[14px] font-normal text-neutral-500"> / {visibleSlots.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {visibleSlots.map((slot) => (
          <div key={slot.key}>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[12px] font-medium text-neutral-700">{slot.label}</label>
              {slot.required && <span className="text-danger text-[12px]">*</span>}
            </div>
            <DropZone
              slot={slot}
              file={files[slot.key] || null}
              sheetName={sheets[slot.key] || null}
              sheetOptions={sheetOptions[slot.key] || []}
              onChange={setFile(slot.key)}
              onSheetChange={setSheet(slot.key)}
            />
          </div>
        ))}
      </div>

      {sessionId && <DiscoveryQRESection sessionId={sessionId} />}

      {sessionId && skillPath && (
        <QuestionnaireSection sessionId={sessionId} skillPath={skillPath} />
      )}

      {coverage && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card mb-6">
          <h3 className="text-[15px] font-semibold text-neutral-900 mb-3">Dimension coverage preview</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(coverage).map(([dim, status]) => (
              <span key={dim} className={cn('text-[12px] px-2 py-1 rounded-sm font-medium', COVERAGE_COLORS[status] || 'bg-neutral-100 text-neutral-500')}>
                {dim}: {status}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-between items-center">
        <button onClick={() => { setScreen('setup'); navigate('/setup') }} className="btn btn-sec btn-lg">
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex flex-col items-end gap-2">
          {loading && (
            <div className="w-48">
              <div className="w-full bg-neutral-150 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-1.5 rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadPct}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-neutral-500 text-right mt-1">
                {uploadPct < 100 ? `${uploadPct}% uploaded…` : 'Processing…'}
              </p>
            </div>
          )}
          <button onClick={handleNext} disabled={loading} className="btn btn-pri btn-lg">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
