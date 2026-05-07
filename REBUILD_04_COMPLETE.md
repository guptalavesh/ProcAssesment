# REBUILD_04 — Results Components (Dashboard, RCA, Offerings, KPI Charts)

## Overview
All components rendered on the Results page: ScoreHero, KpiBucketCards, AiInsightsMini, DimensionsTab, MaturityRadar, RCATab, KpiDashboard (21-KPI interactive charts), AiUsecasesTab (agentic S2P catalogue + business-case calculator), OfferingsTab (full 3502-line offerings catalogue), and ProgramTimelineModal.

---

## frontend/src/pages/ResultsPage.tsx

```tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, LayoutGrid, BarChart3, Search, Briefcase, AlertTriangle, ArrowRight } from 'lucide-react'
import ScoreHero from '@/components/results/ScoreHero'
import KpiBucketCards from '@/components/results/KpiBucketCards'
import KpiDashboard from '@/components/results/KpiDashboard'
import RCATab from '@/components/results/RCATab'
import OfferingsTab from '@/components/results/OfferingsTab'
import AiInsightsMini from '@/components/results/AiInsightsMini'
import ProgramTimelineModal from '@/components/results/ProgramTimelineModal'
import AiUsecasesTab from '@/components/results/AiUsecasesTab'
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { AssessmentResults, KPIResult } from '@/lib/types'
import { cn, formatCr, formatPct, roundN } from '@/lib/utils'

/** Format KPI value for display — overrides backend's decimal strings. */
function fmtKpiVal(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—'
  if (unit === '₹ Cr')   return formatCr(value)
  if (unit === 'days')   return `${roundN(value)} days`
  // '%' here means a fraction (0.42), engine multiplies by 100 in formatted_*. Match that.
  if (unit === '%' || unit === '' || unit === 'fraction' || !unit) return formatPct(value * 100)
  return `${roundN(value)} ${unit}`
}
import { toast } from '@/components/ui/Toast'

type Tab = 'kpi' | 'dashboard' | 'rca' | 'offerings'

const TAB_PREAMBLES: Record<Tab, string> = {
  kpi:       'Your KPI landscape at a glance. Click any row for the full insight, root cause, and recommended action.',
  dashboard: 'Interactive charts across every bucket and KPI. Filter by bucket using the cards above.',
  rca:       'Systemic drivers behind your gaps, grouped by bucket. The highest-priority bucket is expanded by default.',
  offerings: 'Accenture services mapped to your actual findings — including buying channel logic, agentic AI use-cases and a strategic category structure inferred from your PO data.',
}

// ── Score badge ───────────────────────────────────────────────────────────────

function scoreBadgeClass(score: number | null): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-500'
  if (score >= 4) return 'bg-green-100 text-green-800'
  if (score >= 3) return 'bg-blue-100 text-blue-800'
  if (score >= 2) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

// ── Gap indicator ─────────────────────────────────────────────────────────────

function GapIndicator({ gapPct, direction }: { gapPct: number | null; direction: string }) {
  if (gapPct === null || gapPct === undefined) return <span className="text-caption">—</span>
  // Engine emits gap_pct in fraction form (0.35 = 35%). Some KPIs (like savings_lpo)
  // produce values where the denominator is tiny and the ratio explodes (e.g. 15.13).
  // Treat any |gap| > 5 as already-percent and clamp at 999% so the badge stays readable.
  const raw = Math.abs(gapPct)
  let absPct: number
  if (raw > 5)         absPct = Math.min(raw, 999)         // already in percent / extreme outlier
  else if (raw <= 1.5) absPct = raw * 100                  // fraction → percent
  else                 absPct = raw                        // already percent
  const isAbove = direction === 'higher_is_better' ? gapPct >= 0 : gapPct <= 0
  const Icon = isAbove ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', isAbove ? 'text-green-600' : 'text-red-600')}>
      <Icon size={11} /> {absPct.toFixed(0)}%
    </span>
  )
}

// ── Expandable KPI row ────────────────────────────────────────────────────────

function KpiRow({ kpi, highlighted }: { kpi: KPIResult; highlighted?: boolean }) {
  const [open, setOpen] = useState(false)
  // When AI chip click highlights this row, auto-expand and flash it
  useEffect(() => {
    if (highlighted) setOpen(true)
  }, [highlighted])
  return (
    <>
      <tr
        className={cn(
          'cursor-pointer hover:bg-bg-secondary/60 transition-colors',
          highlighted && 'bg-purple-100 animate-pulse',
        )}
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2 pl-4 pr-2">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronUp size={12} className="text-caption flex-shrink-0" /> : <ChevronDown size={12} className="text-caption flex-shrink-0" />}
            <span className="font-medium text-brand-dark">{kpi.label}</span>
            {kpi.data_source === 'unavailable' && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium ml-1">N/A</span>
            )}
          </div>
        </td>
        <td className="text-center font-mono py-2 text-caption text-[11px]">{fmtKpiVal(kpi.actual, kpi.unit)}</td>
        <td className="text-center font-mono py-2 text-caption text-[11px]">{fmtKpiVal(kpi.benchmark, kpi.unit)}</td>
        <td className="text-center py-2">
          {kpi.score != null ? (
            <span className={cn('text-xs px-2 py-0.5 rounded font-black', scoreBadgeClass(kpi.score))}>
              {kpi.score}/4
            </span>
          ) : <span className="text-caption text-xs">—</span>}
        </td>
        <td className="text-center py-2">
          <GapIndicator gapPct={kpi.gap_pct ?? null} direction={kpi.direction} />
        </td>
        <td className="text-center py-2">
          {kpi.actual != null ? (
            <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', kpi.has_gap ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
              {kpi.has_gap ? 'Gap' : 'On Track'}
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-500">—</span>
          )}
        </td>
      </tr>
      <AnimatePresence>
        {open && (
          <tr key="detail">
            <td colSpan={6} className="px-0 pb-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mb-3 mt-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {kpi.insight && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs">
                      <p className="font-bold text-blue-800 mb-1 uppercase tracking-wide text-[10px]">Insight</p>
                      <p className="text-blue-900 leading-relaxed">{kpi.insight}</p>
                    </div>
                  )}
                  {kpi.action && (
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded text-xs">
                      <p className="font-bold text-brand-dark mb-1 uppercase tracking-wide text-[10px]">Recommended Action</p>
                      <p className="text-brand-dark leading-relaxed">{kpi.action}</p>
                    </div>
                  )}
                  {kpi.benefit && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded text-xs">
                      <p className="font-bold text-green-800 mb-1 uppercase tracking-wide text-[10px]">Expected Benefit</p>
                      <p className="text-green-900 leading-relaxed">{kpi.benefit}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

// ── KPI Buckets — collapsed by default, expandable ────────────────────────────

function KpiBuckets({
  kpiResults,
  computedKpis,
  activeBucket,
  highlightedKpi,
}: {
  kpiResults: Record<string, KPIResult>
  computedKpis: string[]
  activeBucket: string | null
  highlightedKpi?: string | null
}) {
  const [showUnavailable, setShowUnavailable] = useState(false)
  // All buckets start CLOSED — user expands each
  const [openBuckets, setOpenBuckets] = useState<Set<string>>(new Set())

  // Auto-open the bucket containing a highlighted KPI
  useEffect(() => {
    if (!highlightedKpi) return
    const target = Object.values(kpiResults).find(
      (k) =>
        k.label?.toLowerCase().includes(highlightedKpi.toLowerCase()) ||
        k.kpi_id?.toLowerCase().includes(highlightedKpi.toLowerCase().replace(/\s+/g, '_'))
    )
    if (target) setOpenBuckets((prev) => new Set(prev).add(target.bucket))
  }, [highlightedKpi, kpiResults])

  const bucketMap: Record<string, KPIResult[]> = {}
  for (const kpi of Object.values(kpiResults)) {
    if (!bucketMap[kpi.bucket]) bucketMap[kpi.bucket] = []
    bucketMap[kpi.bucket].push(kpi)
  }

  const unavailableCount = Object.values(kpiResults).filter(k => !computedKpis.includes(k.kpi_id)).length

  const toggleBucket = (bucket: string) => {
    setOpenBuckets(prev => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

  // Filter by active bucket if set
  const bucketEntries = Object.entries(bucketMap).filter(([bucket]) =>
    activeBucket == null || bucket === activeBucket
  )

  return (
    <div className="space-y-2">
      {unavailableCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-caption">
            {computedKpis.length} computed · {unavailableCount} unavailable{showUnavailable ? '' : ' (hidden)'}
          </span>
          <button onClick={() => setShowUnavailable(v => !v)} className="text-xs text-brand-purple hover:underline font-medium">
            {showUnavailable ? 'Hide unavailable' : `Show ${unavailableCount} unavailable`}
          </button>
        </div>
      )}

      {bucketEntries.map(([bucket, kpis]) => {
        const visibleKpis = showUnavailable ? kpis : kpis.filter(k => computedKpis.includes(k.kpi_id))
        if (visibleKpis.length === 0) return null

        const isOpen = openBuckets.has(bucket)
        const scoredKpis = visibleKpis.filter(k => k.score != null)
        const bucketScore = scoredKpis.length > 0
          ? Math.round(scoredKpis.reduce((s, k) => s + (k.score ?? 0), 0) / scoredKpis.length * 10) / 10
          : null
        const hasGap = visibleKpis.some(k => k.has_gap)
        const gapCount = visibleKpis.filter(k => k.has_gap).length

        return (
          <div key={bucket} className="acc-card overflow-hidden p-0">
            {/* Bucket header — always visible, shows score */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary/60 hover:bg-bg-secondary transition-colors"
              onClick={() => toggleBucket(bucket)}
            >
              <div className="flex items-center gap-2.5">
                {isOpen
                  ? <ChevronUp size={14} className="text-caption flex-shrink-0" />
                  : <ChevronDown size={14} className="text-caption flex-shrink-0" />}
                <span className="text-sm font-bold text-brand-dark">{bucket}</span>
                <span className="text-xs text-caption">{visibleKpis.length} KPI{visibleKpis.length !== 1 ? 's' : ''}</span>
                {hasGap && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                    {gapCount} gap{gapCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {/* Score prominently on right */}
              <div className="flex items-center gap-2">
                {bucketScore != null && (
                  <>
                    <span className="text-xs text-caption">Score</span>
                    <span className={cn('text-sm font-black px-2.5 py-0.5 rounded-full', scoreBadgeClass(Math.round(bucketScore)))}>
                      {bucketScore.toFixed(0)} / 4
                    </span>
                  </>
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-bg-secondary bg-white">
                        <th className="text-left py-2 pl-4 pr-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[180px]">KPI</th>
                        <th className="text-center py-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[80px]">Value</th>
                        <th className="text-center py-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[90px]">Benchmark</th>
                        <th className="text-center py-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[70px]">Score</th>
                        <th className="text-center py-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[60px]">Gap</th>
                        <th className="text-center py-2 font-semibold text-caption uppercase tracking-wide text-xs min-w-[80px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bg-secondary/50">
                      {visibleKpis.map(kpi => {
                        const isHighlighted = !!highlightedKpi && (
                          kpi.label?.toLowerCase().includes(highlightedKpi.toLowerCase()) ||
                          kpi.kpi_id?.toLowerCase().includes(highlightedKpi.toLowerCase().replace(/\s+/g, '_'))
                        )
                        return <KpiRow key={kpi.kpi_id} kpi={kpi} highlighted={isHighlighted} />
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-caption px-4 py-1.5 italic bg-bg-secondary/30">
                    Click any row to see insight, action &amp; benefit
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {bucketEntries.length === 0 && activeBucket && (
        <p className="text-caption text-sm text-center py-6">No KPIs found for "{activeBucket}" bucket.</p>
      )}
    </div>
  )
}

// ── Main ResultsPage ──────────────────────────────────────────────────────────

export default function ResultsPage() {
  const navigate = useNavigate()
  const { sessionId, clientName, setResults, isProcurement, setSessionId, aiInsights, aiLoading, setAiInsight, setAiLoading, setAiError } = useAssessmentStore()
  const [results, setLocalResults] = useState<AssessmentResults | null>(null)
  const [tab, setTab] = useState<Tab>('kpi')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadingPpt, setDownloadingPpt] = useState(false)
  const [downloadingProposal, setDownloadingProposal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [activeBucket, setActiveBucket] = useState<string | null>(null)
  const [highlightedKpi, setHighlightedKpi] = useState<string | null>(null)

  // Pre-fetch all AI insight contexts on Results mount — no Generate buttons.
  // Insights are part of the assessment, not an opt-in feature.
  useEffect(() => {
    if (!sessionId || !results?.kpi_assessment) return
    const contexts: ('kpi_overview' | 'rca' | 'offerings')[] = ['kpi_overview', 'rca', 'offerings']
    contexts.forEach((ctx) => {
      // Skip if already loaded or in-flight
      if (aiInsights[ctx] || aiLoading[ctx]) return
      setAiLoading(ctx, true)
      fetch(`/api/v1/session/${sessionId}/results/ai-tab-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx, force_refresh: false }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
            throw new Error(err.detail || 'Failed')
          }
          return res.json()
        })
        .then((d) => setAiInsight(ctx, d.insights))
        .catch((e: any) => setAiError(ctx, e.message))
        .finally(() => setAiLoading(ctx, false))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, results?.kpi_assessment])

  // When user clicks a KPI chip in an AI insight card, scroll the table to that KPI
  // and flash-highlight it. Bidirectional binding between commentary and data.
  const handleKpiChipClick = (kpiName: string) => {
    setActiveBucket(null) // clear bucket filter so row is visible
    setTab('kpi')
    setHighlightedKpi(kpiName)
    // clear highlight after 2.5s
    setTimeout(() => setHighlightedKpi(null), 2500)
  }

  useEffect(() => {
    if (!sessionId) {
      // No stored session — create a fresh one silently so the process map loads
      api.createSession()
        .then(r => setSessionId(r.session_id))
        .catch(() => setLoading(false))
      return   // loading stays true; re-runs when sessionId propagates
    }
    api.getResults(sessionId)
      .then(r => { setLocalResults(r); setResults(r) })
      .catch(e => {
        const msg: string = e.message
        if (msg.includes('not found or expired')) {
          // Stale session (backend restarted) — create a fresh one and show process map
          api.createSession()
            .then(r => setSessionId(r.session_id))
            .catch(() => {})
          setError('Assessment not run yet.')
        } else {
          setError(msg)
        }
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  const handleDownload = async () => {
    if (!sessionId) return
    setDownloading(true)
    try {
      // Use the new KPI-based report endpoint (21 KPIs + AI insights)
      const res = await fetch(`/api/v1/session/${sessionId}/download/kpi-report`)
      if (!res.ok) {
        // Fallback to old v1 report if new endpoint fails
        const res2 = await fetch(api.getDownloadUrl(sessionId))
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`)
        const blob2 = await res2.blob()
        const url2 = URL.createObjectURL(blob2)
        const a2 = Object.assign(document.createElement('a'), {
          href: url2,
          download: `${clientName || 'Assessment'}_Maturity_Assessment.xlsx`,
        })
        document.body.appendChild(a2); a2.click(); document.body.removeChild(a2)
        URL.revokeObjectURL(url2)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const fnMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = fnMatch ? fnMatch[1] : `${clientName || 'Assessment'}_Procurement_Assessment.xlsx`
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const handlePptDownload = async () => {
    if (!sessionId) return
    setDownloadingPpt(true)
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/export/ppt`)
      if (!res.ok) {
        const ct = res.headers.get('content-type') || ''
        const errText = ct.includes('json') ? ((await res.json()).detail || 'PPT export failed') : await res.text()
        throw new Error(errText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const fnMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = fnMatch ? fnMatch[1] : 'Procurement_Assessment.pptx'
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(`PPT export failed: ${e.message}`)
    } finally {
      setDownloadingPpt(false)
    }
  }

  const handleProposalDownload = async () => {
    if (!sessionId) return
    setDownloadingProposal(true)
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/export/ppt/proposal`)
      if (!res.ok) {
        const ct = res.headers.get('content-type') || ''
        const errText = ct.includes('json') ? ((await res.json()).detail || 'Proposal export failed') : await res.text()
        throw new Error(errText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const fnMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = fnMatch ? fnMatch[1] : 'Procurement_Transformation_Proposal.pptx'
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(`Proposal export failed: ${e.message}`)
    } finally {
      setDownloadingProposal(false)
    }
  }

  const handleBucketClick = (bucket: string | null) => {
    setActiveBucket(bucket)
    // Navigate to the relevant tab if switching
    if (bucket !== null && tab !== 'kpi' && tab !== 'rca') {
      setTab('kpi')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  // Hard session errors block the whole page; "not run yet" just shows the process map
  const assessmentNotRun = error === 'Assessment not run yet.'
  if (error && !assessmentNotRun) return (
    <div className="text-center py-12">
      <p className="text-red-600 mb-3">{error}</p>
      <button onClick={() => navigate('/configure')} className="text-brand-purple text-sm underline">← Back</button>
    </div>
  )

  // Assessment not run — show process map only
  if (assessmentNotRun || !results) {
    if (!sessionId) return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-purple" size={32} />
      </div>
    )
    return (
      <div>
        {assessmentNotRun && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            ⚠️ Assessment hasn't been run yet. Showing the S2P Process Map — complete the assessment to unlock KPI results, dashboards and recommendations.
          </div>
        )}
        <OfferingsTab
          kpiAssessment={null}
          engagement={{} as any}
          sessionId={sessionId}
          dimResults={[]}
        />
      </div>
    )
  }

  // Show RCA if isProcurement (set during setup) OR if kpi_assessment is present
  // (handles page refresh where isProcurement resets to false)
  const showRca = isProcurement || !!results.kpi_assessment

  type TabDef = { id: Tab; label: string; Icon: React.ElementType }
  const TABS: TabDef[] = [
    { id: 'kpi',         label: 'KPI Overview',        Icon: LayoutGrid },
    { id: 'dashboard',   label: 'Dashboard',            Icon: BarChart3  },
    ...(showRca ? [{ id: 'rca' as Tab, label: 'Root Cause Analysis', Icon: Search    }] : []),
    { id: 'offerings',   label: 'Offerings',            Icon: Briefcase  },
  ]

  const kpiResults  = results.kpi_assessment?.kpi_results ?? {}
  const computedKpis = results.kpi_assessment?.computed_kpis ?? []

  return (
    <div>
      {/* Program Timeline + PPT config modal */}
      {showTimelineModal && sessionId && (
        <ProgramTimelineModal
          sessionId={sessionId}
          onClose={() => setShowTimelineModal(false)}
          onExport={() => { setShowTimelineModal(false); handlePptDownload() }}
          exporting={downloadingPpt}
        />
      )}

      {/* Top bar — engagement metadata + exports */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-caption min-w-0 overflow-hidden">
          <span className="font-semibold text-brand-dark truncate">{results.engagement.client_name}</span>
          {results.engagement.assessment_type && (
            <><span className="opacity-40">·</span><span className="truncate">{results.engagement.assessment_type}</span></>
          )}
          {results.engagement.date && (
            <><span className="opacity-40">·</span><span className="truncate">{results.engagement.date}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowTimelineModal(true)}
            disabled={downloadingPpt}
            className="flex items-center gap-1.5 text-xs border border-brand-purple text-brand-purple px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-60"
          >
            {downloadingPpt ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            KPI Deck
          </button>
          <button
            onClick={handleProposalDownload}
            disabled={downloadingProposal}
            className="flex items-center gap-1.5 text-xs border border-teal-600 text-teal-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-teal-50 transition-colors disabled:opacity-60"
          >
            {downloadingProposal ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Proposal Deck
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs bg-brand-purple text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Download Excel
          </button>
        </div>
      </div>

      <ScoreHero
        overall={results.overall}
        kpiAssessment={results.kpi_assessment}
        clientName={clientName || results.engagement.client_name}
        isProcurement={isProcurement}
      />

      {/* Key Findings Banner */}
      {results.kpi_assessment && (() => {
        const allKpis = Object.values(results.kpi_assessment.kpi_results)
        const computed = computedKpis
        const belowBenchmark = allKpis.filter(k => computed.includes(k.kpi_id) && k.has_gap)
        const biggestGap = allKpis
          .filter(k => computed.includes(k.kpi_id) && k.score != null)
          .sort((a, b) => (a.score ?? 4) - (b.score ?? 4))[0]
        const buckets = Object.values(results.kpi_assessment.bucket_results)
        const weakestBucket = buckets
          .filter(b => (b as any).score != null)
          .sort((a, b) => ((a as any).score ?? 4) - ((b as any).score ?? 4))[0]
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="acc-card py-3 px-4 border-l-4 border-l-red-400">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-0.5">KPIs Below Benchmark</p>
              <p className="text-2xl font-black text-brand-dark">{belowBenchmark.length}<span className="text-sm font-normal text-caption"> / {computed.length}</span></p>
              <p className="text-xs text-caption mt-0.5">KPIs currently underperforming</p>
            </div>
            <div className="acc-card py-3 px-4 border-l-4 border-l-amber-400">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-0.5">Biggest Gap</p>
              <p className="text-sm font-bold text-brand-dark truncate">{biggestGap?.label ?? '—'}</p>
              <p className="text-xs text-caption mt-0.5 flex items-center gap-1">
                <ArrowRight size={10} />
                Score {biggestGap?.score?.toFixed(0) ?? '—'} / 4 · {biggestGap?.score_label ?? '—'}
              </p>
            </div>
            <div className="acc-card py-3 px-4 border-l-4 border-l-brand-purple">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-0.5">Top Opportunity</p>
              <p className="text-sm font-bold text-brand-dark truncate">{(weakestBucket as any)?.bucket ?? '—'}</p>
              <p className="text-xs text-caption mt-0.5 flex items-center gap-1">
                <AlertTriangle size={10} className="text-amber-500" />
                Score {((weakestBucket as any)?.score as number | undefined)?.toFixed(0) ?? '—'} / 4 · highest priority bucket
              </p>
            </div>
          </div>
        )
      })()}

      {/* Bucket filter cards — clicking filters KPI / RCA tabs */}
      {results.kpi_assessment && (
        <KpiBucketCards
          ka={results.kpi_assessment}
          activeBucket={activeBucket}
          onBucketClick={handleBucketClick}
        />
      )}

      {/* Filter pill — visible whenever a bucket filter is active */}
      <AnimatePresence>
        {activeBucket && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mb-3 flex items-center gap-2"
          >
            <span className="text-[10px] text-caption uppercase font-semibold tracking-wide">Filtered:</span>
            <span className="inline-flex items-center gap-1.5 bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold px-2.5 py-1 rounded-full">
              {activeBucket}
              <button
                onClick={() => setActiveBucket(null)}
                className="ml-0.5 w-4 h-4 rounded-full bg-brand-purple/20 hover:bg-brand-purple hover:text-white flex items-center justify-center text-[10px] transition-colors"
                aria-label="Clear filter"
                title="Clear filter"
              >×</button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-bg-secondary -mx-5 px-5 shadow-sm">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-brand-purple text-brand-purple'
                  : 'border-transparent text-caption hover:text-brand-dark',
              )}
            >
              <t.Icon size={14} className="flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="mt-4"
      >
        {/* Tab preamble — sets the frame for each section */}
        <p className="text-xs text-caption mb-3 leading-relaxed">{TAB_PREAMBLES[tab]}</p>

        {/* ── KPI Overview ── */}
        {tab === 'kpi' && (
          <div className="space-y-3">
            {sessionId && <AiInsightsMini sessionId={sessionId} context="kpi_overview" onKpiClick={handleKpiChipClick} />}
            {Object.keys(kpiResults).length > 0
              ? <KpiBuckets kpiResults={kpiResults} computedKpis={computedKpis} activeBucket={activeBucket} highlightedKpi={highlightedKpi} />
              : <p className="text-caption text-sm text-center py-8">No KPI results available.</p>
            }
          </div>
        )}

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && sessionId && (
          <KpiDashboard sessionId={sessionId} />
        )}

        {/* ── Root Cause Analysis ── */}
        {tab === 'rca' && showRca && (
          <div className="space-y-0">
            {sessionId && <AiInsightsMini sessionId={sessionId} context="rca" onKpiClick={handleKpiChipClick} />}
            <RCATab
              kpiAssessment={results.kpi_assessment}
              activeBucket={activeBucket}
            />
          </div>
        )}

        {/* ── Offerings ── */}
        {tab === 'offerings' && sessionId && (
          <OfferingsTab
            kpiAssessment={results.kpi_assessment}
            engagement={results.engagement}
            sessionId={sessionId}
            dimResults={results.dimension_results}
          />
        )}

      </motion.div>
    </div>
  )
}
```

---
## frontend/src/components/results/ScoreHero.tsx

```tsx
import { motion } from 'framer-motion'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import ScoreGauge from '@/components/ui/ScoreGauge'
import type { OverallResult, KPIAssessmentResult } from '@/lib/types'

interface Props {
  overall: OverallResult
  kpiAssessment: KPIAssessmentResult | null
  clientName: string
  isProcurement?: boolean
}

const LEVEL_DESC: Record<string, string> = {
  Foundation:    'Reactive, manual, limited visibility',
  Intermediate:  'Some standardisation, partial system enablement',
  Advanced:      'Structured, proactive, good system adoption',
  Leading:       'Best-in-class, predictive, digital-first',
}

export default function ScoreHero({ overall, kpiAssessment, clientName, isProcurement = false }: Props) {
  // Single hero gauge — KPI score wins when available, otherwise fall back to the
  // dimension-based overall. We never show two rings side-by-side; they confuse
  // the reader about "what is THE number for this assessment."
  const primaryScore = kpiAssessment ? kpiAssessment.overall_score : overall.score
  const primaryLabel = kpiAssessment ? kpiAssessment.overall_label : overall.level
  const scoreEyebrow = kpiAssessment ? 'KPI Score' : 'Overall Score'

  const computedKpis = kpiAssessment?.computed_kpis?.length ?? 0
  const totalKpis = 8
  const kpiCoverage = kpiAssessment ? `${computedKpis} / ${totalKpis}` : '—'

  const stripMetrics = isProcurement && kpiAssessment
    ? [
        { label: 'KPIs Computed',  value: kpiCoverage },
        { label: 'KPI Coverage',   value: `${Math.round((computedKpis / totalKpis) * 100)}%` },
        { label: 'Maturity Level', value: primaryLabel || '—' },
      ]
    : [
        { label: 'Dimensions Scored', value: `${overall.scored_dims} / ${overall.total_dims}` },
        { label: 'Active Weight',     value: `${overall.active_weight_pct?.toFixed(0)}%` },
        { label: 'Maturity Level',    value: overall.level || '—' },
      ]

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-semibold mb-1">{clientName}</p>
            <h1 className="text-white text-2xl font-bold m-0">
              {isProcurement ? 'Procurement KPI Assessment' : 'Maturity Assessment Results'}
            </h1>
            {primaryLabel && (
              <p className="text-white/80 text-sm mt-1">{LEVEL_DESC[primaryLabel] || primaryLabel}</p>
            )}
          </div>

          {/* Single hero gauge — shows the KPI score when available, dimension overall otherwise */}
          <div className="text-center relative flex flex-col items-center">
            <p className="text-white/70 text-[11px] uppercase tracking-[0.2em] font-bold mb-2">
              {scoreEyebrow}
            </p>
            <div className="relative w-40 h-40 flex items-center justify-center">
              <ScoreGauge score={primaryScore ?? 0} size={160} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[40px] font-black text-white leading-none tracking-tight">
                  <AnimatedCounter target={primaryScore ?? 0} decimals={0} />
                </div>
                <span className="text-[10px] font-semibold text-white/65 tracking-widest mt-1.5">OUT OF 4</span>
              </div>
            </div>
            <div className="mt-2 inline-block px-3.5 py-1 rounded-md text-xs font-bold tracking-wide"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {primaryLabel || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        {stripMetrics.map(m => (
          <div key={m.label} className="acc-card py-3 text-center">
            <p className="text-xs text-caption uppercase tracking-wide">{m.label}</p>
            <p className="text-lg font-bold text-brand-dark mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
```

---

## frontend/src/components/results/KpiBucketCards.tsx

```tsx
import { motion } from 'framer-motion'
import {
  Zap, TrendingUp, Truck, Monitor, ShieldCheck,
  BarChart2, Users, Settings, DollarSign, Package,
  Activity, Clock, Target, Cpu, FileCheck, type LucideIcon,
} from 'lucide-react'
import type { KPIAssessmentResult } from '@/lib/types'
import { scoreColor, scoreBg, cn } from '@/lib/utils'

interface Props {
  ka: KPIAssessmentResult
  activeBucket?: string | null
  onBucketClick?: (bucket: string | null) => void
}

const BUCKET_ICONS: Record<string, LucideIcon> = {
  'Efficiency':         Zap,
  'Effectiveness':      TrendingUp,
  'Vendor Management':  Truck,
  'Digitization':       Monitor,
  'Digital':            Monitor,
  'Risk Management':    ShieldCheck,
  'Cost':               DollarSign,
  'Spend':              BarChart2,
  'Compliance':         FileCheck,
  'People':             Users,
  'Process':            Settings,
  'Quality':            Activity,
  'Speed':              Clock,
  'Value':              Target,
  'Technology':         Cpu,
  'Supply':             Package,
}

const DEFAULT_ICON = BarChart2

const KPI_ICONS: Record<string, LucideIcon> = {
  'TAT':                            Clock,
  'RC Adoption %':                  FileCheck,
  'Savings over LPO':               DollarSign,
  'Supplier On-time Delivery Rate': Truck,
  'Supplier Defect Rate':           ShieldCheck,
  'Sourcing Tool Usage Rate':       Monitor,
  'Single-Source Vendors PRs':      Users,
  'Spend per FTE':                  BarChart2,
  'Procurement Cycle Time':         Clock,
  'On-time Delivery':               Truck,
  'Defect Rate':                    Activity,
  'Cost Savings':                   DollarSign,
  'RC Coverage':                    FileCheck,
  'PO Compliance':                  FileCheck,
}

function getBucketIcon(bucketName: string): LucideIcon {
  if (BUCKET_ICONS[bucketName]) return BUCKET_ICONS[bucketName]
  for (const [key, Icon] of Object.entries(BUCKET_ICONS)) {
    if (bucketName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(bucketName.toLowerCase())) {
      return Icon
    }
  }
  return DEFAULT_ICON
}

function BucketCard({ bucket, i, isActive, isGrayed, onBucketClick }: {
  bucket: any
  i: number
  isActive: boolean
  isGrayed: boolean
  onBucketClick?: (bucket: string | null) => void
}) {
  const BucketIcon = getBucketIcon(bucket.bucket)
  const iconColor = bucket.score == null ? '#96968c'
    : bucket.score >= 3.5 ? '#2E7D32'
    : bucket.score >= 2.5 ? '#1565C0'
    : bucket.score >= 1.5 ? '#E65100'
    : '#C62828'

  return (
    <motion.div
      key={bucket.bucket}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isGrayed ? 0.4 : 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.2 }}
      className={cn(
        'acc-card p-3 text-center transition-all',
        isActive && 'ring-2 ring-brand-purple shadow-md',
      )}
    >
      {/* Clickable header area */}
      <div
        onClick={() => onBucketClick?.(isActive ? null : bucket.bucket)}
        className={cn(onBucketClick && 'cursor-pointer hover:opacity-80')}
      >
        <div className="flex items-center justify-center mb-1.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconColor + '18' }}>
            <BucketIcon size={18} strokeWidth={1.8} style={{ color: iconColor }} />
          </div>
        </div>
        <p className="text-[10px] text-caption font-medium uppercase tracking-wide leading-tight">{bucket.bucket}</p>
        <p className="text-xl font-black mt-0.5" style={{ color: scoreColor(bucket.score) }}>
          {bucket.score?.toFixed(0) ?? '—'}
        </p>
        <span className={cn('score-badge mt-0.5 text-[10px]', scoreBg(bucket.score))}>
          {bucket.score_label}
        </span>

        {/* Score vs. industry benchmark bar */}
        {bucket.score != null && (
          <div className="mt-2 px-1">
            <div className="relative w-full h-1.5 bg-bg-muted rounded-full overflow-visible">
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(bucket.score / 4) * 100}%`, backgroundColor: iconColor }}
              />
              {/* Industry median marker at 2.3/4 = 57.5% */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-white border-2 border-brand-dark"
                style={{ left: '57.5%', marginLeft: '-4px' }}
                title="Industry median (2.3/4)"
              />
            </div>
            <p className="text-[8px] text-caption mt-0.5 text-center">vs. industry median</p>
          </div>
        )}

        {isActive && (
          <div className="mt-1 text-[9px] font-semibold text-brand-purple">● Filtering</div>
        )}
      </div>

      {/* KPI list — always visible (no collapse) */}
      <div className="mt-2 pt-2 border-t border-bg-secondary/60 space-y-0.5">
        <p className="text-[9px] text-caption uppercase tracking-wide font-semibold mb-0.5 text-left">
          {bucket.kpis.length} KPI{bucket.kpis.length !== 1 ? 's' : ''}
        </p>
        {bucket.kpis.slice(0, 6).map((kpi: any) => {
          const KpiIcon = KPI_ICONS[kpi.label] ?? Activity
          return (
            <div key={kpi.kpi_id} className="flex items-center justify-between text-xs gap-1">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <KpiIcon size={9} className="flex-shrink-0 text-caption" />
                <span className="text-caption truncate text-left text-[10px]">{kpi.label.split(' ')[0]}</span>
              </div>
              <span className="font-semibold flex-shrink-0 text-[10px]" style={{ color: scoreColor(kpi.score) }}>{kpi.score}/4</span>
            </div>
          )
        })}
        {bucket.kpis.length > 6 && (
          <p className="text-[9px] text-caption">+{bucket.kpis.length - 6} more</p>
        )}
      </div>
    </motion.div>
  )
}

export default function KpiBucketCards({ ka, activeBucket, onBucketClick }: Props) {
  const buckets = Object.values(ka.bucket_results)
  const isFiltered = activeBucket != null

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-brand-dark">KPI Performance by Bucket</h3>
        {isFiltered && (
          <button
            onClick={() => onBucketClick?.(null)}
            className="text-xs text-brand-purple hover:underline font-medium"
          >
            Clear filter ×
          </button>
        )}
      </div>
      {isFiltered && (
        <p className="text-xs text-caption mb-2">Filtered to <strong className="text-brand-dark">{activeBucket}</strong>. Click card again to clear.</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(buckets as any[]).map((bucket, i) => (
          <BucketCard
            key={bucket.bucket}
            bucket={bucket}
            i={i}
            isActive={activeBucket === bucket.bucket}
            isGrayed={isFiltered && activeBucket !== bucket.bucket}
            onBucketClick={onBucketClick}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## frontend/src/components/results/AiInsightsMini.tsx

```tsx
/**
 * AiInsightsMini — compact AI insights panel embeddable in any results tab.
 * Auto-loads from the Zustand store's aiInsights cache (pre-fetched by ResultsPage).
 * No "Generate" button — insights are part of the assessment, not an add-on.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Zap, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAssessmentStore, type AiContext } from '@/store/assessmentStore'

interface AiInsightsMiniProps {
  sessionId: string
  context: AiContext
  /** Optional callback when user clicks a KPI chip — for bidirectional binding to KPI table */
  onKpiClick?: (kpiName: string) => void
}

// ── Type definitions per context ──────────────────────────────────────────────

interface KpiOverviewInsights {
  headline: string
  top_performers: { kpi: string; insight: string }[]
  urgent_gaps: { kpi: string; root_cause: string; fix: string }[]
  '30_day_priorities': string[]
  source: string
}

interface RcaInsights {
  rca_summary: string
  root_causes: { issue: string; evidence: string; intervention: string; urgency: string }[]
  intervention_priority: { area: string; rationale: string; expected_impact: string }[]
  source: string
}

interface OfferingsInsights {
  recommendation_summary: string
  top_offerings: { offering: string; priority: string; rationale: string; kpi_links: string[]; expected_benefit: string }[]
  quick_start: string
  source: string
}

const CONTEXT_LABELS: Record<AiContext, string> = {
  kpi_overview: 'KPI Commentary',
  rca:          'Root Cause Analysis',
  offerings:    'Offering Recommendations',
}

const urgencyColor = (u: string) =>
  u === 'High' ? 'bg-red-50 border-red-200 text-red-800'
  : u === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-800'
  : 'bg-bg-secondary/40 border-bg-secondary text-black/70'

// ── KPI chip — clickable, filters the KPI table when clicked ──────────────────

function KpiChip({ name, onClick, tone = 'neutral' }: { name: string; onClick?: () => void; tone?: 'red' | 'green' | 'neutral' }) {
  const toneCls =
    tone === 'red'   ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
    : tone === 'green' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
    : 'bg-purple-50 text-brand-purple border-purple-200 hover:bg-purple-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors',
        toneCls,
        onClick && 'cursor-pointer underline-offset-2 hover:underline',
        !onClick && 'cursor-default opacity-90'
      )}
      title={onClick ? `Filter table to ${name}` : name}
    >
      {name}
    </button>
  )
}

// ── Content renderers ─────────────────────────────────────────────────────────

function KpiOverviewContent({ data, onKpiClick }: { data: KpiOverviewInsights; onKpiClick?: (k: string) => void }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.headline}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Urgent gaps */}
        <div>
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertTriangle size={10} /> Urgent Gaps
          </p>
          <div className="space-y-2">
            {data.urgent_gaps?.map((g, i) => (
              <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <KpiChip name={g.kpi} tone="red" onClick={onKpiClick ? () => onKpiClick(g.kpi) : undefined} />
                <p className="text-[11px] text-red-700 mt-1.5">{g.root_cause}</p>
                <p className="text-[10px] text-red-600 mt-1 flex items-start gap-1">
                  <ArrowRight size={9} className="flex-shrink-0 mt-0.5" />{g.fix}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {/* Top performers */}
          <div>
            <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
              <CheckCircle size={10} /> Strengths
            </p>
            <div className="space-y-1.5">
              {data.top_performers?.map((p, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <KpiChip name={p.kpi} tone="green" onClick={onKpiClick ? () => onKpiClick(p.kpi) : undefined} />
                  <p className="text-[11px] text-green-700 mt-1">{p.insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 30-day priorities */}
          {data['30_day_priorities']?.length > 0 && (
            <div>
              <p className="text-[10px] text-brand-dark font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap size={10} /> 30-Day Priorities
              </p>
              <ul className="space-y-1">
                {data['30_day_priorities'].map((p, i) => (
                  <li key={i} className="text-[11px] text-brand-dark flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-brand-purple/15 text-brand-purple text-[9px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">{i+1}</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RcaContent({ data }: { data: RcaInsights }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.rca_summary}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-2">Root Causes</p>
          <div className="space-y-2">
            {data.root_causes?.map((rc, i) => (
              <div key={i} className={cn('rounded-lg border px-3 py-2', urgencyColor(rc.urgency))}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold">{rc.issue}</p>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border',
                    rc.urgency === 'High' ? 'bg-red-100 border-red-300 text-red-700'
                    : rc.urgency === 'Medium' ? 'bg-amber-100 border-amber-300 text-amber-700'
                    : 'bg-bg-secondary border-bg-secondary text-black/60'
                  )}>{rc.urgency}</span>
                </div>
                <p className="text-[10px] mt-0.5 opacity-80">{rc.evidence}</p>
                <p className="text-[10px] mt-1 font-semibold">→ {rc.intervention}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-brand-dark font-bold uppercase tracking-wide mb-2">Intervention Priority</p>
          <div className="space-y-2">
            {data.intervention_priority?.map((ip, i) => (
              <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-purple text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <p className="text-xs font-bold text-brand-dark">{ip.area}</p>
                </div>
                <p className="text-[10px] text-brand-dark/80 mt-1">{ip.rationale}</p>
                <p className="text-[10px] text-brand-purple mt-0.5 font-medium">{ip.expected_impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function OfferingsContent({ data, onKpiClick }: { data: OfferingsInsights; onKpiClick?: (k: string) => void }) {
  return (
    <div className="space-y-4 mt-3">
      <p className="text-sm text-brand-dark font-medium leading-relaxed">{data.recommendation_summary}</p>

      <div className="space-y-2">
        <p className="text-[10px] text-brand-purple font-bold uppercase tracking-wide">Top Recommended Offerings</p>
        {data.top_offerings?.map((o, i) => (
          <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-purple text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{o.priority}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-dark">{o.offering}</p>
                <p className="text-[11px] text-black/60 mt-0.5">{o.rationale}</p>
                {o.kpi_links?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {o.kpi_links.map(k => (
                      <KpiChip key={k} name={k} onClick={onKpiClick ? () => onKpiClick(k) : undefined} />
                    ))}
                  </div>
                )}
                {o.expected_benefit && (
                  <p className="text-[10px] text-brand-purple mt-1 font-medium">{o.expected_benefit}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.quick_start && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap size={10} /> Where to Start
          </p>
          <p className="text-xs text-green-800">{data.quick_start}</p>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiInsightsMini({ sessionId, context, onKpiClick }: AiInsightsMiniProps) {
  const data = useAssessmentStore((s) => s.aiInsights[context]) as any
  const loading = useAssessmentStore((s) => s.aiLoading[context])
  const error = useAssessmentStore((s) => s.aiError[context])
  const setAiInsight = useAssessmentStore((s) => s.setAiInsight)
  const setAiLoading = useAssessmentStore((s) => s.setAiLoading)
  const setAiError = useAssessmentStore((s) => s.setAiError)
  // Collapsed by default — user expands when they want the AI commentary.
  // The header still shows the "Generated · Refresh" affordance when data exists.
  const [open, setOpen] = useState(false)

  const refresh = async () => {
    setAiLoading(context, true)
    setAiError(context, '')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/ai-tab-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, force_refresh: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || 'Failed')
      }
      const d = await res.json()
      setAiInsight(context, d.insights)
    } catch (e: any) {
      setAiError(context, e.message)
    } finally {
      setAiLoading(context, false)
    }
  }

  const isAi = data?.source === 'vertex-gemini'

  const canExpand = !!data || !!error
  const headerCls = cn(
    'w-full flex items-center justify-between px-4 py-2.5 bg-purple-50/60 transition-colors text-left',
    canExpand && 'hover:bg-purple-100/60 cursor-pointer',
    !canExpand && 'cursor-default',
    open && canExpand && 'border-b border-bg-secondary',
  )

  return (
    <div className="bg-white border-l-4 border-l-brand-purple border border-bg-secondary rounded-xl shadow-sm overflow-hidden mb-4">
      {/* Header — clickable to toggle when content available */}
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        aria-expanded={open}
        aria-label={open ? 'Collapse AI commentary' : 'Expand AI commentary'}
        className={headerCls}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">
            AI {CONTEXT_LABELS[context]}
          </span>
          {data && (
            isAi ? (
              <span className="text-[10px] bg-brand-purple/15 text-brand-purple px-1.5 py-0.5 rounded font-medium">Gemini · grounded</span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">Rule-based</span>
            )
          )}
          {data && !open && (
            <span className="text-[11px] text-caption ml-1">— click to expand</span>
          )}
          {loading && !data && (
            <span className="text-[11px] text-caption ml-1">— generating…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(data || error) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); refresh() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); refresh() } }}
              aria-label="Regenerate AI insights"
              className={cn(
                'text-[11px] text-caption hover:text-brand-purple border border-bg-secondary rounded px-2 py-1 flex items-center gap-1 transition-colors',
                loading && 'opacity-50 pointer-events-none'
              )}
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Refresh
            </span>
          )}
          {canExpand && (
            open
              ? <ChevronUp size={14} className="text-caption" />
              : <ChevronDown size={14} className="text-caption" />
          )}
        </div>
      </button>

      {/* Error */}
      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-start justify-between gap-3">
          <p className="text-xs text-red-700">{error}</p>
          <button
            onClick={refresh}
            className="text-[11px] text-red-700 hover:text-red-900 underline font-semibold whitespace-nowrap"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content — collapsible */}
      <AnimatePresence initial={false}>
        {open && data && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {context === 'kpi_overview' && <KpiOverviewContent data={data as KpiOverviewInsights} onKpiClick={onKpiClick} />}
              {context === 'rca'          && <RcaContent data={data as RcaInsights} />}
              {context === 'offerings'    && <OfferingsContent data={data as OfferingsInsights} onKpiClick={onKpiClick} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="px-4 py-5 space-y-3">
          <div className="h-3 bg-bg-secondary/80 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-bg-secondary/60 rounded animate-pulse w-full" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="h-16 bg-bg-secondary/40 rounded animate-pulse" />
            <div className="h-16 bg-bg-secondary/40 rounded animate-pulse" />
          </div>
          <p className="text-[11px] text-caption flex items-center gap-1.5">
            <Sparkles size={10} className="text-brand-purple animate-pulse" />
            Reading your data and generating commentary…
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## frontend/src/components/results/DimensionsTab.tsx

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DimensionResult } from '@/lib/types'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { cn, scoreBg } from '@/lib/utils'

interface Props { dims: DimensionResult[] }

export default function DimensionsTab({ dims }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {dims.map((dim, i) => (
        <motion.div key={dim.dim_id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="border border-bg-secondary rounded overflow-hidden">
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary/30 transition-colors text-left"
            onClick={() => setOpen(open === dim.dim_id ? null : dim.dim_id)}>
            <span className="text-xs font-bold text-caption w-8">{dim.dim_id}</span>
            <span className="flex-1 text-sm font-semibold text-black">{dim.name}</span>
            <ScoreBadge score={dim.score_display} label={dim.level ?? undefined} />
            <span className="text-xs text-caption ml-2">{(dim.weight * 100).toFixed(0)}%</span>
            {open === dim.dim_id ? <ChevronUp size={16} className="text-caption" /> : <ChevronDown size={16} className="text-caption" />}
          </button>

          <AnimatePresence>
            {open === dim.dim_id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }} className="border-t border-bg-secondary overflow-hidden">
                <div className="p-4 bg-white">
                  <p className="text-xs text-caption mb-3 italic">{dim.rationale}</p>

                  {/* KPI table */}
                  {Object.values(dim.kpi_scores).length > 0 && (
                    <table className="w-full acc-table text-xs mb-3">
                      <thead><tr><th>KPI</th><th>Value</th><th>Score</th><th>Status</th></tr></thead>
                      <tbody>
                        {Object.values(dim.kpi_scores).map(kpi => (
                          <tr key={kpi.kpi_id}>
                            <td>{kpi.label}</td>
                            <td className="font-mono">{kpi.value !== null ? `${kpi.value?.toFixed?.(2) ?? kpi.value} ${kpi.unit}` : '—'}</td>
                            <td><span className={cn('score-badge', scoreBg(kpi.score), 'text-xs')}>{kpi.score ?? '—'}</span></td>
                            <td className="text-caption">{kpi.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Evidence */}
                  {dim.evidence.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-bold text-brand-dark mb-1">Evidence</p>
                      <ul className="space-y-0.5">
                        {dim.evidence.filter(Boolean).map((e, i) => (
                          <li key={i} className="text-xs text-black flex gap-1.5"><span className="text-brand-purple">•</span>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Gaps */}
                  {dim.gaps.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-brand-dark mb-1">Key Gaps</p>
                      <ul className="space-y-0.5">
                        {dim.gaps.map((g, i) => (
                          <li key={i} className="text-xs text-black flex gap-1.5"><span className="text-orange-500">→</span>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}
```

---

## frontend/src/components/results/MaturityRadar.tsx

```tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { DimensionResult } from '@/lib/types'
import { scoreColor } from '@/lib/utils'

interface Props { dims: DimensionResult[] }

export default function MaturityRadar({ dims }: Props) {
  const scored = dims.filter(d => d.score !== null)
  const data = scored.map(d => ({
    subject: d.dim_id,
    fullName: d.name,
    score: d.score_display ?? 0,
    fullMark: 4,
  }))

  if (!data.length) return <p className="text-caption text-sm text-center py-8">No scored dimensions.</p>

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e6e6dc" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#460073', fontWeight: 600 }} />
        <Radar name="Score" dataKey="score" stroke="#a100ff" fill="#a100ff" fillOpacity={0.2}
          strokeWidth={2} dot={{ fill: '#a100ff', r: 4 }} isAnimationActive />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-white border border-bg-secondary rounded px-3 py-2 shadow text-xs">
                <p className="font-bold text-brand-dark">{d.fullName}</p>
                <p style={{ color: scoreColor(d.score) }}>Score: <strong>{d.score?.toFixed(0)}</strong> / 4</p>
              </div>
            )
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
```
## frontend/src/components/results/RCATab.tsx

```tsx
/**
 * RCATab — Root Cause Analysis (card-based redesign)
 *
 * For each gap KPI, shows a set of root-cause cards.
 * Each card has: root cause headline, child KPI if any, and
 * coloured intervention chips (Op Model / Process / Category / Tech / SRM / Capability).
 * Click a chip to see the full intervention text in a popover.
 * Expected benefit shown at bottom in green.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, GitBranch, DollarSign, Cpu, Users2, GraduationCap,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIAssessmentResult } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RCARow {
  kpi: string
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

// ── Intervention area config ───────────────────────────────────────────────────

const INTERVENTIONS: {
  key: keyof Omit<RCARow, 'kpi' | 'root_cause' | 'child_kpi' | 'benefit'>
  label: string
  Icon: LucideIcon
  bg: string
  text: string
  border: string
  lightBg: string
}[] = [
  // Reduced from 6 colors to a 2-tone purple-vs-neutral system: purple = primary
  // intervention areas (org/process/category — the "what changes"), gray = enabling
  // areas (tech/SRM/capability — the "how to support it"). Cuts visual noise.
  { key: 'op_model',   label: 'Operating Model',  Icon: Building2,    bg: 'bg-brand-purple', text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'process',    label: 'Process',          Icon: GitBranch,    bg: 'bg-brand-purple', text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'category',   label: 'Category Strategy',Icon: DollarSign,   bg: 'bg-brand-purple', text: 'text-brand-purple', border: 'border-brand-purple/30', lightBg: 'bg-purple-50' },
  { key: 'tech',       label: 'Tech & AI',        Icon: Cpu,          bg: 'bg-brand-dark/80', text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
  { key: 'srm',        label: 'SRM',              Icon: Users2,       bg: 'bg-brand-dark/80', text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
  { key: 'capability', label: 'Capability',       Icon: GraduationCap,bg: 'bg-brand-dark/80', text: 'text-brand-dark/80', border: 'border-brand-dark/20', lightBg: 'bg-bg-secondary/60' },
]

// ── KPI display config ─────────────────────────────────────────────────────────

const KPI_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'TAT':                            { color: 'text-purple-700',  bg: 'bg-purple-100',  border: 'border-purple-300' },
  'RC Adoption %':                  { color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-300'   },
  'Savings over LPO':               { color: 'text-green-700',   bg: 'bg-green-100',   border: 'border-green-300'  },
  'Supplier On-time Delivery Rate': { color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-300' },
  'Supplier Defect Rate':           { color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-300'    },
  'Sourcing Tool Usage Rate':       { color: 'text-indigo-700',  bg: 'bg-indigo-100',  border: 'border-indigo-300' },
  'Single-Source Vendors PRs':      { color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-300'   },
}

// ── ID map ─────────────────────────────────────────────────────────────────────

const KPI_ID_MAP: Record<string, string> = {
  'TAT':                            'tat',
  'RC Adoption %':                  'rc_adoption',
  'Savings over LPO':               'savings_lpo',
  'Supplier On-time Delivery Rate': 'otd',
  'Supplier Defect Rate':           'defect_rate',
  'Sourcing Tool Usage Rate':       'sourcing_tool',
  'Single-Source Vendors PRs':      'pac_prs',
}

// ── RCA data ───────────────────────────────────────────────────────────────────

const RCA_DATA: RCARow[] = [
  // ── TAT ──────────────────────────────────────────────────────────────────────
  {
    kpi: 'TAT',
    root_cause: 'Procurement team capacity is insufficient relative to transaction volumes, creating backlogs and extending cycle times',
    child_kpi: 'Procurement Spend/FTE',
    op_model: 'Org structure to be reviewed and right-sized — recruit, redeploy, or restructure based on workload analysis',
    capability: 'Structured onboarding and upskilling programme for new and existing procurement staff',
    benefit: 'Right-sizing team capacity reduces average TAT and improves throughput per procurement FTE',
  },
  {
    kpi: 'TAT',
    root_cause: 'Multi-tiered approval structures within the Delegation of Powers create bottlenecks in the sourcing cycle',
    op_model: 'Delegation of Powers to be simplified — rationalise approval layers to achieve the right balance of control and agility',
    tech: 'System-enable parallel approval workflows in the digital procurement platform to eliminate sequential waiting time',
    benefit: 'Rationalising and digitising the approval chain accelerates the award cycle and reduces spend leakage from approval bypass',
  },
  {
    kpi: 'TAT',
    root_cause: 'Incomplete or poorly defined purchase requisitions drive significant rework and delays in the sourcing and evaluation stage',
    tech: 'AI-enabled PR validation at point of creation: completeness checks, open inventory alerts, SoW validation, material group accuracy, duplicate PR detection',
    benefit: 'Higher-quality requisitions reduce rework in the sourcing cycle and improve on-time completion of procurement events',
  },
  {
    kpi: 'TAT',
    root_cause: 'Absence of a maintained Approved Supplier List makes vendor identification and qualification a time-intensive, unstructured exercise each time',
    op_model: 'Formalise a Supplier Relationship Management function responsible for maintaining the Approved Supplier List',
    tech: 'Vendor shortlisting driven by internal and external intelligence — prior OTD, quality, technical capability, financials, and credit ratings',
    srm: 'Approved Supplier List to be established, segmented by category, and kept current through periodic review',
    benefit: 'A structured approved supplier base accelerates vendor shortlisting and consistently improves the quality of vendor selection',
  },
  {
    kpi: 'TAT',
    root_cause: 'Bid evaluation relies on manual review with no decision-support tools, extending the technical and commercial assessment cycle',
    tech: 'AI assistance in auto-scoring technical responses and collating commercial data for buyer review — reducing evaluation from weeks to days',
    benefit: 'AI-assisted evaluation reduces cycle time and improves the consistency and auditability of bid scoring',
  },
  {
    kpi: 'TAT',
    root_cause: 'Negotiation preparation is data-poor and unstructured, limiting buyer effectiveness and extending the commercial closure stage',
    tech: 'AI-assisted collation of vendor performance history, bid behaviour, and category price movement to prepare buyers for negotiation or recommend the appropriate auction format',
    benefit: 'Better-prepared buyers achieve stronger commercial outcomes and close sourcing events faster',
  },
  {
    kpi: 'TAT',
    root_cause: 'Manual award justification and sequential approval steps create avoidable delays in the final award and PO creation stage',
    tech: 'AI-generated award justification notes with compliance checklists, enabling faster sign-off and reducing manual drafting effort',
    benefit: 'Automating the justification and award stage reduces approval cycle time and strengthens compliance audit readiness',
  },
  {
    kpi: 'TAT',
    root_cause: 'Buyers operate without structured category strategies or market intelligence, limiting sourcing effectiveness and commercial outcomes',
    op_model: 'Organisation redesigned to be category-focused; Category Councils established; Lead Buyers nominated for shared categories across business units',
    process: 'Category Council meetings held at regular intervals to review strategy, performance, and market developments',
    category: 'Buying channels defined for each category based on spend volume, frequency, and market dynamics',
    tech: 'AI-based should-cost modelling deployed for applicable categories to anchor negotiation benchmarks',
    capability: 'Category intelligence workbooks created and disseminated to build buyer knowledge',
    benefit: 'Category-focused procurement delivers stronger pricing outcomes and faster sourcing cycles for covered categories',
  },
  {
    kpi: 'TAT',
    root_cause: 'A disproportionate share of procurement capacity is absorbed by transactional and administrative tasks, limiting bandwidth for strategic sourcing',
    op_model: 'Shared services model established for transactional activities — RFx creation, PO creation, and vendor correspondence',
    tech: 'Agentic AI deployed for transactional tasks: PR validation, last-price-paid retrieval, and vendor response compilation',
    benefit: 'Releasing buyer bandwidth from transactional work enables more strategic sourcing events and higher-value negotiations',
  },
  {
    kpi: 'TAT',
    root_cause: 'Structured buying channels — rate contracts, catalogues, and approved supplier lists — are underutilised, resulting in avoidable open-market sourcing for routine categories',
    child_kpi: 'RC %, Catalogue %, ASL %',
    op_model: 'Category Councils instituted with ownership of buying channel governance',
    process: 'Category Council meetings held at regular intervals to review and enforce channel compliance',
    category: 'Appropriate buying channel defined and mandated for each spend category',
    benefit: 'Transitioning high-frequency, low-complexity categories to structured channels significantly reduces average TAT and administrative effort',
  },
  {
    kpi: 'TAT',
    root_cause: 'Low adoption of digital procurement tools constrains process standardisation, data visibility, and end-to-end compliance',
    child_kpi: 'ARIBA Adoption %',
    tech: 'ARIBA templates to be enhanced for ease of use; Agentic AI deployed for PR validation, last-price retrieval, and vendor response compilation',
    srm: 'Vendor training and onboarding support for digital tool adoption',
    capability: 'Structured digital tool training programme for the procurement team',
    benefit: 'Full digital adoption improves data completeness, compliance tracking, and end-to-end process visibility',
  },
  {
    kpi: 'TAT',
    root_cause: 'Procurement performance is not systematically tracked or governed, limiting accountability and the ability to drive continuous improvement',
    op_model: 'KRAs to be defined at individual and team level, aligned to key procurement KPIs including TAT',
    process: 'Governance cadence established — regular review meetings structured around dashboards and formal RCA',
    tech: 'AI-over-BI dashboards with persona-based insights to support governance and exception management',
    benefit: 'Structured governance and real-time KPI visibility enable proactive course correction and measurable performance improvement',
  },
  {
    kpi: 'TAT',
    root_cause: 'Insufficient investment in procurement talent development limits the function\'s ability to operate strategically',
    op_model: 'Defined training programmes aligned to the org structure and role profiles',
    tech: 'AI assistance for category intelligence, vendor bid behaviour analysis, and negotiation preparation',
    capability: 'Training roadmaps created and rolled out; category intelligence workbooks developed and maintained',
    benefit: 'Higher-capability procurement teams deliver better commercial outcomes and more effective category strategies',
  },
  // ── RC Adoption % ─────────────────────────────────────────────────────────────
  {
    kpi: 'RC Adoption %',
    root_cause: 'Category-level buying channel analysis has not been conducted, resulting in suboptimal channel deployment across the spend portfolio',
    op_model: 'Category channel analysis to be made a formal KRA; detailed review conducted across spend categories',
    category: 'Appropriate buying channel defined for each category — rate contract, ASL, catalogue, or open market',
    benefit: 'Channel optimisation significantly reduces TAT and administrative overhead for categories moved to structured channels',
  },
  {
    kpi: 'RC Adoption %',
    root_cause: 'Negotiated contracts are not system-enabled, preventing buyers from transacting against them through the digital platform',
    op_model: 'All active contracts to be loaded and maintained in the procurement system',
    tech: 'Rate Contracts and Catalogues enabled in the digital procurement platform for direct order creation',
    benefit: 'System-enabled contracts allow buyers to raise POs in minutes and eliminate maverick spend in covered categories',
  },
  {
    kpi: 'RC Adoption %',
    root_cause: 'Fragmented procurement volumes limit negotiating leverage and reduce the commercial viability of establishing rate contracts with key vendors',
    process: 'Material and service PRs to be consolidated at defined intervals by category before going to market',
    benefit: 'Volume consolidation strengthens negotiating leverage and improves the case for rate contract establishment with key suppliers',
  },
  // ── Savings over LPO ─────────────────────────────────────────────────────────
  {
    kpi: 'Savings over LPO',
    root_cause: 'Buyers lack the category intelligence, market benchmarks, and vendor behaviour data needed to negotiate effectively',
    category: 'Category-focused structure to enable targeted market analysis and negotiation strategy',
    tech: 'AI assistance in collating last-price-paid history, vendor bid behaviour, and category price movement to prepare buyers for negotiation',
    benefit: 'Category-intelligent buyers deliver consistently stronger savings outcomes and demonstrate measurable ROI on the category programme',
  },
  {
    kpi: 'Savings over LPO',
    root_cause: 'Purchase requisitions are not consolidated by category, limiting volume leverage and resulting in weaker commercial outcomes',
    tech: 'AI-based PR consolidation with defined frequency and category grouping logic',
    benefit: 'Consolidated sourcing improves unit pricing and reduces the number of fragmented sourcing events required',
  },
  {
    kpi: 'Savings over LPO',
    root_cause: 'Savings targets are not embedded in procurement KRAs or monitored through structured governance',
    op_model: 'Procurement KRAs to be redefined to include verified savings targets; savings governance cadence established',
    benefit: 'Embedding savings in KRAs and governance ensures consistent delivery against savings commitments and builds a culture of commercial accountability',
  },
  {
    kpi: 'Savings over LPO',
    root_cause: 'Last price paid is not systematically applied as a negotiation benchmark, allowing price drift across sourcing events',
    tech: 'System-based last-price-paid tracking with automated deviation alerts triggered at time of PO creation',
    benefit: 'Systematic LPO benchmarking prevents price drift and surfaces opportunities for targeted renegotiation',
  },
  // ── Supplier OTD ─────────────────────────────────────────────────────────────
  {
    kpi: 'Supplier On-time Delivery Rate',
    root_cause: 'Vendor performance is not formally measured through scorecards, removing accountability for delivery reliability',
    child_kpi: '% of Vendors Scored for performance',
    op_model: 'Vendor performance tracking dashboards to be established; ownership assigned within the procurement team',
    srm: 'Structured supplier rating mechanism with periodic vendor scorecards and performance improvement plans',
    benefit: 'Scorecard-driven supplier management improves delivery reliability and surfaces chronic underperformers for remediation',
  },
  {
    kpi: 'Supplier On-time Delivery Rate',
    root_cause: 'Delays in supplier payments reduce the organisation\'s priority status with key vendors, increasing supply disruption risk',
    child_kpi: '% Vendors Paid on Time',
    process: 'Payment KPIs to be tracked and reviewed within the procurement governance cadence',
    benefit: 'Timely payment improves vendor relationship quality and reduces the risk of supply disruption from de-prioritisation',
  },
  // ── Defect Rate ───────────────────────────────────────────────────────────────
  {
    kpi: 'Supplier Defect Rate',
    root_cause: 'Absence of regular vendor assessments and structured development programmes perpetuates quality gaps in the supply base',
    srm: 'Structured supplier rating mechanism, vendor scorecards, and formal vendor development programmes to be designed and deployed',
    benefit: 'Structured vendor development progressively improves quality compliance and reduces defect rates across the supply base',
  },
  // ── Sourcing Tool Usage ───────────────────────────────────────────────────────
  {
    kpi: 'Sourcing Tool Usage Rate',
    root_cause: 'Procurement staff have not received adequate training on available digital sourcing tools, limiting effective adoption',
    capability: 'Structured procurement tool training programme to be developed and rolled out across all buyer grades',
    benefit: 'Higher tool adoption reduces manual effort and improves data completeness for analytics, governance, and compliance',
  },
  {
    kpi: 'Sourcing Tool Usage Rate',
    root_cause: 'Key platform modules and features remain inactive, limiting the automation and compliance benefits available to buyers',
    tech: 'Required modules and features to be configured and activated in the sourcing platform',
    benefit: 'Activating available platform capabilities unlocks automated workflows and reduces manual touchpoints in the sourcing process',
  },
  {
    kpi: 'Sourcing Tool Usage Rate',
    root_cause: 'Poor usability of existing tools and sourcing templates drives workarounds and out-of-system decision-making',
    tech: 'UI/UX enhancements and template redesign to improve ease of use and buyer adoption',
    benefit: 'Improved usability increases adoption rates and reduces the workarounds that create compliance gaps and data quality issues',
  },
  {
    kpi: 'Sourcing Tool Usage Rate',
    root_cause: 'Tail-spend vendors lack the capability or support required to transact through digital channels, limiting platform coverage',
    tech: 'Low-touch digital workflows designed for smaller vendors to reduce the barrier to digital participation',
    capability: 'Vendor training and onboarding programme for digital tool adoption',
    benefit: 'Enabling tail-spend vendors on digital channels reduces administrative overhead and improves spend visibility at the category level',
  },
  // ── PAC / Single-Source ───────────────────────────────────────────────────────
  {
    kpi: 'Single-Source Vendors PRs',
    root_cause: 'Insufficient supplier diversity in key categories creates concentration risk and eliminates the competitive tension needed for better pricing',
    tech: 'Vendor identification and qualification driven by internal and external intelligence — prior OTD, quality, technical capability, financials, and credit ratings',
    srm: 'Vendor development initiatives designed and executed to expand the qualified supplier base in high-concentration categories',
    benefit: 'Supplier diversification reduces single-source dependency and creates competitive tension that drives better commercial outcomes',
  },
  {
    kpi: 'Single-Source Vendors PRs',
    root_cause: 'Unattractive commercial terms and payment practices limit the depth of the qualified supplier base, particularly for specialised categories',
    child_kpi: '% Vendors Paid on Time',
    srm: 'Vendor engagement programme to review commercial terms and payment practices; targeted improvement actions defined',
    benefit: 'Improving commercial attractiveness expands the qualified supplier base and reduces the risk of supply concentration',
  },
  {
    kpi: 'Single-Source Vendors PRs',
    root_cause: 'Competitive sourcing requirements are not systematically enforced, enabling single-source purchasing outside of approved exceptions',
    tech: 'System-based compliance controls: minimum vendor count enforced at RFx creation; automated alerts for single-source deviation',
    capability: 'Buyer training on competitive sourcing policy, PAC justification requirements, and audit obligations',
    benefit: 'Systematic enforcement of competitive sourcing requirements reduces single-source exposure and strengthens audit compliance',
  },
]

const ALL_KPIS = [...new Set(RCA_DATA.map(r => r.kpi))]

// ── Intervention chip with expand ────────────────────────────────────────────

function InterventionChip({
  intv,
  text,
}: {
  intv: typeof INTERVENTIONS[0]
  text: string
}) {
  const [expanded, setExpanded] = useState(false)
  const { Icon, label, text: textColor, border, lightBg } = intv

  return (
    <div className={cn('rounded-lg border text-xs overflow-hidden', border, lightBg)}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full flex items-center gap-1.5 px-2.5 py-1.5 font-semibold transition-colors hover:brightness-95',
          textColor,
        )}
      >
        <Icon size={11} className="flex-shrink-0" />
        <span>{label}</span>
        {expanded
          ? <ChevronUp size={10} className="ml-auto opacity-60" />
          : <ChevronDown size={10} className="ml-auto opacity-60" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className={cn('px-2.5 pb-2.5 leading-relaxed', textColor)}>{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── RCA card for a single root cause ─────────────────────────────────────────

function RCACard({ row, index }: { row: RCARow; index: number }) {
  const activeInterventions = INTERVENTIONS.filter(i => row[i.key])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Card header — root cause */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-dark leading-snug">{row.root_cause}</p>
            {row.child_kpi && (
              <span className="inline-block mt-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                ↳ Related KPI: {row.child_kpi}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-caption flex-shrink-0 mt-0.5">#{index + 1}</span>
        </div>
      </div>

      {/* Interventions grid */}
      {activeInterventions.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[10px] text-caption uppercase font-bold tracking-wide mb-2">
            Interventions ({activeInterventions.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {activeInterventions.map(intv => (
              <InterventionChip
                key={intv.key}
                intv={intv}
                text={row[intv.key] as string}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expected benefit */}
      {row.benefit && (
        <div className="mx-4 mb-3 mt-0 flex items-start gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <TrendingUp size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed font-medium">{row.benefit}</p>
        </div>
      )}
    </motion.div>
  )
}

// ── KPI section ───────────────────────────────────────────────────────────────

function KpiSection({
  kpiName,
  rows,
  score,
}: {
  kpiName: string
  rows: RCARow[]
  score: number | null
}) {
  const [collapsed, setCollapsed] = useState(true)
  const cfg = KPI_CONFIG[kpiName] ?? { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' }

  const scoreLabel = score === null ? 'N/A'
    : score >= 3.5 ? 'Leading' : score >= 2.5 ? 'Advanced'
    : score >= 1.5 ? 'Intermediate' : 'Foundation'

  const scoreColor = score === null ? 'text-gray-500'
    : score >= 3.5 ? 'text-green-600' : score >= 2.5 ? 'text-blue-600'
    : score >= 1.5 ? 'text-orange-600' : 'text-red-600'

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* KPI header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:brightness-95', cfg.bg)}
      >
        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border font-mono', cfg.color, cfg.bg, cfg.border)}>
          {kpiName}
        </span>
        <div className="flex-1" />
        {score !== null && (
          <span className={cn('text-sm font-black', scoreColor)}>{score.toFixed(0)}/4</span>
        )}
        <span className={cn('text-xs font-semibold', scoreColor)}>{scoreLabel}</span>
        <span className="text-[10px] text-caption ml-2">{rows.length} root cause{rows.length !== 1 ? 's' : ''}</span>
        {collapsed
          ? <ChevronDown size={14} className="text-caption ml-1" />
          : <ChevronUp size={14} className="text-caption ml-1" />}
      </button>

      {/* Root cause cards */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-gray-50/30">
              {rows.map((row, i) => (
                <RCACard key={i} row={row} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── KPI → bucket mapping (for grouping) ───────────────────────────────────────

const KPI_BUCKET_MAP: Record<string, string> = {
  'TAT':                            'Efficiency',
  'RC Adoption %':                  'Efficiency',
  'Savings over LPO':               'Effectiveness',
  'Supplier On-time Delivery Rate': 'Vendor Management',
  'Supplier Defect Rate':           'Vendor Management',
  'Sourcing Tool Usage Rate':       'Digitization',
  'Single-Source Vendors PRs':      'Risk Management',
}

// ── Bucket section wrapper ─────────────────────────────────────────────────────

function BucketSection({ bucketName, children, kpiCount, gapCount, defaultOpen = false, forceOpen }: {
  bucketName: string
  children: React.ReactNode
  kpiCount: number
  gapCount: number
  defaultOpen?: boolean
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Respect external expand-all / collapse-all
  useEffect(() => {
    if (forceOpen !== undefined) setOpen(forceOpen)
  }, [forceOpen])

  return (
    <div className="rounded-xl border border-bg-secondary overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-brand-dark/95 text-white text-left transition-colors hover:bg-brand-dark"
      >
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        <span className="font-bold text-sm flex-1">{bucketName}</span>
        <span className="text-xs opacity-70">{kpiCount} KPI{kpiCount !== 1 ? 's' : ''}</span>
        {gapCount > 0 && (
          <span className="text-[10px] bg-red-400/90 px-2 py-0.5 rounded-full font-semibold">
            {gapCount} gap{gapCount !== 1 ? 's' : ''}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-bg-secondary/10">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  kpiAssessment: KPIAssessmentResult | null
  activeBucket?: string | null
}

export default function RCATab({ kpiAssessment, activeBucket }: Props) {
  const [filterKpi, setFilterKpi] = useState<string>('All')
  const [showAll, setShowAll] = useState(false)
  const [activeIntervention, setActiveIntervention] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)

  const kpiResults = kpiAssessment?.kpi_results

  const getScore = (kpiName: string): number | null => {
    const id = KPI_ID_MAP[kpiName]
    if (!id || !kpiResults) return null
    return kpiResults[id]?.score ?? null
  }

  const hasGap = (kpiName: string): boolean => {
    const score = getScore(kpiName)
    return score === null || score <= 2
  }

  const gapKpis = ALL_KPIS.filter(hasGap)

  const visibleKpis = showAll ? ALL_KPIS : gapKpis

  // Apply bucket filter from parent
  const bucketFilteredKpis = activeBucket
    ? visibleKpis.filter(k => KPI_BUCKET_MAP[k] === activeBucket)
    : visibleKpis

  // Apply intervention area filter: only show KPIs that have at least one RCA row with that intervention
  const interventionFilteredKpis = activeIntervention
    ? bucketFilteredKpis.filter(k =>
        RCA_DATA.some(r => r.kpi === k && r[activeIntervention as keyof RCARow])
      )
    : bucketFilteredKpis

  const filteredKpis = filterKpi === 'All' ? interventionFilteredKpis : interventionFilteredKpis.filter(k => k === filterKpi)

  // Group KPIs by bucket
  const bucketGroups: Record<string, string[]> = {}
  filteredKpis.forEach(kpi => {
    const bucket = KPI_BUCKET_MAP[kpi] ?? 'Other'
    if (!bucketGroups[bucket]) bucketGroups[bucket] = []
    bucketGroups[bucket].push(kpi)
  })

  // totalRootCauses computed inline in render

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="page-header rounded-xl px-5 py-4">
        <h3 className="text-white font-bold text-base">Root Cause Analysis</h3>
        <p className="text-white/70 text-sm mt-0.5">
          Potential root causes mapped to 6 intervention areas.
          Click any intervention to expand the recommended action.
        </p>
      </div>

      {/* ── Intervention filter chips ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[11px] text-caption font-semibold">Filter by intervention:</span>
        <button
          onClick={() => setActiveIntervention(null)}
          className={cn(
            'text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors',
            activeIntervention === null
              ? 'bg-brand-dark text-white border-brand-dark'
              : 'bg-white text-brand-dark border-gray-200 hover:border-gray-400',
          )}
        >
          All
        </button>
        {INTERVENTIONS.map(intv => {
          const isActive = activeIntervention === intv.key
          return (
            <button
              key={intv.key}
              onClick={() => setActiveIntervention(isActive ? null : intv.key)}
              className={cn(
                'flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all',
                isActive
                  ? cn(intv.bg, 'text-white border-transparent shadow-sm')
                  : cn(intv.lightBg, intv.border, intv.text, 'hover:shadow-sm'),
              )}
            >
              <intv.Icon size={11} />
              {intv.label}
              {isActive && <span className="ml-0.5 opacity-80">×</span>}
            </button>
          )
        })}
      </div>

      {/* ── No gaps ───────────────────────────────────────────────────────────── */}
      {gapKpis.length === 0 && !showAll && (
        <div className="acc-card text-center py-10">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-semibold">All KPIs are on track — no gaps identified.</p>
          <button
            onClick={() => setShowAll(true)}
            className="text-brand-purple text-xs mt-2 hover:underline"
          >
            Show full RCA framework
          </button>
        </div>
      )}

      {/* ── Filter pills ──────────────────────────────────────────────────────── */}
      {(gapKpis.length > 0 || showAll) && (
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setFilterKpi('All')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors',
              filterKpi === 'All'
                ? 'bg-brand-dark text-white border-brand-dark'
                : 'bg-white text-brand-dark border-gray-200 hover:border-brand-purple',
            )}
          >
            All KPIs ({interventionFilteredKpis.length})
          </button>
          {interventionFilteredKpis.map(kpi => {
            const cfg = KPI_CONFIG[kpi] ?? { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' }
            const count = RCA_DATA.filter(r => r.kpi === kpi).length
            return (
              <button
                key={kpi}
                onClick={() => setFilterKpi(kpi)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors',
                  filterKpi === kpi ? 'ring-2 ring-brand-purple ring-offset-1' : '',
                  cfg.color, cfg.bg, cfg.border,
                )}
              >
                {kpi} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
          <button
            onClick={() => { setShowAll(v => !v); setFilterKpi('All') }}
            className="text-xs text-caption hover:text-brand-purple ml-auto transition-colors"
          >
            {showAll ? '← Gaps only' : 'Show all KPIs'}
          </button>
        </div>
      )}

      {/* ── KPI sections grouped by bucket ───────────────────────────────────── */}
      {Object.keys(bucketGroups).length > 0 && (
        <div>
          {/* Expand All / Collapse All toggle */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setExpandAll(v => v === true ? false : true)}
              className="text-xs text-brand-purple hover:underline font-medium"
            >
              {expandAll === true ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {Object.entries(bucketGroups).map(([bucket, kpisInBucket], bucketIdx) => {
            const gapCount = kpisInBucket.filter(k => hasGap(k)).length
            return (
              <BucketSection
                key={bucket}
                bucketName={bucket}
                kpiCount={kpisInBucket.length}
                gapCount={gapCount}
                defaultOpen={bucketIdx === 0}
                forceOpen={expandAll}
              >
                {kpisInBucket.map(kpi => (
                  <KpiSection
                    key={kpi}
                    kpiName={kpi}
                    rows={RCA_DATA.filter(r => r.kpi === kpi)}
                    score={getScore(kpi)}
                  />
                ))}
              </BucketSection>
            )
          })}
        </div>
      )}

      {filteredKpis.length === 0 && (gapKpis.length > 0 || showAll) && (
        <p className="text-caption text-sm text-center py-6">
          {activeBucket
            ? `No root causes for the "${activeBucket}" bucket. Try clearing the filter.`
            : 'No root causes for the current filter.'}
        </p>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      {filteredKpis.length > 0 && (
        <p className="text-[11px] text-caption px-1">
          {filteredKpis.reduce((s, k) => s + RCA_DATA.filter(r => r.kpi === k).length, 0)} root causes shown.
          Click any intervention chip to expand the recommended action.
        </p>
      )}
    </div>
  )
}
```

---

## frontend/src/components/results/ProgramTimelineModal.tsx

```tsx
/**
 * ProgramTimelineModal — lets users configure workstream durations and
 * commercials text before generating the PPT proposal deck.
 *
 * Reads defaults from GET /session/{id}/program-timeline and saves via
 * POST /session/{id}/program-timeline before triggering the PPT export.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Loader2, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkstreamConfig {
  id: string
  name: string
  color: string
  default_weeks: number
  current_weeks?: number
}

interface ProgramTimelineModalProps {
  sessionId: string
  onClose: () => void
  onExport: () => void
  exporting: boolean
}

const AREA_BG: Record<string, string> = {
  op_model:     '#7C3AED',
  process:      '#0284C7',
  tech:         '#0891B2',
  ai:           '#6D28D9',
  capability:   '#059669',
  cost:         '#D97706',
  supply_chain: '#0D9488',
  change_mgmt:  '#BE185D',
}

export default function ProgramTimelineModal({
  sessionId, onClose, onExport, exporting,
}: ProgramTimelineModalProps) {
  const [workstreams, setWorkstreams] = useState<WorkstreamConfig[]>([])
  const [weeks, setWeeks] = useState<Record<string, number>>({})
  const [commercialsText, setCommercialsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCommercials, setShowCommercials] = useState(false)
  const [error, setError] = useState('')

  // Load current config
  useEffect(() => {
    fetch(`/api/v1/session/${sessionId}/program-timeline`)
      .then(r => r.json())
      .then(data => {
        const ws: WorkstreamConfig[] = data.workstreams || []
        setWorkstreams(ws)
        const initial: Record<string, number> = {}
        ws.forEach((w: WorkstreamConfig) => {
          initial[w.id] = w.current_weeks ?? w.default_weeks
        })
        setWeeks(initial)
        setCommercialsText(data.commercials_text || '')
      })
      .catch(() => setError('Could not load timeline configuration'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const handleSaveAndExport = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/program-timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelines: weeks, commercials_text: commercialsText }),
      })
      if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`)
      onExport()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalWeeks = Math.max(...Object.values(weeks), 0)

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-brand-dark text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Settings size={16} />
              <div>
                <p className="text-sm font-bold">Configure Programme Timeline</p>
                <p className="text-xs text-white/60">Set workstream durations before generating the PPT proposal</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-brand-purple" />
              </div>
            ) : (
              <>
                <p className="text-xs text-caption">
                  Adjust workstream durations below. The default durations are based on typical Accenture engagement timelines.
                  Programme total is <strong className="text-brand-dark">{totalWeeks} weeks</strong> based on the longest workstream.
                </p>

                {/* Workstream duration inputs */}
                <div className="space-y-3">
                  {workstreams.map(ws => {
                    const current = weeks[ws.id] ?? ws.default_weeks
                    const pct = Math.round((current / 26) * 100)
                    const color = AREA_BG[ws.id] || '#A100FF'
                    return (
                      <div key={ws.id} className="border border-bg-secondary rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-semibold text-brand-dark">{ws.name}</span>
                            {current !== ws.default_weeks && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                modified
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={52}
                              value={current}
                              onChange={e => setWeeks(prev => ({
                                ...prev,
                                [ws.id]: Math.max(1, Math.min(52, parseInt(e.target.value) || 1)),
                              }))}
                              className="w-14 text-xs border border-bg-secondary rounded px-2 py-1 text-center focus:outline-none focus:border-brand-purple font-semibold text-brand-dark"
                            />
                            <span className="text-xs text-caption">weeks</span>
                            <button
                              onClick={() => setWeeks(prev => ({ ...prev, [ws.id]: ws.default_weeks }))}
                              className="text-[10px] text-caption hover:text-brand-purple transition-colors"
                              title="Reset to default"
                            >
                              reset
                            </button>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1 bg-bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className="h-1 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                          />
                        </div>
                        <p className="text-[10px] text-caption mt-1">
                          Default: {ws.default_weeks}w · Current: {current}w ({current < 4 ? `${current * 7}d` : `~${(current / 4).toFixed(1)}m`})
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Commercials section (collapsible) */}
                <div className="border border-bg-secondary rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowCommercials(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-brand-dark hover:bg-bg-secondary/30 transition-colors"
                  >
                    <span>Commercials Slide Content <span className="font-normal text-caption">(optional)</span></span>
                    {showCommercials ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
                  </button>
                  <AnimatePresence>
                    {showCommercials && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-bg-secondary">
                          <p className="text-xs text-caption mt-3 mb-2">
                            Paste commercial details, indicative fees, or any specific T&C points.
                            Standard Accenture T&C boilerplate is always included at the bottom.
                          </p>
                          <textarea
                            value={commercialsText}
                            onChange={e => setCommercialsText(e.target.value)}
                            rows={5}
                            placeholder="e.g. Indicative fee for Phase 1: ₹X Cr over Y weeks. Payment terms: 30% upfront, 40% at milestone 1, 30% on completion. Expenses billed at cost."
                            className="w-full text-xs border border-bg-secondary rounded p-3 resize-y focus:outline-none focus:border-brand-purple text-black placeholder:text-caption"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-bg-secondary bg-bg-secondary/20 flex-shrink-0">
            <button
              onClick={onClose}
              className="text-xs text-caption hover:text-brand-dark border border-bg-secondary px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndExport}
              disabled={saving || exporting || loading}
              className="flex items-center gap-2 bg-brand-purple text-white text-xs font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {(saving || exporting)
                ? <><Loader2 size={13} className="animate-spin" /> Generating PPT…</>
                : <><Download size={13} /> Save & Export PPT</>
              }
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

---
## frontend/src/components/results/KpiDashboard.tsx

```tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { ChevronDown, ChevronUp, AlertCircle, TrendingUp, TrendingDown, Filter, X, Search, Pencil, CheckCircle2, Sparkles, Download, RefreshCw, Maximize2, Minimize2, AlertOctagon, AlertTriangle, Info, Lightbulb } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatIndianInt } from '@/lib/utils'
import type { SalientInsight } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface DrillItem { name: string; value: number; pct?: number }
interface TrendPoint { month: string; value: number }
interface KpiData {
  id: string; label: string; category: string; formula: string
  value: number | null; unit: string; available: boolean
  trend: TrendPoint[]; by_category: DrillItem[]; by_vendor: DrillItem[]
  by_plant: DrillItem[]; by_purchase_group: DrillItem[]
  confidence?: 'low' | 'medium' | 'high'
  confidence_reason?: string
}
interface DashboardData {
  summary: { total_spend_cr: number; po_count: number; pr_count: number; vendor_count: number; date_range: { from: string; to: string } }
  kpis: Record<string, KpiData>
  filters: { plants: {value:string;label:string}[]; categories: {value:string;label:string}[]; purchase_groups: {value:string;label:string}[]; vendors: {value:string;label:string}[] }
  row_count?: number
  low_confidence?: boolean
}
interface TraceColumn { logical: string; resolved: string | null; available: boolean }
interface TraceData {
  kpi_id: string
  steps: string[]
  columns_used: TraceColumn[]
  sample_rows: Record<string, any>[]
}

// ── Category layout matching the image ──────────────────────────────────────

const KPI_CATEGORIES = [
  {
    name: 'Spend Visibility', color: '#7c3aed', bg: 'bg-purple-50',
    kpis: ['proc_spend', 'spend_pct_revenue', 'po_volume']
  },
  {
    name: 'Efficiency', color: '#0284c7', bg: 'bg-blue-50',
    kpis: ['tat_pr_to_po', 'pr_approval_tat', 'po_approval_tat', 'rc_adoption_volume', 'rc_adoption_value', 'spend_per_fte', 'tail_spend_pct']
  },
  {
    name: 'Effectiveness', color: '#059669', bg: 'bg-emerald-50',
    kpis: ['savings_lpo', 'dpo', 'otpv']
  },
  {
    name: 'Vendor Management', color: '#d97706', bg: 'bg-amber-50',
    kpis: ['supplier_otd', 'defect_rate', 'pareto_vendors', 'vendors_rated']
  },
  {
    name: 'Sustainability', color: '#16a34a', bg: 'bg-green-50',
    kpis: ['esg_vendors']
  },
  {
    name: 'Digitization', color: '#6366f1', bg: 'bg-indigo-50',
    kpis: ['sourcing_tool']
  },
  {
    name: 'Risk Management', color: '#dc2626', bg: 'bg-red-50',
    kpis: ['emergency_prs', 'pac_prs']
  },
]

type DrillType = 'trend' | 'by_category' | 'by_vendor' | 'by_plant' | 'by_purchase_group'

const PURPLE = '#a100ff'
const COLORS = ['#a100ff','#460073','#0284c7','#059669','#d97706','#dc2626','#6366f1','#16a34a','#0891b2','#9333ea']

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtVal(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '—'
  if (unit === '₹ Cr') return `₹${formatIndianInt(value)} Cr`
  if (unit === 'days') return `${value.toFixed(0)}d`
  if (unit === '%') return `${value.toFixed(0)}%`
  if (unit === 'count') return value.toLocaleString()
  return `${value.toFixed(0)} ${unit}`
}

function fmtAxisVal(value: number, unit: string): string {
  if (unit === '₹ Cr') return `₹${value.toFixed(0)}`
  if (unit === '%') return `${value.toFixed(0)}%`
  if (unit === 'days') return `${value.toFixed(0)}d`
  return `${value}`
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-bg-secondary rounded shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-brand-dark mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || PURPLE }}>
          {p.name}: <strong>{fmtVal(p.value, unit)}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Formula text — expandable, never truncated ───────────────────────────────

function FormulaText({ formula }: { formula: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!formula) return null
  const isLong = formula.length > 60
  return (
    <div className="mt-1">
      <p className={cn('text-[10px] text-caption leading-snug', !expanded && isLong ? 'line-clamp-1' : '')}>
        {formula}
      </p>
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className="text-[9px] text-brand-purple hover:underline mt-0.5"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  )
}

// ── Trace Modal ───────────────────────────────────────────────────────────────

function TraceModal({
  kpi, sessionId, onClose
}: { kpi: KpiData; sessionId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/v1/session/${sessionId}/results/kpi-dashboard/${kpi.id}/trace`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.detail || 'Failed')))
      .then(d => setTrace(d))
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [kpi.id, sessionId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-secondary bg-brand-dark text-white">
          <div>
            <p className="text-xs opacity-70 font-medium uppercase tracking-wide">Calculation Trace</p>
            <h3 className="text-base font-bold">{kpi.label}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-caption">
              <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              Loading trace…
            </div>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
          {trace && (
            <>
              {/* Formula */}
              <div>
                <p className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-1">Formula</p>
                <div className="bg-bg-secondary/30 border border-bg-secondary rounded p-3 text-xs text-black/70 font-mono leading-relaxed whitespace-pre-wrap">
                  {kpi.formula}
                </div>
              </div>

              {/* Steps */}
              <div>
                <p className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-2">How it was calculated</p>
                <ol className="space-y-1.5">
                  {trace.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-purple text-white flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <span className="mt-0.5 leading-snug">{step.replace(/^\d+\.\s*/, '')}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Columns used */}
              {trace.columns_used.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-2">Source Columns</p>
                  <div className="space-y-1">
                    {trace.columns_used.map((col, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {col.available
                          ? <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
                          : <AlertCircle size={13} className="text-red-400 flex-shrink-0" />}
                        <span className={cn('font-medium', col.available ? 'text-gray-800' : 'text-red-500')}>
                          {col.logical}
                        </span>
                        {col.resolved && (
                          <span className="text-caption ml-1 font-mono">→ {col.resolved}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample rows */}
              {trace.sample_rows.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-2">
                    Sample Source Rows <span className="text-caption normal-case font-normal">(up to 10)</span>
                  </p>
                  <div className="overflow-x-auto rounded border border-bg-secondary">
                    <table className="text-[10px] w-full">
                      <thead className="bg-brand-dark text-white">
                        <tr>
                          {Object.keys(trace.sample_rows[0]).map(k => (
                            <th key={k} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trace.sample_rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                            {Object.values(row).map((v: any, ci) => (
                              <td key={ci} className="px-2 py-1 whitespace-nowrap font-mono text-black/70">
                                {v === null || v === undefined ? <span className="text-caption italic">—</span> : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Formula Editor Modal ──────────────────────────────────────────────────────

interface FormulaOverride { note: string }

function FormulaEditorModal({
  kpi, override, onSave, onClose
}: {
  kpi: KpiData
  override: FormulaOverride
  onSave: (o: FormulaOverride) => void
  onClose: () => void
}) {
  const [note, setNote] = useState(override.note)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-secondary bg-brand-dark text-white">
          <div>
            <p className="text-xs opacity-70 font-medium uppercase tracking-wide">Formula Details</p>
            <h3 className="text-base font-bold">{kpi.label}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current formula (read-only) */}
          <div>
            <p className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-1">Current Formula</p>
            <div className="bg-bg-secondary/30 border border-bg-secondary rounded p-3 text-xs font-mono text-black/70 leading-relaxed whitespace-pre-wrap">
              {kpi.formula || 'No formula defined'}
            </div>
          </div>

          {/* KPI metadata */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-purple-50 rounded p-2">
              <p className="text-caption uppercase text-[10px] font-bold">Category</p>
              <p className="font-semibold text-brand-dark mt-0.5">{kpi.category}</p>
            </div>
            <div className="bg-purple-50 rounded p-2">
              <p className="text-caption uppercase text-[10px] font-bold">Unit</p>
              <p className="font-semibold text-brand-dark mt-0.5">{kpi.unit}</p>
            </div>
            <div className="bg-purple-50 rounded p-2">
              <p className="text-caption uppercase text-[10px] font-bold">Current Value</p>
              <p className="font-semibold text-brand-dark mt-0.5">
                {kpi.available && kpi.value !== null ? `${kpi.value} ${kpi.unit}` : 'N/A'}
              </p>
            </div>
          </div>

          {/* User annotation */}
          <div>
            <label className="block text-xs font-bold text-brand-dark uppercase tracking-wide mb-1">
              Your Notes / Override Rationale
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add notes about this formula, e.g. 'Using 45-day payment terms instead of 30' or 'Excluding plant XYZ from TAT calculation…'"
              className="w-full text-xs border border-bg-secondary rounded p-2.5 resize-y focus:outline-none focus:border-brand-purple leading-relaxed"
            />
          </div>
        </div>

        <div className="px-5 pb-4 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs border border-bg-secondary rounded text-caption hover:border-brand-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave({ note }); onClose() }}
            className="px-3 py-1.5 text-xs bg-brand-purple text-white rounded hover:bg-brand-dark transition-colors font-semibold">
            Save Note
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── KPI Flashcard + Drill-down ───────────────────────────────────────────────

function KpiCard({ kpi, catColor, sessionId }: { kpi: KpiData; catColor: string; sessionId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [drillType, setDrillType] = useState<DrillType>('trend')
  const [showTrace, setShowTrace] = useState(false)
  const [showFormula, setShowFormula] = useState(false)
  const [formulaOverride, setFormulaOverride] = useState<FormulaOverride>({ note: '' })

  const trend = kpi.trend || []
  const hasTrend = trend.length > 1
  const lastTwo = trend.slice(-2)
  const trendDir = lastTwo.length === 2 && lastTwo[1].value !== null && lastTwo[0].value !== null
    ? lastTwo[1].value > lastTwo[0].value ? 'up' : lastTwo[1].value < lastTwo[0].value ? 'down' : 'flat'
    : 'flat'

  const drillData: Record<DrillType, DrillItem[]> = {
    trend: [],
    by_category: kpi.by_category || [],
    by_vendor: kpi.by_vendor || [],
    by_plant: kpi.by_plant || [],
    by_purchase_group: kpi.by_purchase_group || [],
  }

  const ALL_DRILL_TABS: { key: DrillType; label: string }[] = [
    { key: 'trend', label: 'Monthly Trend' },
    { key: 'by_category', label: 'By Category' },
    { key: 'by_vendor', label: 'By Vendor' },
    { key: 'by_plant', label: 'By Plant' },
    { key: 'by_purchase_group', label: 'By Buyer Group' },
  ]
  const DRILL_TABS = ALL_DRILL_TABS.filter(t => t.key === 'trend' ? hasTrend : (drillData[t.key]?.length > 0))

  return (
    <>
      {/* Modals (rendered outside card flow) */}
      <AnimatePresence>
        {showTrace && (
          <TraceModal kpi={kpi} sessionId={sessionId} onClose={() => setShowTrace(false)} />
        )}
        {showFormula && (
          <FormulaEditorModal
            kpi={kpi}
            override={formulaOverride}
            onSave={o => setFormulaOverride(o)}
            onClose={() => setShowFormula(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        layout
        className="acc-card overflow-hidden cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        whileHover={{ boxShadow: `0 0 0 2px ${catColor}33` }}
      >
        {/* Flashcard header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs text-caption font-medium truncate">{kpi.label}</p>
              {kpi.confidence === 'low' && (
                <span className="flex-shrink-0 text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1 py-0.5 rounded font-medium"
                  title={kpi.confidence_reason || 'Low data volume — results directional only'}>
                  ~
                </span>
              )}
            </div>
            {kpi.available ? (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black" style={{ color: catColor }}>{fmtVal(kpi.value, kpi.unit)}</span>
                {trendDir !== 'flat' && (
                  <span className={cn('text-xs font-semibold', trendDir === 'up' ? 'text-green-600' : 'text-red-600')}>
                    {trendDir === 'up' ? <TrendingUp size={12} className="inline" /> : <TrendingDown size={12} className="inline" />}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="text-caption" />
                <span className="text-xs text-caption">Data unavailable</span>
              </div>
            )}
            <FormulaText formula={kpi.formula} />
            {formulaOverride.note && (
              <p className="text-[10px] text-amber-600 italic mt-0.5 line-clamp-1" title={formulaOverride.note}>
                📝 {formulaOverride.note}
              </p>
            )}
          </div>

          {/* Mini sparkline */}
          {hasTrend && kpi.available && (
            <div className="w-20 h-10 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <Line type="monotone" dataKey="value" stroke={catColor} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex-shrink-0 ml-1">
            {expanded ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
          </div>
        </div>

        {/* Drill-down panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="mt-4 pt-3 border-t border-bg-secondary">

                {/* Action buttons — trace + formula */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={e => { e.stopPropagation(); setShowTrace(true) }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-brand-purple text-brand-purple hover:bg-purple-50 transition-colors"
                  >
                    <Search size={11} /> Trace Calculation
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setShowFormula(true) }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-bg-secondary text-caption hover:border-brand-dark hover:text-brand-dark transition-colors"
                  >
                    <Pencil size={11} /> Formula
                  </button>
                </div>

              {kpi.available && (<>
              {/* Drill tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {DRILL_TABS.map(t => (
                  <button key={t.key}
                    onClick={() => setDrillType(t.key)}
                    className={cn('px-2 py-1 rounded text-xs font-medium transition-colors',
                      drillType === t.key
                        ? 'text-white'
                        : 'bg-bg-secondary text-caption hover:text-brand-dark'
                    )}
                    style={drillType === t.key ? { background: catColor } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Trend chart */}
              {drillType === 'trend' && hasTrend && (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={catColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={catColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtAxisVal(v, kpi.unit)} width={45} />
                    <RTooltip content={<CustomTooltip unit={kpi.unit} />} />
                    <Area type="monotone" dataKey="value" name={kpi.label} stroke={catColor} fill={`url(#grad-${kpi.id})`} strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* Bar drill-downs */}
              {drillType !== 'trend' && drillData[drillType].length > 0 && (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={Math.min(drillData[drillType].length * 32 + 40, 260)}>
                    <BarChart
                      data={drillData[drillType].slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 0, right: 50, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtAxisVal(v, kpi.unit)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} tickFormatter={v => v.length > 18 ? v.slice(0, 17) + '…' : v} />
                      <RTooltip content={<CustomTooltip unit={kpi.unit} />} />
                      <Bar dataKey="value" name={kpi.label} radius={[0, 3, 3, 0]}>
                        {drillData[drillType].slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Data table */}
                  <table className="w-full acc-table text-xs mt-2">
                    <thead><tr><th className="text-left">Name</th><th>Value</th>{drillData[drillType][0]?.pct !== undefined && <th>Share</th>}</tr></thead>
                    <tbody>
                      {drillData[drillType].slice(0, 10).map((item, i) => (
                        <tr key={i}>
                          <td className="text-left">{item.name}</td>
                          <td className="text-center font-mono">{fmtVal(item.value, kpi.unit)}</td>
                          {item.pct !== undefined && <td className="text-center text-caption">{item.pct.toFixed(0)}%</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

// ── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ summary }: { summary: DashboardData['summary'] }) {
  const cards = [
    { label: 'Total Spend', value: summary.total_spend_cr != null ? `₹${formatIndianInt(summary.total_spend_cr)} Cr` : '—' },
    { label: 'Purchase Orders', value: summary.po_count?.toLocaleString() ?? '—' },
    { label: 'Purchase Requests', value: summary.pr_count?.toLocaleString() ?? '—' },
    { label: 'Active Vendors', value: summary.vendor_count?.toLocaleString() ?? '—' },
    { label: 'Period', value: summary.date_range ? `${summary.date_range.from?.slice(0, 7)} → ${summary.date_range.to?.slice(0, 7)}` : '—' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      {cards.map(c => (
        <div key={c.label} className="acc-card py-3 text-center">
          <p className="text-xs text-caption uppercase tracking-wide">{c.label}</p>
          <p className="text-base font-black text-brand-dark mt-0.5">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters { plant: string; category: string; purchase_group: string; date_from: string; date_to: string }

function FilterBar({
  filters, activeFilters, onFilterChange, onClear, dateRange
}: {
  filters: DashboardData['filters']
  activeFilters: Filters
  onFilterChange: (k: keyof Filters, v: string) => void
  onClear: () => void
  dateRange?: { from: string; to: string }
}) {
  const hasActive = Object.values(activeFilters).some(v => v !== '')
  return (
    <div className="acc-card mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-brand-purple flex-shrink-0" />
        <span className="text-xs font-bold text-brand-dark">Filters</span>

        <select value={activeFilters.plant}
          onChange={e => onFilterChange('plant', e.target.value)}
          className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple">
          <option value="">All Plants</option>
          {filters.plants.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select value={activeFilters.category}
          onChange={e => onFilterChange('category', e.target.value)}
          className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple">
          <option value="">All Categories</option>
          {filters.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select value={activeFilters.purchase_group}
          onChange={e => onFilterChange('purchase_group', e.target.value)}
          className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple">
          <option value="">All Buyer Groups</option>
          {filters.purchase_groups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-caption font-medium">Month:</span>
          <input type="month" value={activeFilters.date_from}
            onChange={e => onFilterChange('date_from', e.target.value)}
            min={dateRange?.from?.slice(0, 7)} max={dateRange?.to?.slice(0, 7)}
            className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple" />
          <span className="text-caption text-xs">→</span>
          <input type="month" value={activeFilters.date_to}
            onChange={e => onFilterChange('date_to', e.target.value)}
            min={dateRange?.from?.slice(0, 7)} max={dateRange?.to?.slice(0, 7)}
            className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple" />
        </div>

        {hasActive && (
          <button onClick={onClear}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1.5 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ── Spend Pareto (special vendor chart) ─────────────────────────────────────

function SpendParetoChart({ data }: { data: DrillItem[] }) {
  if (!data.length) return null
  let cum = 0
  const total = data.reduce((s, d) => s + d.value, 0)
  const chartData = data.slice(0, 20).map(d => {
    cum += d.value
    return { name: d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name, spend: d.value, cumPct: total > 0 ? (cum / total) * 100 : 0 }
  })

  return (
    <div className="acc-card mb-5">
      <h3 className="text-sm font-bold text-brand-dark mb-3">Vendor Spend Pareto (Top 20)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 40, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v.toFixed(0)}`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 100]} />
          <RTooltip formatter={(v: any, n: string) => n === 'spend' ? [`₹${formatIndianInt(Number(v))} Cr`, 'Spend'] : [`${Number(v).toFixed(0)}%`, 'Cumulative']} />
          <Bar yAxisId="left" dataKey="spend" fill={PURPLE} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#d97706" strokeWidth={2} dot={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Salient Insights (backend-derived, session-specific) ─────────────────────

interface SmartInsight {
  severity: 'critical' | 'warning' | 'info'
  label: string
  text: string
  metric?: string
}

function SalientInsights({ sessionId }: { sessionId: string }) {
  const [backendInsights, setBackendInsights] = useState<SalientInsight[] | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/session/${sessionId}/results/kpi-dashboard/salient-insights`)
      .then(r => r.json())
      .then(d => setBackendInsights(d.insights || []))
      .catch(() => setBackendInsights([]))
  }, [sessionId])

  // Use backend insights exclusively — no hardcoded frontend fallbacks
  const allInsights: SmartInsight[] = (backendInsights ?? []).map(b => ({
    severity: b.severity as 'critical' | 'warning' | 'info',
    label: b.label,
    text: b.text,
  }))

  // Still loading
  if (backendInsights === null) return (
    <div className="acc-card mb-4 flex items-center gap-2 text-xs text-caption">
      <svg className="animate-spin w-4 h-4 text-brand-purple" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      Loading salient insights…
    </div>
  )

  if (allInsights.length === 0) return (
    <div className="acc-card mb-4 text-xs text-caption italic">No salient insights available for the current data set.</div>
  )

  return (
    <div className="acc-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-brand-dark flex items-center gap-1.5"><Lightbulb size={14} className="text-brand-purple" /> Salient Insights</span>
        <button
          onClick={() => setVisible(v => !v)}
          className="text-xs text-caption hover:text-brand-purple transition-colors"
        >
          {visible ? 'Hide' : 'Show insights'}
        </button>
      </div>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allInsights.map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn(
                    'border-l-4 pl-3 pr-4 py-3 rounded-r border border-l-4 bg-white shadow-sm',
                    ins.severity === 'critical' ? 'border-l-red-500 border-red-100'
                    : ins.severity === 'warning'  ? 'border-l-amber-400 border-amber-100'
                    : 'border-l-blue-400 border-blue-100'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {ins.severity === 'critical'
                      ? <AlertOctagon size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      : ins.severity === 'warning'
                        ? <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        : <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-brand-dark">{ins.label}</p>
                      {(ins as SmartInsight).metric && (
                        <p className={cn(
                          'text-sm font-black mt-0.5',
                          ins.severity === 'critical' ? 'text-red-600' : ins.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                        )}>
                          {(ins as SmartInsight).metric}
                        </p>
                      )}
                      <p className="text-xs text-black/60 mt-1 leading-relaxed">{ins.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── AI Insights Panel ────────────────────────────────────────────────────────

interface AiHealth { score: number; label: string; summary: string }
interface AiIssue  { title: string; kpi: string; detail: string; impact: string }
interface AiAction { title: string; timeframe: string; detail: string; expected_benefit: string }
interface AiQuickWin { title: string; detail: string; benefit: string }
interface AiKpiDeepDive {
  kpi: string
  headline: string
  distribution: string
  drivers: string
  solution: string
}
interface AiInsightsData {
  overall_health: AiHealth
  kpi_deep_dive?: AiKpiDeepDive[]
  critical_issues: AiIssue[]
  priority_actions: AiAction[]
  quick_wins: AiQuickWin[]
  benchmark_gap: string
  source?: string
}

function AiInsightsPanel({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<AiInsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`/api/v1/session/${sessionId}/results/ai-insights/status`)
      .then(r => r.json())
      .then(d => setGeminiAvailable(d.gemini_available))
      .catch(() => setGeminiAvailable(false))
  }, [sessionId])

  const generate = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/ai-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_refresh: forceRefresh }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      const d = await res.json()
      setData(d.insights)
      setOpen(true)
    } catch (e: any) {
      alert(`AI insights error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const healthColor = (score: number) =>
    score >= 8 ? '#2E7D32' : score >= 6 ? '#1565C0' : score >= 4 ? '#E65100' : '#C62828'

  const timeframeColor = (tf: string) =>
    tf.includes('Quick') ? 'bg-green-50 border-green-200 text-green-800'
    : tf.includes('Short') ? 'bg-blue-50 border-blue-200 text-blue-800'
    : 'bg-amber-50 border-amber-200 text-amber-800'

  return (
    <div className="acc-card mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-purple" />
          <span className="text-sm font-bold text-brand-dark">AI-Generated Insights</span>
          {data ? (
            data.source === 'vertex-gemini' ? (
              <span className="text-[10px] bg-purple-100 text-brand-purple px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                ✨ Gemini AI
              </span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                ⚙ Rule-based fallback
              </span>
            )
          ) : geminiAvailable === true ? (
            <span className="text-[10px] bg-purple-50 text-brand-purple px-1.5 py-0.5 rounded font-medium">
              Gemini ready
            </span>
          ) : (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
              ⚙ Rule-based mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={() => generate(true)}
              className="flex items-center gap-1 text-xs text-caption hover:text-brand-purple border border-bg-secondary rounded px-2 py-1 transition-colors"
              title="Regenerate">
              <RefreshCw size={11} />
            </button>
          )}
          {!data ? (
            <button
              onClick={() => generate()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-purple text-white rounded text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {loading
                ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                : <><Sparkles size={12} /> Generate Insights</>
              }
            </button>
          ) : (
            <button onClick={() => setOpen(v => !v)}
              className="text-xs text-caption hover:text-brand-purple transition-colors border border-bg-secondary rounded px-2 py-1">
              {open ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Overall health */}
              <div className="flex items-start gap-3 p-3 bg-bg-secondary/30 rounded-lg border border-bg-secondary">
                <div className="w-14 h-14 rounded-full flex-shrink-0 flex flex-col items-center justify-center font-black text-white text-2xl"
                  style={{ background: healthColor(data.overall_health.score) }}>
                  {data.overall_health.score}
                  <span className="text-[9px] font-semibold leading-none mt-0.5">/10</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-dark">{data.overall_health.label}</p>
                  <p className="text-xs text-black/60 mt-1 leading-relaxed">{data.overall_health.summary}</p>
                </div>
              </div>

              {/* ── KPI deep-dive — between-the-lines distribution analysis ── */}
              {data.kpi_deep_dive && data.kpi_deep_dive.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-xs font-bold text-brand-purple uppercase tracking-wide">Between the lines</p>
                    <p className="text-[10px] text-caption italic">Headline · Distribution · Drivers · Solution</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.kpi_deep_dive.map((dd, i) => (
                      <div
                        key={i}
                        className="bg-white border border-brand-purple/20 rounded-xl overflow-hidden"
                      >
                        {/* Headline strip */}
                        <div className="bg-brand-purple/8 border-b border-brand-purple/15 px-3 py-2 flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-brand-dark truncate">{dd.kpi}</span>
                          <span className="text-xs font-black text-brand-purple whitespace-nowrap">{dd.headline}</span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          {/* Distribution — the "between the lines" core */}
                          <div>
                            <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700 mb-0.5">Distribution</p>
                            <p className="text-[11px] leading-relaxed text-brand-dark">{dd.distribution}</p>
                          </div>
                          {/* Drivers */}
                          <div>
                            <p className="text-[9px] uppercase tracking-wider font-bold text-red-700 mb-0.5">Drivers of the bad tail</p>
                            <p className="text-[11px] leading-relaxed text-brand-dark/85">{dd.drivers}</p>
                          </div>
                          {/* Solution */}
                          <div className="bg-green-50 border-l-4 border-l-green-500 rounded px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-green-700 mb-0.5">Solution</p>
                            <p className="text-[11px] leading-relaxed text-brand-dark">{dd.solution}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Critical issues */}
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Critical Issues</p>
                  <div className="space-y-2">
                    {data.critical_issues.map((issue, i) => (
                      <div key={i} className="bg-red-50 border border-red-100 rounded p-2.5">
                        <p className="text-xs font-bold text-red-800">{issue.title}</p>
                        <p className="text-[11px] text-red-700 mt-1 leading-snug">{issue.detail}</p>
                        {issue.impact && (
                          <p className="text-[10px] text-red-500 mt-1 italic">{issue.impact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority actions */}
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Priority Actions</p>
                  <div className="space-y-2">
                    {data.priority_actions.map((action, i) => (
                      <div key={i} className={cn('border rounded p-2.5', timeframeColor(action.timeframe))}>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[9px] font-bold border border-current rounded px-1 py-0.5 flex-shrink-0 mt-0.5 whitespace-nowrap">
                            {action.timeframe.split('(')[0].trim()}
                          </span>
                          <p className="text-xs font-bold">{action.title}</p>
                        </div>
                        {action.expected_benefit && (
                          <p className="text-[10px] mt-1 opacity-80 leading-snug">{action.expected_benefit}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick wins + benchmark */}
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Quick Wins</p>
                  <div className="space-y-2">
                    {data.quick_wins.map((qw, i) => (
                      <div key={i} className="bg-green-50 border border-green-100 rounded p-2.5">
                        <p className="text-xs font-bold text-green-800">{qw.title}</p>
                        <p className="text-[10px] text-green-700 mt-1 leading-snug">{qw.benefit}</p>
                      </div>
                    ))}
                  </div>
                  {data.benchmark_gap && (
                    <div className="mt-3 bg-purple-50 border border-purple-100 rounded p-2.5">
                      <p className="text-[10px] font-bold text-brand-purple mb-1">Benchmark Gap</p>
                      <p className="text-[10px] text-black/70 leading-snug">{data.benchmark_gap}</p>
                    </div>
                  )}
                </div>
              </div>

              {data.source && (
                <p className="text-[9px] text-caption text-right">
                  Source: {data.source === 'gemini' ? 'Google Gemini AI' : 'Rule-based analysis'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Collapsible Category Section ─────────────────────────────────────────────

function CollapsibleCategory({
  cat,
  catKpis,
  filtering,
  sessionId,
}: {
  cat: { name: string; color: string; bg: string; kpis: string[] }
  catKpis: KpiData[]
  filtering: boolean
  sessionId: string
}) {
  const [open, setOpen] = useState(true)
  const [maximized, setMaximized] = useState(false)

  const availableCount = catKpis.filter(k => k.available).length
  const avgValue = catKpis.filter(k => k.available && k.value !== null)
  const cardCount = catKpis.length

  return (
    <>
      {/* Backdrop — rendered as a sibling BEFORE the container so it sits behind it */}
      {maximized && (
        <div
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: 48 }}
          onClick={() => setMaximized(false)}
        />
      )}

      <div className={cn(
        'mb-4 rounded-xl border border-bg-secondary overflow-hidden',
        maximized && 'fixed inset-4 bg-white shadow-2xl flex flex-col',
      )}
        style={maximized ? { zIndex: 49 } : undefined}
      >
        {/* Category header */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer select-none"
          style={{ background: cat.color + '22', borderBottom: open ? `1px solid ${cat.color}50` : 'none' }}
          onClick={() => setOpen(o => !o)}
        >
          <div className="h-5 w-1 rounded-full flex-shrink-0" style={{ background: cat.color }} />
          <h3 className="text-sm font-bold text-brand-dark flex-1">{cat.name}</h3>
          <span className="text-xs text-caption">
            {availableCount}/{cardCount} available
          </span>
          {filtering && <div className="w-3 h-3 border border-brand-purple border-t-transparent rounded-full animate-spin" />}
          <button
            onClick={e => { e.stopPropagation(); setMaximized(m => !m) }}
            className="text-xs text-caption hover:text-brand-purple border border-bg-secondary rounded px-1.5 py-0.5 ml-1 transition-colors"
            aria-label={maximized ? 'Restore section' : 'Maximize section'}
            title={maximized ? 'Restore' : 'Maximize section'}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {open
            ? <ChevronUp size={14} className="text-caption flex-shrink-0" />
            : <ChevronDown size={14} className="text-caption flex-shrink-0" />}
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={cn('overflow-hidden', maximized && 'flex-1 overflow-y-auto')}
            >
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catKpis.map(kpi => (
                  <KpiCard key={kpi.id} kpi={kpi} catColor={cat.color} sessionId={sessionId} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function KpiDashboard({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilters, setActiveFilters] = useState<Filters>({ plant: '', category: '', purchase_group: '', date_from: '', date_to: '' })
  const [filteredData, setFilteredData] = useState<DashboardData | null>(null)
  const [filtering, setFiltering] = useState(false)

  // Initial load
  useEffect(() => {
    if (!sessionId) return
    fetchDashboard({})
  }, [sessionId])

  const fetchDashboard = async (params: Partial<Filters>) => {
    setFiltering(true)
    try {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v as string) })
      const url = `/api/v1/session/${sessionId}/results/kpi-dashboard${qs.toString() ? '?' + qs : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed')
      const d = await res.json()
      if (!data) setData(d)  // store original for filter options
      setFilteredData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setFiltering(false)
    }
  }

  const handleFilterChange = (k: keyof Filters, v: string) => {
    const next = { ...activeFilters, [k]: v }
    setActiveFilters(next)
    fetchDashboard(next)
  }

  const handleClearFilters = () => {
    const empty = { plant: '', category: '', purchase_group: '', date_from: '', date_to: '' }
    setActiveFilters(empty)
    fetchDashboard(empty)
  }

  const display = filteredData || data

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-caption">Computing KPI dashboard…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="acc-card text-center py-8">
      <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
      <p className="text-sm text-red-600">{error}</p>
    </div>
  )

  if (!display) return null

  const kpis = display.kpis || {}
  const vendorSpend = kpis['proc_spend']?.by_vendor || []

  const handlePptDownload = async () => {
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/export/ppt`)
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const errText = contentType.includes('json')
          ? ((await res.json()).detail || 'PPT export failed')
          : await res.text()
        throw new Error(errText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch ? filenameMatch[1] : 'Procurement_Assessment.pptx'
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`PPT download failed: ${e.message}`)
    }
  }

  const handleProposalDownload = async () => {
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/export/ppt/proposal`)
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const errText = contentType.includes('json')
          ? ((await res.json()).detail || 'Proposal export failed')
          : await res.text()
        throw new Error(errText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch ? filenameMatch[1] : 'Procurement_Transformation_Proposal.pptx'
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Proposal download failed: ${e.message}`)
    }
  }

  return (
    <div>
      {/* Top-right actions bar */}
      <div className="flex justify-end mb-3">
        <button
          onClick={handlePptDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-purple text-brand-purple rounded text-xs font-semibold hover:bg-purple-50 transition-colors"
        >
          <Download size={13} /> KPI Deck
        </button>
        <button
          onClick={handleProposalDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-700 rounded text-xs font-semibold hover:bg-teal-50 transition-colors"
        >
          <Download size={13} /> Proposal Deck
        </button>
      </div>

      {/* AI insights */}
      <AiInsightsPanel sessionId={sessionId} />

      {/* Low-confidence banner — shown when PO dataset has < 50 rows */}
      {display.low_confidence && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Low data volume:</strong> KPIs computed from only{' '}
            <strong>{display.row_count ?? '?'} PO rows</strong>. Results are directional — upload a fuller dataset (≥ 50 POs) for statistically reliable benchmarking.
          </span>
        </div>
      )}

      {/* Filter bar */}
      <FilterBar
        filters={data?.filters || display.filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
        dateRange={display.summary?.date_range}
      />

      {/* Summary strip */}
      <SummaryStrip summary={display.summary} />

      {/* Vendor pareto */}
      {vendorSpend.length > 0 && <SpendParetoChart data={vendorSpend} />}

      {/* KPI categories — collapsible sections */}
      {KPI_CATEGORIES.map(cat => {
        const catKpis = cat.kpis.map(kid => kpis[kid]).filter(Boolean)
        if (!catKpis.length) return null
        return (
          <CollapsibleCategory
            key={cat.name}
            cat={cat}
            catKpis={catKpis}
            filtering={filtering}
            sessionId={sessionId}
          />
        )
      })}
    </div>
  )
}
```

---
## frontend/src/components/results/AiUsecasesTab.tsx

```tsx
/**
 * AiUsecasesTab — Agentic S2P Use-Case Catalogue + Business Case Builder.
 *
 * Loads the catalogue from GET /ai-usecases.
 * Each super-agent card expands to show utility agents, KPIs, and a
 * business-case calculator that calls POST /session/{id}/ai-usecases/business-case.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, ChevronDown, ChevronUp, Calculator, Loader2,
  FileText, Layers, Search, Users, Award, MessageSquare,
  FileCheck, TrendingUp, Zap, Target, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SuperAgent {
  name: string
  description: string
  utility_agents: string[]
  complexity: 'Low' | 'Medium' | 'High'
  efficiency_impact: 'Low' | 'Medium' | 'High'
  performed_by: 'Agent' | 'Human-in-the-loop' | 'Both'
  kpis: string[]
  edge: string
  fte_automation_pct: number
}

interface UseCase {
  id: string
  l1_process: string
  color: string
  icon: string
  super_agents: SuperAgent[]
}

interface CatalogueResponse {
  usecases: UseCase[]
  total_agents: number
  l1_processes: string[]
}

interface BusinessCaseResult {
  agent_name: string
  l1_process: string
  inputs: {
    fte_count: number
    transactions_per_month: number
    cost_per_fte_annual_lakh: number
    manual_hours_per_transaction: number
    automation_pct: number
  }
  quantified_benefits: {
    annual_transactions: number
    total_manual_hours_pa: number
    hours_saved_pa: number
    fte_equivalent_saved: number
    cost_saving_cr: number
    tat_reduction_pct: number
  }
  kpis: string[]
  edge: string
  complexity: string
  narrative?: string
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Layers, Search, Users, Award, MessageSquare,
  FileCheck, TrendingUp, Cpu, Zap, Target, BarChart2,
}

// ── Complexity / impact badges ────────────────────────────────────────────────

function ComplexityBadge({ value }: { value: string }) {
  const cls =
    value === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
    value === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-green-50 text-green-700 border-green-200'
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>
      {value}
    </span>
  )
}

function PerformedByBadge({ value }: { value: string }) {
  const cls =
    value === 'Agent' ? 'bg-violet-50 text-violet-700 border-violet-200' :
    value === 'Both' ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-teal-50 text-teal-700 border-teal-200'
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>
      {value}
    </span>
  )
}

// ── Business Case Calculator ───────────────────────────────────────────────────

interface BizCaseProps {
  agent: SuperAgent
  sessionId: string
}

function BusinessCaseCalculator({ agent, sessionId }: BizCaseProps) {
  const [fteCount, setFteCount] = useState(10)
  const [txPerMonth, setTxPerMonth] = useState(500)
  const [costPerFte, setCostPerFte] = useState(12)
  const [hoursPerTx, setHoursPerTx] = useState(0.5)
  const [result, setResult] = useState<BusinessCaseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCalculate = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/ai-usecases/business-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agent.name,
          fte_count: fteCount,
          transactions_per_month: txPerMonth,
          cost_per_fte_annual_lakh: costPerFte,
          manual_hours_per_transaction: hoursPerTx,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, agent.name, fteCount, txPerMonth, costPerFte, hoursPerTx])

  return (
    <div className="mt-4 border border-bg-secondary rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary/40 border-b border-bg-secondary">
        <Calculator size={13} className="text-brand-purple" />
        <span className="text-xs font-bold text-brand-dark">Business Case Calculator</span>
        <span className="text-[10px] text-caption ml-auto">Enter your organisation's parameters</span>
      </div>

      <div className="p-4">
        {/* Inputs grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'FTE Count', value: fteCount, set: setFteCount, min: 1, step: 1, hint: 'people in process' },
            { label: 'Transactions / Month', value: txPerMonth, set: setTxPerMonth, min: 1, step: 50, hint: 'events / orders / PRs' },
            { label: 'Cost per FTE (₹ Lakh/yr)', value: costPerFte, set: setCostPerFte, min: 1, step: 1, hint: 'all-in annual cost' },
            { label: 'Manual Hours / Transaction', value: hoursPerTx, set: setHoursPerTx, min: 0.1, step: 0.1, hint: 'average hrs per event' },
          ].map(({ label, value, set, min, step, hint }) => (
            <div key={label}>
              <label className="block text-[10px] font-semibold text-caption uppercase tracking-wide mb-1">{label}</label>
              <input
                type="number"
                min={min}
                step={step}
                value={value}
                onChange={e => set(parseFloat(e.target.value) || min)}
                className="w-full text-xs border border-bg-secondary rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-purple text-brand-dark font-semibold"
              />
              <p className="text-[10px] text-caption mt-0.5">{hint}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="flex items-center gap-2 bg-brand-purple text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
            {loading ? 'Calculating…' : 'Calculate Business Case'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-bg-secondary">
                {/* Key metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">Hours Saved / Year</p>
                    <p className="text-xl font-black text-brand-dark">
                      {result.quantified_benefits.hours_saved_pa.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-caption">
                      of {result.quantified_benefits.total_manual_hours_pa.toLocaleString()} total hrs
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">FTE Equivalent Saved</p>
                    <p className="text-xl font-black text-green-700">
                      {result.quantified_benefits.fte_equivalent_saved.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-caption">FTEs freed up</p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">Cost Saving / Year</p>
                    <p className="text-xl font-black text-blue-700">
                      ₹{result.quantified_benefits.cost_saving_cr.toFixed(2)} Cr
                    </p>
                    <p className="text-[10px] text-caption">annualised</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">TAT Reduction</p>
                    <p className="text-xl font-black text-amber-700">
                      ~{result.quantified_benefits.tat_reduction_pct.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-caption">cycle time improvement</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">Annual Transactions</p>
                    <p className="text-xl font-black text-rose-700">
                      {result.quantified_benefits.annual_transactions.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-caption">events processed</p>
                  </div>
                  <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-center">
                    <p className="text-[10px] text-caption uppercase font-semibold tracking-wide mb-1">Automation Coverage</p>
                    <p className="text-xl font-black text-teal-700">
                      {result.inputs.automation_pct}%
                    </p>
                    <p className="text-[10px] text-caption">of manual effort</p>
                  </div>
                </div>

                {/* AI Narrative */}
                {result.narrative && (
                  <div className="p-3 bg-purple-50 border border-brand-purple/20 rounded-xl">
                    <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Zap size={10} /> AI Executive Summary
                    </p>
                    <p className="text-xs text-brand-dark leading-relaxed">{result.narrative}</p>
                  </div>
                )}

                {/* Disclaimer */}
                <p className="text-[10px] text-caption mt-3 italic">
                  * Estimates based on {result.inputs.automation_pct}% automation coverage, {result.inputs.manual_hours_per_transaction}h/transaction, ₹{result.inputs.cost_per_fte_annual_lakh}L FTE cost. Actual benefits will vary by implementation scope.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Super Agent Card ───────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: SuperAgent
  color: string
  sessionId: string
  defaultOpen?: boolean
}

function SuperAgentCard({ agent, color, sessionId, defaultOpen = false }: AgentCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [showCalc, setShowCalc] = useState(false)

  const hex = `#${color}`

  return (
    <div className="border border-bg-secondary rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-secondary/30 transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-2 mt-1.5 self-stretch rounded-full"
            style={{ backgroundColor: hex }}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-dark leading-tight">{agent.name}</p>
            <p className="text-xs text-caption mt-0.5 line-clamp-2 leading-relaxed">{agent.description}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-caption">Complexity:</span>
              <ComplexityBadge value={agent.complexity} />
              <span className="text-[10px] text-caption ml-1">Performed by:</span>
              <PerformedByBadge value={agent.performed_by} />
              <span className="text-[10px] bg-brand-purple/10 text-brand-purple border border-brand-purple/20 font-semibold px-1.5 py-0.5 rounded ml-1">
                {agent.fte_automation_pct}% automation
              </span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-2">
          {open ? <ChevronUp size={14} className="text-caption" /> : <ChevronDown size={14} className="text-caption" />}
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-bg-secondary pt-3 space-y-3">
              {/* Utility agents */}
              <div>
                <p className="text-[10px] font-bold text-caption uppercase tracking-wide mb-1.5">
                  Utility Agents ({agent.utility_agents.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.utility_agents.map(ua => (
                    <span
                      key={ua}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                      style={{ backgroundColor: `${hex}15`, borderColor: `${hex}40`, color: hex }}
                    >
                      {ua}
                    </span>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              {agent.kpis.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-caption uppercase tracking-wide mb-1.5">Key KPIs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.kpis.map(kpi => (
                      <span key={kpi} className="text-[10px] bg-bg-secondary text-brand-dark font-medium px-2 py-0.5 rounded border border-bg-secondary">
                        {kpi}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Edge */}
              {agent.edge && (
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">Competitive Edge</p>
                  <p className="text-xs text-amber-900 leading-relaxed">{agent.edge}</p>
                </div>
              )}

              {/* Business case toggle */}
              <button
                onClick={() => setShowCalc(v => !v)}
                className="flex items-center gap-1.5 text-xs text-brand-purple hover:text-brand-dark font-semibold transition-colors"
              >
                <Calculator size={12} />
                {showCalc ? 'Hide Business Case' : 'Build Business Case'}
                {showCalc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              <AnimatePresence>
                {showCalc && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <BusinessCaseCalculator agent={agent} sessionId={sessionId} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── L1 Process Group ───────────────────────────────────────────────────────────

interface ProcessGroupProps {
  uc: UseCase
  sessionId: string
}

function ProcessGroup({ uc, sessionId }: ProcessGroupProps) {
  const IconComponent = ICON_MAP[uc.icon] || Cpu
  const hex = `#${uc.color}`

  return (
    <div className="acc-card p-0 overflow-hidden">
      {/* Process header */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ backgroundColor: `${hex}18`, borderBottom: `2px solid ${hex}40` }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: hex }}
        >
          <IconComponent size={15} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: hex }}>{uc.l1_process}</p>
          <p className="text-[10px] text-caption">
            {uc.super_agents.length} super agent{uc.super_agents.length !== 1 ? 's' : ''} · {uc.super_agents.reduce((s, a) => s + a.utility_agents.length, 0)} utility agents
          </p>
        </div>
      </div>

      {/* Agent cards */}
      <div className="p-4 space-y-3">
        {uc.super_agents.map(agent => (
          <SuperAgentCard
            key={agent.name}
            agent={agent}
            color={uc.color}
            sessionId={sessionId}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Tab Component ────────────────────────────────────────────────────────

interface AiUsecasesTabProps {
  sessionId: string
}

export default function AiUsecasesTab({ sessionId }: AiUsecasesTabProps) {
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeProcess, setActiveProcess] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/ai-usecases')
      .then(r => r.json())
      .then(data => setCatalogue(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-brand-purple" />
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
  )

  if (!catalogue) return null

  const filteredUsecases = activeProcess
    ? catalogue.usecases.filter(uc => uc.l1_process === activeProcess)
    : catalogue.usecases

  // Deduplicate L1 processes (some share the same process)
  const l1Processes = Array.from(new Set(catalogue.usecases.map(uc => uc.l1_process)))

  return (
    <div className="space-y-5">
      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'L1 Processes', value: l1Processes.length, sub: 'S2P coverage', color: 'text-brand-purple' },
          { label: 'Super Agents', value: catalogue.usecases.reduce((s, uc) => s + uc.super_agents.length, 0), sub: 'orchestrating agents', color: 'text-indigo-700' },
          { label: 'Utility Agents', value: catalogue.total_agents, sub: 'specialist agents', color: 'text-blue-700' },
          { label: 'Avg Automation', value: `${Math.round(catalogue.usecases.flatMap(uc => uc.super_agents).reduce((s, a) => s + a.fte_automation_pct, 0) / catalogue.usecases.flatMap(uc => uc.super_agents).length)}%`, sub: 'FTE effort reduction', color: 'text-teal-700' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="acc-card py-3 px-4 text-center">
            <p className={cn('text-2xl font-black', color)}>{value}</p>
            <p className="text-xs font-semibold text-brand-dark">{label}</p>
            <p className="text-[10px] text-caption">{sub}</p>
          </div>
        ))}
      </div>

      {/* Process filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveProcess(null)}
          className={cn(
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            activeProcess === null
              ? 'bg-brand-purple text-white border-brand-purple'
              : 'text-caption border-bg-secondary hover:border-brand-purple hover:text-brand-purple',
          )}
        >
          All Processes
        </button>
        {l1Processes.map(proc => {
          const uc = catalogue.usecases.find(u => u.l1_process === proc)
          const hex = uc ? `#${uc.color}` : '#A100FF'
          const isActive = activeProcess === proc
          return (
            <button
              key={proc}
              onClick={() => setActiveProcess(proc === activeProcess ? null : proc)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
              style={isActive
                ? { backgroundColor: hex, color: 'white', borderColor: hex }
                : { color: hex, borderColor: `${hex}60`, backgroundColor: `${hex}10` }
              }
            >
              {proc}
            </button>
          )
        })}
      </div>

      {/* Use-case groups */}
      <div className="space-y-4">
        {filteredUsecases.map(uc => (
          <ProcessGroup key={uc.id} uc={uc} sessionId={sessionId} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-caption text-center pb-2">
        Business case figures are indicative estimates based on industry benchmarks. Actual outcomes depend on client-specific volumes and implementation scope.
      </p>
    </div>
  )
}
```

---
## frontend/src/components/results/OfferingsTab.tsx (Part 1 of 2 — lines 1–1750)

```tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, ChevronDown, ChevronRight as ChevronRightIcon, Building2, GitBranch, DollarSign, Cpu, Users2, GraduationCap, Sparkles, RefreshCw, ChevronUp, Clock, Construction, type LucideIcon } from 'lucide-react'
import AiUsecasesTab from '@/components/results/AiUsecasesTab'
import AiInsightsMini from '@/components/results/AiInsightsMini'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  Tooltip as RechartsTooltip,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import { api } from '@/lib/api'
import { cn, formatCr, formatIndianInt } from '@/lib/utils'
import type {
  KPIAssessmentResult, Engagement, OrgRecommendation, ValueTreeData, CategoryChannel,
  BuyingChannelData, BuyingChannelRow, BuyingChannelSlider, DimensionResult,
} from '@/lib/types'

// ── Offerings catalogue ───────────────────────────────────────────────────────

// Lucide icon map per offering id
const OFFERING_ICONS: Record<string, LucideIcon> = {
  op_model:           Building2,
  process:            GitBranch,
  category_offering:  DollarSign,
  cost_takeout:       DollarSign,
  tech:               Cpu,
  srm:                Users2,
  capability:         GraduationCap,
}

const OFFERINGS: Array<{
  id: string
  icon: string
  title: string
  timeline: string
  desc: string
  triggerKpis: string[]
  benefits: string[]
  isPlaceholder?: boolean
}> = [
  {
    id: 'op_model',
    icon: '🏢',
    title: 'Organisation Structure & Operating Model',
    timeline: '3 months',
    desc: 'Right-size and re-design procurement organisation for category focus and efficiency',
    triggerKpis: ['pr_to_po_cycle', 'spend_under_mgmt', 'tat', 'spend_per_fte'],
    benefits: [
      '15–25% improvement in Spend per FTE through right-sized org design',
      'Faster decisions via simplified DoP and reduced approval layers',
      'Category-focused structure with Lead Buyers and Category Councils',
      'KRA-driven governance cadence for procurement accountability',
    ],
  },
  {
    id: 'process',
    icon: '🔄',
    title: 'Process Design & Optimisation',
    timeline: '3 months',
    desc: 'To-Be S2P process flows with controls, RACI and buying channel routing',
    triggerKpis: ['pr_to_po_cycle', 'po_compliance', 'three_way_match', 'tat', 'rc_adoption'],
    benefits: [
      '30–50% TAT reduction through streamlined PR-to-PO workflows',
      'Higher compliance via system-enforced buying channel routing per category',
      'Reduced emergency procurement through structured category governance',
      'Structured payment KPI tracking → improved vendor delivery reliability',
    ],
  },
  {
    id: 'category_offering',
    icon: '💰',
    title: 'Category Offering',
    timeline: '3 months',
    desc: 'Buying channel framework, category mix optimisation and channel-wise TAT modelling by material group',
    triggerKpis: ['savings_lpo', 'rc_coverage', 'rc_adoption', 'pac_prs'],
    benefits: [
      '2–5% incremental savings through structured negotiation and category strategies',
      '40–60% RC coverage improvement — from spot to rate contracts',
      'Volume consolidation by category → stronger pricing leverage',
      'Buying channel policy (RC / ASL / RFQ) reduces spot procurement incidence',
    ],
  },
  {
    id: 'cost_takeout',
    icon: '📊',
    title: 'Cost Takeout',
    timeline: '3–6 months',
    desc: 'Structured cost takeout programme — spend analytics, should-cost modelling and savings tracking',
    triggerKpis: [],
    benefits: [],
    isPlaceholder: true,
  },
  {
    id: 'tech',
    icon: '🤖',
    title: 'Technology, Digital & AI',
    timeline: '6 months',
    desc: 'Agentic AI across the S2P process — from PR validation to PO award',
    triggerKpis: ['pr_to_po_cycle', 'sourcing_tool', 'savings_lpo', 'tat', 'rc_adoption', 'pac_prs'],
    benefits: [
      '40–60% of transactional activities automated via Agentic AI (PR validation, LPO fetch, PO creation)',
      'AI-assisted negotiation → 1–3% additional savings from better buyer preparation',
      'Real-time spend dashboards with AI-driven root cause insights',
      'System-based LPO deviation checks and compliance monitoring',
    ],
  },
  {
    id: 'srm',
    icon: '🤝',
    title: 'Supplier Relationship Management',
    timeline: '3 months',
    desc: 'SRM operating model, vendor scorecards and supplier development programme',
    triggerKpis: ['otd', 'defect_rate', 'pac_prs'],
    benefits: [
      '15–20% improvement in On-time Delivery through vendor scorecards and performance clauses',
      'Approved Supplier List reduces TAT for vendor shortlisting by 60–70%',
      'Reduced single-source risk through structured vendor development and diversification',
      'Stronger vendor relationships via timely payments and engagement programmes',
    ],
  },
  {
    id: 'capability',
    icon: '🎓',
    title: 'Capability Development',
    timeline: '1 month',
    desc: 'Competency QRE, training roadmaps and category intelligence workbooks',
    triggerKpis: ['tat', 'savings_lpo', 'sourcing_tool'],
    benefits: [
      'Procurement workforce equipped with right skills for category management and negotiation',
      'Category intelligence workbooks → buyers enter negotiations with market data',
      'Structured on-boarding halves ramp-up time for new recruits',
      'KRA-aligned training roadmaps drive measurable improvement in team productivity',
    ],
  },
]

// ── Z-Curve agent data ────────────────────────────────────────────────────────

const ZCURVE_PHASES = [
  {
    name: 'Supplier Onboarding & Master Data',
    agents: [
      { name: 'Smart Vendor Onboarding', bold: true, desc: 'Guides suppliers through registration, validates details, checks duplicity, qualifies vendors using external sources' },
      { name: 'Master Data Management Engine', bold: false, desc: 'Converts free-text material descriptions to standardised master data with duplicate detection and intelligent categorisation' },
    ],
  },
  {
    name: 'Procurement Planning',
    agents: [
      { name: 'Demand Prediction Agent', bold: false, desc: 'Predicts forward-looking procurement demand using PR history, consumption, production plans, market signals' },
      { name: 'Purchase Planning Agent', bold: false, desc: 'Ingests demand forecasts, creates optimised purchase plans with best-fit vendor allocation' },
      { name: 'PR Quality Assurance Agent', bold: false, desc: 'Validates PRs for material codes, inventory levels, SOW compliance, purchasing group, supplier data' },
    ],
  },
  {
    name: 'Vendor Identification & RFX',
    agents: [
      { name: 'Vendor Discovery Agent', bold: true, desc: 'Discovers vendors through internal intelligence mining with AI-driven ranking' },
      { name: 'PR Consolidation Agent', bold: true, desc: 'Analyses released PRs for consolidation, groups similar items using LLM, generates consolidated RFQs' },
      { name: 'Requisition Prioritization Agent', bold: false, desc: 'Analyses PRs vs inventory to determine priority, alerts buyers to urgent PRs' },
      { name: 'Bid Clarification Agent', bold: false, desc: 'Monitors vendor queries during auctions, synthesises data from RFx and historical Q&As' },
      { name: 'Intelligent RFx Creation Agent', bold: false, desc: 'Shortlists vendors, determines buying channel, populates RFx, manages floating to vendors' },
    ],
  },
  {
    name: 'Tech & Commercial Evaluation',
    agents: [
      { name: 'Smart TE Assistant', bold: false, desc: 'Validates supplier technical responses vs specs, applies scoring logic, aggregates into TE reports' },
      { name: 'Buyer Negotiation Copilot', bold: true, desc: 'Real-time negotiation intelligence, insights briefs, learns from negotiation outcomes' },
      { name: 'Pricing Engine', bold: false, desc: 'Calculates should-cost for materials/services based on cost drivers, supports negotiation' },
      { name: 'Category Workbook Agent', bold: true, desc: 'Automates category workbook creation — data ingestion, framework application, roadmap generation' },
      { name: 'Low Value Autonomous Agent', bold: false, desc: 'Fully automates negotiation for low-value items with counter-offer functionality' },
      { name: 'Auction Strategy Agent', bold: false, desc: 'Analyses bidder patterns, recommends optimal auction format, real-time advisory during live auctions' },
      { name: 'Award Recommendation Engine', bold: false, desc: 'Consolidates commercial + technical data, calculates optimal award scenarios, automates DoP routing' },
    ],
  },
  {
    name: 'NFA & PO Creation',
    agents: [
      { name: 'NFA Creation & Approver Assistant', bold: false, desc: 'Automates NFA document compilation, provides chat-based approver assistance' },
      { name: 'DoA Recommendation Agent', bold: false, desc: 'Analyses purchase requests, validates compliance, determines optimal approval routing' },
      { name: 'PO Terms Validation Agent', bold: false, desc: 'Extracts critical terms from PO text, validates against codified fields' },
      { name: 'Automated PO Expeditor', bold: false, desc: 'Monitors PO progress, sends supplier reminders, flags potential delays' },
    ],
  },
]

// ── Capability QRE skills ─────────────────────────────────────────────────────

const QRE_SKILLS = [
  { id: 'sourcing_strategy', category: 'Strategic', name: 'Sourcing Strategy & Category Management', sample: 3 },
  { id: 'negotiation', category: 'Strategic', name: 'Negotiation & Commercial Acumen', sample: 2 },
  { id: 'market_intel', category: 'Strategic', name: 'Market Intelligence & Benchmarking', sample: 2 },
  { id: 'stakeholder_mgmt', category: 'Strategic', name: 'Stakeholder & Change Management', sample: 3 },
  { id: 'spend_analytics', category: 'Analytics', name: 'Spend Analytics & Data Interpretation', sample: 2 },
  { id: 'should_cost', category: 'Analytics', name: 'Should-Cost Modelling', sample: 1 },
  { id: 'supplier_risk', category: 'Analytics', name: 'Supplier Risk Assessment', sample: 2 },
  { id: 'sap_ariba', category: 'Technology', name: 'SAP / ARIBA Proficiency', sample: 3 },
  { id: 'e_auction', category: 'Technology', name: 'e-Auction & RFx Management', sample: 2 },
  { id: 'ai_tools', category: 'Technology', name: 'AI Tools & Digital Literacy', sample: 1 },
  { id: 'contract_mgmt', category: 'Compliance', name: 'Contract Drafting & Management', sample: 3 },
  { id: 'compliance_ethics', category: 'Compliance', name: 'Compliance, Ethics & DoP', sample: 4 },
  { id: 'srm', category: 'Supplier', name: 'Supplier Relationship Management', sample: 2 },
  { id: 'vendor_dev', category: 'Supplier', name: 'Vendor Development & Onboarding', sample: 2 },
  { id: 'sustainability', category: 'Supplier', name: 'Sustainability & ESG Sourcing', sample: 1 },
]

const RATING_LABELS: Record<number, string> = {
  1: 'Foundational', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Expert',
}

const QRE_CATEGORY_COLORS: Record<string, string> = {
  Strategic: '#a100ff',
  Analytics: '#1d4ed8',
  Technology: '#0891b2',
  Compliance: '#16a34a',
  Supplier: '#ea580c',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTriggered(
  offering: typeof OFFERINGS[0],
  kpiResults: Record<string, { has_gap: boolean }> | undefined,
): boolean {
  if (!kpiResults) return false
  return offering.triggerKpis.some(k => kpiResults[k]?.has_gap === true)
}

function IframeViewer({ html, height, title }: { html: string; height: number; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      className="w-full rounded border border-bg-secondary"
      style={{ height }}
    />
  )
}

function AgentTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {children}
      {hovered && (
        <div className="absolute z-50 bg-brand-dark text-white text-xs rounded shadow-xl px-3 py-2 w-60 bottom-full left-0 mb-1.5 leading-relaxed pointer-events-none" style={{ whiteSpace: 'normal' }}>
          {text}
          <div className="absolute top-full left-4 border-4 border-transparent border-t-brand-dark" />
        </div>
      )}
    </div>
  )
}

// ── O1: Operating Model Panel ─────────────────────────────────────────────────

const ORG_CONSTRUCTS = ['Centralised', 'Centre-Led', 'Hybrid', 'Decentralised']
const CONSTRUCT_NOTES: Record<string, string> = {
  Centralised: 'All procurement decisions made centrally. Strong compliance and economies of scale. Risk: less business unit flexibility.',
  'Centre-Led': 'Central strategy + standards, local execution. Best balance for most mid-size enterprises.',
  Hybrid: 'Mixed model — strategic spends centralised, routine spends decentralised by BU.',
  Decentralised: 'Business units own procurement. High agility, lower economies of scale.',
}

function OpModelPanel({ sessionId, fte }: { sessionId: string; fte: number }) {
  const [construct, setConstruct] = useState('Centre-Led')
  const [html, setHtml] = useState<string | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(false)
  const [recommendation, setRecommendation] = useState<OrgRecommendation | null>(null)
  const [loadingRec, setLoadingRec] = useState(true)

  useEffect(() => {
    api.getOrgRecommendation(sessionId)
      .then(r => { setRecommendation(r); setConstruct(r.recommended) })
      .catch(() => {})
      .finally(() => setLoadingRec(false))
  }, [sessionId])

  const loadOrg = async (model: string) => {
    setLoadingOrg(true)
    try {
      const suggestedFte = recommendation?.suggested_fte ?? fte
      const { html: h } = await api.getOrganogram(sessionId, model, suggestedFte)
      setHtml(h)
    } catch {}
    finally { setLoadingOrg(false) }
  }

  useEffect(() => {
    if (recommendation && !html) loadOrg(recommendation.recommended)
  }, [recommendation])

  return (
    <div>
      {loadingRec ? (
        <div className="flex items-center gap-2 text-xs text-caption py-2">
          <Loader2 size={12} className="animate-spin text-brand-purple" /> Analysing data signals…
        </div>
      ) : recommendation ? (
        <div className="mb-4 p-3 bg-purple-50 border border-brand-purple/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-brand-dark uppercase tracking-wide">Recommended</span>
            <span className="bg-brand-purple text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{recommendation.recommended}</span>
            <span className="text-[10px] text-caption ml-auto">Suggested FTE: {recommendation.suggested_fte}</span>
          </div>
          <p className="text-xs text-brand-dark leading-relaxed mb-2">{recommendation.rationale}</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendation.signals.map((s, i) => (
              <span key={i} className="text-[10px] bg-white border border-bg-secondary rounded px-1.5 py-0.5 text-caption">
                {s.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 mb-3">
        <select
          value={construct}
          onChange={e => setConstruct(e.target.value)}
          className="text-xs border border-bg-secondary rounded px-2 py-1.5 focus:outline-none focus:border-brand-purple"
        >
          {ORG_CONSTRUCTS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => loadOrg(construct)}
          className="flex items-center gap-1.5 text-xs bg-brand-purple text-white px-3 py-1.5 rounded hover:bg-brand-dark transition-colors"
        >
          {loadingOrg ? <Loader2 size={12} className="animate-spin" /> : null}
          Generate Organogram
        </button>
      </div>

      {html
        ? <IframeViewer html={html} height={420} title="Organogram" />
        : !loadingOrg && <p className="text-caption text-xs py-4">Select a construct and click Generate.</p>
      }

      {construct && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-brand-dark border border-bg-secondary">
          <p>{CONSTRUCT_NOTES[construct]}</p>
        </div>
      )}
    </div>
  )
}

// ── O2: Process Design Panel — redesigned ─────────────────────────────────────

interface ProcessNode {
  pid: string
  name: string
  description: string
  process_type: string
  responsible: string
  accountable: string
  consulted: string
  informed: string
  input: string
  output: string
  decision_point: string
  system_tool: string
  system_checks: string
  compliance_checks: string
  gaps: string
  level: number
  children: ProcessNode[]
}

// RACI role color map
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  REQ: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Requester' },
  BUY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Buyer' },
  TEC: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Technical' },
  MGR: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Manager' },
  CPO: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'CPO' },
  FIN: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Finance' },
  AUD: { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200',   label: 'Audit' },
  SUP: { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   label: 'Supplier' },
  SYS: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'System' },
}

// Route type config
const ROUTE_CONFIG: Record<string, { bg: string; text: string; border: string; desc: string }> = {
  ALL: { bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300',    desc: 'All procurement routes' },
  RFX: { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300',  desc: 'Full RFQ/RFP process (≥3 vendors)' },
  RC:  { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300',   desc: 'Rate Contract / auto-PO route' },
  ASL: { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    desc: 'Approved Supplier List route' },
}

function RaciBadge({ role, letter, title }: { role: string; letter: string; title: string }) {
  const [hovered, setHovered] = useState(false)
  if (!role) return null
  const roles = role.split(/[,/\s]+/).map(r => r.trim().toUpperCase()).filter(Boolean)
  return (
    <div className="relative inline-flex items-center gap-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {roles.slice(0, 3).map(r => {
        const cfg = ROLE_COLORS[r] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', label: r }
        return (
          <span key={r} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', cfg.bg, cfg.text, cfg.border)}>
            {r}
          </span>
        )
      })}
      {hovered && (
        <div className="absolute z-50 bottom-full left-0 mb-1 bg-brand-dark text-white text-[11px] rounded px-2 py-1 whitespace-nowrap pointer-events-none shadow-xl">
          {title}: {role}
        </div>
      )}
    </div>
  )
}

function RouteTypeBadge({ type }: { type: string }) {
  const [hovered, setHovered] = useState(false)
  const types = (type || 'ALL').split(/[,/\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean)
  return (
    <div className="relative inline-flex gap-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {types.map(t => {
        const cfg = ROUTE_CONFIG[t] ?? ROUTE_CONFIG.ALL
        return (
          <span key={t} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', cfg.bg, cfg.text, cfg.border)}>
            {t}
          </span>
        )
      })}
      {hovered && types[0] && (
        <div className="absolute z-50 bottom-full left-0 mb-1 bg-brand-dark text-white text-[11px] rounded px-2 py-1 whitespace-nowrap pointer-events-none shadow-xl">
          {(ROUTE_CONFIG[types[0]] ?? ROUTE_CONFIG.ALL).desc}
        </div>
      )}
    </div>
  )
}

// L4/L5 activity row (compact)
function L4Row({ node, depth }: { node: ProcessNode; depth: number }) {
  const [expanded, setExpanded] = useState(false)
  const [tooltip, setTooltip] = useState(false)
  const hasChildren = node.children?.length > 0

  return (
    <div>
      <div
        className={cn(
          'relative flex items-start gap-2 py-2 px-3 text-xs rounded transition-colors select-none',
          hasChildren ? 'cursor-pointer hover:bg-gray-100/80' : 'cursor-default',
          depth === 0 ? 'bg-gray-50/50' : 'bg-white/50',
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => hasChildren && setExpanded(e => !e)}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
      >
        {/* expand/collapse */}
        <div className="w-4 flex-shrink-0 pt-0.5">
          {hasChildren ? (
            expanded
              ? <ChevronDown size={12} className="text-brand-purple" />
              : <ChevronRightIcon size={12} className="text-brand-purple" />
          ) : (
            <span className="block w-1 h-1 rounded-full bg-gray-300 mt-1.5 ml-1.5" />
          )}
        </div>
        {/* PID */}
        <span className="font-mono text-[10px] text-caption w-14 flex-shrink-0 pt-0.5">{node.pid}</span>
        {/* Name */}
        <span className="flex-1 font-medium text-gray-700 leading-tight">{node.name}</span>
        {/* Route type badge */}
        {node.process_type && node.process_type !== 'ALL' && (
          <RouteTypeBadge type={node.process_type} />
        )}
        {/* Responsible */}
        {node.responsible && (
          <RaciBadge role={node.responsible} letter="R" title="Responsible" />
        )}
        {/* Indicator icons */}
        <div className="flex gap-1 flex-shrink-0">
          {node.decision_point && <span title={node.decision_point} className="text-amber-500 text-xs">⚡</span>}
          {node.system_tool && <span title={node.system_tool} className="text-blue-400 text-xs">🖥</span>}
          {node.compliance_checks && <span title={node.compliance_checks} className="text-green-500 text-xs">✓</span>}
          {node.gaps && <span title={node.gaps} className="text-red-400 text-xs">⚠</span>}
        </div>
        {/* Tooltip */}
        {tooltip && (node.description || node.input || node.output) && (
          <div className="absolute z-50 bg-brand-dark text-white rounded-lg shadow-2xl px-3 py-2.5 w-72 left-16 bottom-full mb-1 text-xs leading-relaxed pointer-events-none" style={{ whiteSpace: 'normal' }}>
            {node.description && <p className="text-white/90 mb-1">{node.description}</p>}
            {node.input && <p className="text-blue-300 text-[10px]">← {node.input}</p>}
            {node.output && <p className="text-green-300 text-[10px]">→ {node.output}</p>}
          </div>
        )}
      </div>
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <L4Row key={child.pid} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// L3 sub-process card
function L3Card({ node }: { node: ProcessNode }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children?.length > 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* L3 header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none transition-colors',
          'bg-white hover:bg-bg-secondary/40',
        )}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        {/* Expand */}
        <div className="w-4 flex-shrink-0">
          {hasChildren ? (
            expanded
              ? <ChevronDown size={13} className="text-brand-purple" />
              : <ChevronRightIcon size={13} className="text-brand-purple" />
          ) : (
            <span className="block w-1.5 h-1.5 rounded-full bg-gray-300 ml-1" />
          )}
        </div>

        {/* PID */}
        <span className="font-mono text-[10px] text-caption w-10 flex-shrink-0">{node.pid}</span>

        {/* Name */}
        <span className="flex-1 text-sm font-semibold text-brand-dark leading-tight">{node.name}</span>

        {/* Route badge */}
        <RouteTypeBadge type={node.process_type || 'ALL'} />

        {/* RACI badges */}
        <div className="flex gap-1 flex-shrink-0 items-center">
          {node.responsible && <RaciBadge role={node.responsible} letter="R" title="Responsible" />}
          {node.accountable && <RaciBadge role={node.accountable} letter="A" title="Accountable" />}
        </div>

        {/* Meta icons */}
        <div className="flex gap-1 flex-shrink-0 items-center">
          {node.decision_point && <span title={node.decision_point} className="text-amber-500 text-sm">⚡</span>}
          {node.system_tool && <span title={node.system_tool} className="text-blue-400 text-sm">🖥</span>}
          {node.compliance_checks && <span title={node.compliance_checks} className="text-green-500 text-sm">✓</span>}
          {node.gaps && <span title={node.gaps} className="text-red-400 text-sm">⚠</span>}
        </div>

        {hasChildren && (
          <span className="text-[10px] text-caption font-mono ml-1">{node.children.length}</span>
        )}
      </div>

      {/* L3 description row */}
      {node.description && !expanded && (
        <div className="px-4 pb-2 ml-6">
          <p className="text-[11px] text-caption leading-relaxed">{node.description}</p>
        </div>
      )}

      {/* L4/L5 children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="relative">
              {node.description && (
                <p className="text-[11px] text-caption leading-relaxed px-4 py-2 bg-gray-50/50">{node.description}</p>
              )}
              {node.children.map(child => (
                <L4Row key={child.pid} node={child} depth={0} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProcessDesignPanel({ sessionId }: { sessionId: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [maximized, setMaximized] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setHtml(null)
    api.getSwimlaneInteractive(sessionId)
      .then(d => setHtml(d.html || null))
      .catch(() => setHtml(null))
      .finally(() => setLoading(false))
  }, [sessionId, refreshKey])

  return (
    <>
      {/* ── Swimlane card ── */}
      <div className={cn(
        'border border-gray-200 rounded-xl overflow-hidden shadow-sm',
        maximized && 'fixed inset-4 z-50 shadow-2xl',
      )}>
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-brand-dark">
          <div>
            <span className="text-white text-sm font-bold">S2P Process Swimlane</span>
            <span className="text-white/60 text-xs ml-3">Click any phase to expand · Click any node for details</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-white border border-white/20 hover:border-white/50 px-2.5 py-1 rounded transition-colors"
              title="Reload swimlane"
              disabled={loading}
            >
              {loading ? '⏳' : '↺'} Reload
            </button>
            <button
              onClick={() => setMaximized(m => !m)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/50 px-2.5 py-1 rounded transition-colors"
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? '⊟ Restore' : '⊞ Maximize'}
            </button>
          </div>
        </div>

        {/* iframe body */}
        {loading && (
          <div className="flex items-center gap-2 justify-center bg-white" style={{ height: maximized ? 'calc(100vh - 120px)' : 540 }}>
            <Loader2 size={18} className="animate-spin text-brand-purple" />
            <span className="text-xs text-caption">Loading swimlane from Excel…</span>
          </div>
        )}
        {!loading && !html && (
          <div className="flex items-center justify-center bg-white" style={{ height: maximized ? 'calc(100vh - 120px)' : 540 }}>
            <p className="text-caption text-xs text-center px-8">
              Process data not found. Ensure the Excel file is at:<br />
              <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded mt-1 inline-block">
                Assessment App v2\Process file\S2P_Process_L1_L5_RACI.xlsx
              </code>
            </p>
          </div>
        )}
        {!loading && html && (
          <iframe
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            className="w-full border-none block bg-white"
            style={{ height: maximized ? 'calc(100vh - 120px)' : 560 }}
            title="S2P Interactive Swimlane"
          />
        )}
      </div>

      {/* Backdrop for maximized mode */}
      {maximized && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setMaximized(false)}
        />
      )}
    </>
  )
}

// ── O3: Cost Takeout Panel ────────────────────────────────────────────────────

// Classification signals used by the engine
const CLASSIFICATION_PRIORITIES = [
  {
    id: 'P1',
    label: 'Priority 1 — Item Category Code',
    desc: 'Reads the SAP Item_Category field directly — highest-confidence signal, set at PO creation',
    cardBg:    'border-brand-purple bg-purple-50',
    circleBg:  'bg-brand-purple',
    connector: 'No SAP Item_Category field',
    checks: [
      { signal: 'Item_Category = "A"', result: 'CAPEX', color: 'text-red-700' },
      { signal: 'Item_Category = "D"', result: 'SERVICE', color: 'text-teal-700' },
    ],
  },
  {
    id: 'P2',
    label: 'Priority 2 — Material Type (MTART)',
    desc: 'Uses the SAP Material Type field — maps directly to procurement archetype',
    cardBg:    'border-blue-300 bg-blue-50',
    circleBg:  'bg-blue-600',
    connector: 'No matching MTART code',
    checks: [
      { signal: 'MTART = DIEN', result: 'SERVICE', color: 'text-teal-700' },
      { signal: 'MTART = ANLZ / FHMI', result: 'CAPEX', color: 'text-red-700' },
      { signal: 'MTART = ERSA / ERSZ / NLAG', result: 'INDIRECT', color: 'text-purple-700' },
    ],
  },
  {
    id: 'P3',
    label: 'Priority 3 — Purchase Frequency',
    desc: 'Items bought across 3+ distinct calendar months are recurring operational requirements — best served by a running contract regardless of description',
    cardBg:    'border-teal-300 bg-teal-50',
    circleBg:  'bg-teal-600',
    connector: 'Bought in < 3 distinct months (infrequent)',
    checks: [
      { signal: 'Distinct PO months in data ≥ 3', result: 'INDIRECT → RC candidate', color: 'text-teal-700' },
    ],
  },
  {
    id: 'P4',
    label: 'Priority 4 — Description Keyword Matching',
    desc: 'Scans line-item description text for domain-specific keywords when no SAP field signal exists',
    cardBg:    'border-amber-300 bg-amber-50',
    circleBg:  'bg-amber-500',
    connector: 'No keyword matched',
    checks: [
      { signal: 'Coal, Iron Ore, Diesel, Limestone, Pellets…', result: 'BULK', color: 'text-amber-700' },
      { signal: 'Refractory, Ferro Alloys, Work Roll, Electrode…', result: 'DIRECT', color: 'text-blue-700' },
      { signal: 'Civil, Labour, Housekeeping, Transport, AMC…', result: 'SERVICE', color: 'text-teal-700' },
      { signal: 'Spare, Motor, Pump, Valve, Cable, PPE…', result: 'INDIRECT', color: 'text-purple-700' },
    ],
  },
  {
    id: 'P5',
    label: 'Priority 5 — Unclassified Fallback',
    desc: 'No signal matched — defaults to open RFQ. Review annually; items with spend ≥2% or frequency ≥3×/year should migrate to a contract channel.',
    cardBg:    'border-gray-300 bg-gray-50',
    circleBg:  'bg-gray-500',
    connector: '',
    checks: [
      { signal: 'No match in P1–P4', result: 'UNCLASSIFIED → RFQ', color: 'text-gray-500' },
    ],
  },
]

// Archetype outcomes with channel, TAT and typical spend categories
const ARCHETYPE_OUTCOMES = [
  {
    name: 'BULK',
    icon: '🏗️',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    headerBg: 'bg-amber-500',
    textColor: 'text-amber-900',
    tatColor: 'bg-amber-500',
    channel: 'RC — Long-Term Contract',
    channelNote: 'Volume-linked pricing; auto-PO on trigger',
    tat: '3 days',
    categories: ['Coal', 'Iron Ore', 'Limestone', 'Diesel', 'Coke', 'Pellets', 'Scrap'],
    strategy: 'Anchor pricing annually. Use e-auction for competitive rate discovery.',
  },
  {
    name: 'DIRECT',
    icon: '⚙️',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    headerBg: 'bg-blue-600',
    textColor: 'text-blue-900',
    tatColor: 'bg-blue-600',
    channel: 'ASL / Single Tender',
    channelNote: 'ASL for multi-source; Single Tender for sole-source items',
    tat: '15–25 days',
    categories: ['Refractory Bricks', 'Ferro Alloys', 'Work Rolls', 'Electrodes', 'Flux', 'Castings'],
    strategy: 'Qualify ≥2 suppliers per category. Reduce single-source dependency over time.',
  },
  {
    name: 'INDIRECT',
    icon: '🔧',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    headerBg: 'bg-brand-purple',
    textColor: 'text-purple-900',
    tatColor: 'bg-brand-purple',
    channel: 'RC — Catalogue / ROP',
    channelNote: 'Blanket orders, reorder-point triggers, e-catalogue',
    tat: '5–7 days',
    categories: ['Spare Parts', 'Motors & Pumps', 'Valves', 'Cables', 'PPE', 'Lubricants', 'Stationery'],
    strategy: 'Consolidate MRO vendors. Deploy catalogue for high-frequency low-value items.',
  },
  {
    name: 'CAPEX',
    icon: '🏭',
    bg: 'bg-red-50',
    border: 'border-red-300',
    headerBg: 'bg-red-600',
    textColor: 'text-red-900',
    tatColor: 'bg-red-600',
    channel: 'RFQ / Open Tender',
    channelNote: 'Competitive bidding; CapEx committee approval required',
    tat: '45–60 days',
    categories: ['Plant Machinery', 'Vehicles & Equipment', 'IT Infrastructure', 'Civil Construction', 'Cranes & Hoists'],
    strategy: 'Pre-qualify vendors. Use two-envelope tendering for large CapEx packages.',
  },
  {
    name: 'SERVICE',
    icon: '🤝',
    bg: 'bg-teal-50',
    border: 'border-teal-300',
    headerBg: 'bg-teal-600',
    textColor: 'text-teal-900',
    tatColor: 'bg-teal-600',
    channel: 'Outline Agreement (AMC)',
    channelNote: 'Annual maintenance contracts; milestone-linked payments',
    tat: '7–15 days',
    categories: ['Civil & Construction', 'Labour Supply', 'Housekeeping', 'Transport & Logistics', 'IT Support', 'Security'],
    strategy: 'Standardise SOW templates. Annual rate contracts reduce repeat tendering.',
  },
  {
    name: 'UNCLASSIFIED',
    icon: '❓',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    headerBg: 'bg-gray-500',
    textColor: 'text-gray-700',
    tatColor: 'bg-gray-500',
    channel: 'Open RFQ',
    channelNote: 'Manual sourcing; opportunity to reclassify and contract',
    tat: '60–70 days',
    categories: ['Miscellaneous', 'New materials', 'One-time requirements'],
    strategy: 'Analyse annually. Items with spend ≥2% or frequency ≥3×/year should migrate to a contract channel.',
  },
]

function BuyingChannelFlowchart() {
  const [activeArchetype, setActiveArchetype] = useState<string | null>(null)
  const active = ARCHETYPE_OUTCOMES.find(a => a.name === activeArchetype)

  return (
    <div className="space-y-5">
      {/* ── Section intro ── */}
      <div className="p-3 bg-brand-dark/5 border border-brand-dark/15 rounded-lg text-xs text-brand-dark">
        <p className="font-semibold mb-0.5">How is each purchase classified?</p>
        <p className="text-caption leading-relaxed">
          Every Material Group passes through a 5-stage classification engine. Signals are read in priority order — the first match determines the buying archetype and recommended channel. Click any archetype card to see details.
        </p>
      </div>

      {/* ── Classification priority cascade ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-caption mb-2">Classification Priority Cascade</p>
        <div className="flex flex-col gap-0">
          {CLASSIFICATION_PRIORITIES.map((p, idx) => (
            <div key={p.id} className="relative">
              <div className={cn('border rounded-lg p-3', p.cardBg)}>
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white',
                    p.circleBg,
                  )}>{p.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-dark">{p.label}</p>
                    <p className="text-[11px] text-caption mb-1.5">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.checks.map((c, ci) => (
                        <span key={ci} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px]">
                          <span className="text-gray-500 font-mono">{c.signal}</span>
                          <span className="text-gray-400">→</span>
                          <span className={cn('font-bold', c.color)}>{c.result}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {idx < CLASSIFICATION_PRIORITIES.length - 1 && p.connector && (
                <div className="flex justify-start pl-4 py-0.5">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300" />
                    <span className="text-[9px] text-gray-400 font-semibold italic">↓ if {p.connector}</span>
                    <div className="w-px h-3 bg-gray-300" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Archetype outcome cards ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-caption mb-2">Buying Archetypes &amp; Recommended Channels</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ARCHETYPE_OUTCOMES.map(a => (
            <button
              key={a.name}
              onClick={() => setActiveArchetype(prev => prev === a.name ? null : a.name)}
              className={cn(
                'text-left rounded-xl border-2 overflow-hidden transition-all shadow-sm hover:shadow-md',
                a.border,
                activeArchetype === a.name ? 'ring-2 ring-offset-1 ring-brand-purple scale-[1.01]' : ''
              )}
            >
              {/* Card header */}
              <div className={cn('px-3 py-2 flex items-center gap-2', a.headerBg)}>
                <span className="text-base">{a.icon}</span>
                <span className="text-white font-black text-xs tracking-wide">{a.name}</span>
                <span className={cn('ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20')}>{a.tat}</span>
              </div>
              {/* Card body */}
              <div className={cn('px-3 py-2', a.bg)}>
                <p className={cn('text-[10px] font-bold mb-0.5', a.textColor)}>{a.channel}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{a.channelNote}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      <AnimatePresence>
        {active && (
          <motion.div
            key={active.name}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className={cn('rounded-xl border-2 overflow-hidden', active.border)}
          >
            <div className={cn('px-4 py-3 flex items-center gap-3', active.headerBg)}>
              <span className="text-2xl">{active.icon}</span>
              <div>
                <p className="text-white font-black text-sm">{active.name} Archetype</p>
                <p className="text-white/75 text-xs">{active.channel} · Target TAT: {active.tat}</p>
              </div>
            </div>
            <div className={cn('px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-4', active.bg)}>
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-1.5', active.textColor)}>Typical Categories</p>
                <div className="flex flex-wrap gap-1">
                  {active.categories.map(c => (
                    <span key={c} className="bg-white border border-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-1.5', active.textColor)}>Channel Mechanics</p>
                <p className="text-xs text-gray-600 leading-relaxed">{active.channelNote}</p>
              </div>
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-1.5', active.textColor)}>Strategic Lever</p>
                <p className="text-xs text-gray-600 leading-relaxed">{active.strategy}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAT comparison bar ── */}
      <div className="p-3 bg-white border border-gray-200 rounded-lg">
        <p className="text-[11px] font-bold uppercase tracking-wide text-caption mb-2">Target TAT by Archetype</p>
        <div className="space-y-1.5">
          {[
            { name: 'BULK', tat: 3, max: 70, color: '#f59e0b' },
            { name: 'INDIRECT', tat: 6, max: 70, color: '#a100ff' },
            { name: 'SERVICE', tat: 11, max: 70, color: '#0d9488' },
            { name: 'DIRECT', tat: 20, max: 70, color: '#2563eb' },
            { name: 'CAPEX', tat: 52, max: 70, color: '#dc2626' },
            { name: 'UNCLASSIFIED', tat: 65, max: 70, color: '#9ca3af' },
          ].map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-24 flex-shrink-0 text-gray-600">{item.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(item.tat / item.max) * 100}%`, backgroundColor: item.color }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-500 w-12 text-right flex-shrink-0">{item.tat === 6 ? '5–7d' : item.tat === 11 ? '7–15d' : item.tat === 20 ? '15–25d' : item.tat === 52 ? '45–60d' : item.tat === 65 ? '60–70d' : `${item.tat}d`}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-caption mt-2">💡 RC-contracted archetypes (BULK, INDIRECT) achieve 10–20× faster TAT than spot-sourced items. Increasing contract coverage directly compresses cycle time.</p>
      </div>
    </div>
  )
}

// ── Archetype + Channel badge configs ────────────────────────────────────────

const ARCHETYPE_CFG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  BULK:         { bg: 'bg-amber-50',   text: 'text-amber-800',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  DIRECT:       { bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  INDIRECT:     { bg: 'bg-purple-50',  text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-brand-purple' },
  CAPEX:        { bg: 'bg-red-50',     text: 'text-red-800',    border: 'border-red-200',    dot: 'bg-red-400' },
  SERVICE:      { bg: 'bg-teal-50',    text: 'text-teal-800',   border: 'border-teal-200',   dot: 'bg-teal-500' },
  UNCLASSIFIED: { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-400' },
}

const CHANNEL_CFG: Record<string, { bg: string; text: string; border: string }> = {
  'RC (LT Contract)':       { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'RC (Outline Agreement)': { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'RC (ROP/Catalogue)':     { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'Outline Agreement':      { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'ASL':                    { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200' },
  'RFQ':                    { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  'Single Tender':          { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200' },
}

const CONFIDENCE_CFG: Record<string, string> = {
  HIGH:   'text-green-700 font-bold',
  MEDIUM: 'text-amber-600 font-semibold',
  LOW:    'text-gray-400',
}

const CURRENT_CHANNEL_CFG: Record<string, string> = {
  'Largely Contracted (>80%)':    'text-green-700 bg-green-50 border-green-200',
  'Partially Contracted (40–80%)':'text-amber-700 bg-amber-50 border-amber-200',
  'Minimally Contracted (<40%)':  'text-orange-700 bg-orange-50 border-orange-200',
  'Spot / Uncontracted':          'text-red-700 bg-red-50 border-red-200',
}

function ArchetypeBadge({ archetype }: { archetype: string }) {
  const cfg = ARCHETYPE_CFG[archetype] ?? ARCHETYPE_CFG.UNCLASSIFIED
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold', cfg.bg, cfg.text, cfg.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {archetype}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CFG[channel] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
  const hasWarning = channel === 'Single Tender'
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold', cfg.bg, cfg.text, cfg.border)}>
      {hasWarning ? '⚠️ ' : ''}{channel}
    </span>
  )
}

// ── Buying Channel Panel (replaces CostTakeoutPanel) ─────────────────────────

// ── Channel Decision Tree — when to use RC / ASL / RFQ / Spot ─────────────────
// Replaces the old classification cascade (CAPEX→BULK→…) with channel ECONOMICS:
// spend size × demand pattern × vendor count → recommended channel. Teaches the
// procurement reasoning instead of just the taxonomy.

function ChannelDecisionTree() {
  const branches = [
    {
      channel: 'RC',
      tag: 'Rate Contract',
      tone: 'border-l-green-500 bg-green-50',
      pillBg: 'bg-green-600',
      criteria: [
        'Spend ≥ ₹1 Cr / yr in this category',
        '≥ 3 recurring vendors',
        'Stable, predictable demand pattern',
      ],
      win: '+40pp coverage · 2–4% price savings · TAT 3–7 days',
    },
    {
      channel: 'ASL',
      tag: 'Approved Supplier List',
      tone: 'border-l-brand-purple bg-purple-50',
      pillBg: 'bg-brand-purple',
      criteria: [
        'Spend below RC threshold OR catalogue items',
        'Variable demand or short-cycle',
        'Pre-qualified suppliers with rate cards',
      ],
      win: 'TAT 15–25 days · light-touch governance',
    },
    {
      channel: 'RFQ',
      tag: 'Request for Quote',
      tone: 'border-l-blue-500 bg-blue-50',
      pillBg: 'bg-blue-600',
      criteria: [
        'Spec-driven, project-based or new requirement',
        'Spend > ₹50L, < ₹1 Cr OR no repeat history',
        'Multiple bids commercially material',
      ],
      win: 'Competitive price discovery · 45–70 day TAT',
    },
    {
      channel: 'Spot',
      tag: 'Spot Buy',
      tone: 'border-l-amber-500 bg-amber-50',
      pillBg: 'bg-amber-600',
      criteria: [
        'One-off, urgent, < ₹50L',
        'No repeat purchase pattern',
        'Operational continuity > price discovery',
      ],
      win: 'Fastest TAT · highest unit price · use sparingly',
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-bg-secondary/40">
        <p className="text-xs text-brand-dark leading-relaxed">
          Each PO line is a decision: <span className="font-bold">spend size × supplier-base × demand pattern</span> determines the optimal channel.
          The four branches below are mutually exclusive — pick the channel whose criteria match.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {branches.map((b) => (
          <div key={b.channel} className={cn('p-3 border-l-4', b.tone)}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-white text-[10px] font-black px-2 py-0.5 rounded', b.pillBg)}>
                {b.channel}
              </span>
              <span className="text-[10px] text-caption font-semibold uppercase tracking-wide">{b.tag}</span>
            </div>
            <p className="text-[10px] text-caption font-bold uppercase tracking-wider mb-1.5">When all true</p>
            <ul className="space-y-1 mb-3">
              {b.criteria.map((c, i) => (
                <li key={i} className="text-[11px] text-brand-dark leading-snug flex items-start gap-1.5">
                  <span className="text-brand-purple font-bold flex-shrink-0 mt-0.5">▸</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <div className="bg-white/70 border border-gray-200 rounded px-2 py-1.5">
              <p className="text-[10px] text-caption font-bold mb-0.5">Outcome</p>
              <p className="text-[10px] text-brand-dark leading-snug">{b.win}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-gray-100 bg-purple-50/40">
        <p className="text-[10px] text-brand-dark leading-relaxed">
          <span className="font-bold text-brand-purple">Why this matters: </span>
          A ₹50 Cr indirect category spread across 200 spot vendors will not benefit from "moving everything to RC" — only the portion that meets the RC criteria will.
          The same logic applies category-by-category: see the AI categories below for per-category channel rationale.
        </p>
      </div>
    </div>
  )
}

function CostTakeoutPanel({
  sessionId,
  mgToCategory = {},
  highlightCategoryIdx = null,
  onClearHighlight,
  hideDecisionTree = false,
  hideBaseline = false,
}: {
  sessionId: string
  mgToCategory?: Record<string, MgCategoryMapping>
  highlightCategoryIdx?: number | null
  onClearHighlight?: () => void
  hideDecisionTree?: boolean
  hideBaseline?: boolean
}) {
  const [data, setData] = useState<BuyingChannelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState<'spend' | 'archetype' | 'confidence'>('spend')
  const [filterArchetype, setFilterArchetype] = useState<string>('ALL')
  const [toBeRC,  setToBeRC]  = useState(60)
  const [toBeASL, setToBeASL] = useState(15)
  const [toBeRFQ, setToBeRFQ] = useState(25)

  useEffect(() => {
    api.getBuyingChannel(sessionId)
      .then(d => {
        setData(d)
        if (d.slider) {
          setToBeRC(d.slider.tobe_rc_pct)
          setToBeASL(d.slider.tobe_asl_pct)
          setToBeRFQ(d.slider.tobe_rfq_pct)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  const sl: BuyingChannelSlider = data?.slider ?? {
    asis_tat: 70, rc_tat: 3, asl_tat: 25, rfq_tat: 70,
    asis_rc_pct: 0, asis_asl_pct: 0, asis_rfq_pct: 100,
    tobe_rc_pct: 60, tobe_asl_pct: 15, tobe_rfq_pct: 25,
    tat_source: 'benchmark',
  }

  const tobeWTAT = (toBeRC / 100) * sl.rc_tat + (toBeASL / 100) * sl.asl_tat + (toBeRFQ / 100) * sl.rfq_tat
  const tatReduction = sl.asis_tat - tobeWTAT
  const tatReductionPct = sl.asis_tat > 0 ? (tatReduction / sl.asis_tat * 100) : 0

  // Slider: adjust so the three always sum to 100
  const handleRC = (v: number) => {
    const newRC = Math.min(v, 100 - toBeASL)
    setToBeRC(newRC)
    setToBeRFQ(Math.max(0, 100 - newRC - toBeASL))
  }
  const handleASL = (v: number) => {
    const newASL = Math.min(v, 100 - toBeRC)
    setToBeASL(newASL)
    setToBeRFQ(Math.max(0, 100 - toBeRC - newASL))
  }
  const handleRFQ = (v: number) => {
    const newRFQ = Math.min(v, 100 - toBeRC)
    setToBeRFQ(newRFQ)
    setToBeASL(Math.max(0, 100 - toBeRC - newRFQ))
  }

  // Filtered + sorted MG rows
  const archetypes = data ? [...new Set(data.mg_rows.map(r => r.archetype))] : []
  const rows: BuyingChannelRow[] = (data?.mg_rows ?? [])
    .filter(r => filterArchetype === 'ALL' || r.archetype === filterArchetype)
    // When an AI category is highlighted, scope the table to MGs in that category
    .filter(r => {
      if (highlightCategoryIdx == null) return true
      const m = mgToCategory[String(r.mg_code).trim()]
      return m?.categoryIdx === highlightCategoryIdx
    })
    .sort((a, b) => {
      if (sortCol === 'archetype') return a.archetype.localeCompare(b.archetype)
      if (sortCol === 'confidence') {
        const ord = { HIGH: 0, MEDIUM: 1, LOW: 2 }
        return (ord[a.confidence] ?? 3) - (ord[b.confidence] ?? 3)
      }
      return b.spend - a.spend
    })

  // Δ-Save heuristic: rank channel transitions by savings opportunity
  // Spot/RFQ → RC = high; ASL → RC = medium; RC → RC = none; anything → ASL = low
  const channelRank = (ch: string) => {
    if (!ch) return 0
    if (/rc|rate|contract/i.test(ch)) return 3
    if (/asl|approved/i.test(ch))      return 2
    if (/rfq/i.test(ch))               return 1
    return 0  // spot
  }
  const deltaSave = (curr: string, rec: string): 'high' | 'med' | 'low' | 'none' => {
    const cr = channelRank(curr)
    const rr = channelRank(rec)
    if (rr - cr >= 2) return 'high'
    if (rr - cr === 1) return 'med'
    if (rr === cr)     return 'none'
    return 'low'
  }

  // Excluded rows (CAPEX + project service)
  const excluded = (data?.mg_rows ?? []).filter(r => r.archetype === 'CAPEX')

  // ── Baseline aggregates derived from mg_rows ──────────────────────────────
  // The user must see THEIR starting point before being asked to model a target.
  const allRows = data?.mg_rows ?? []
  const totalSpendCr = allRows.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalPos = allRows.reduce((s, r) => s + (r.po_count ?? 0), 0)
  // Sum unique vendors (best-effort — backend gives per-MG vendor_count which may double-count
  // across MGs; we sum as a directional supplier-base indicator).
  const totalVendors = allRows.reduce((s, r) => s + (r.vendor_count ?? 0), 0)
  // Maverick proxy: spend on rows currently sourced via Spot/RFQ-only with no contract
  const maverickSpendCr = allRows
    .filter(r => /spot|rfq/i.test(r.current_channel) && !/rc|asl/i.test(r.current_channel))
    .reduce((s, r) => s + (r.spend ?? 0), 0)
  const maverickPct = totalSpendCr > 0 ? (maverickSpendCr / totalSpendCr) * 100 : 0
  const contractedPct = sl.asis_rc_pct + sl.asis_asl_pct
  // Top-20 supplier concentration directional indicator
  const top20VendorPct = (() => {
    const sorted = [...allRows].sort((a, b) => b.spend - a.spend).slice(0, 20)
    const top20Spend = sorted.reduce((s, r) => s + (r.spend ?? 0), 0)
    return totalSpendCr > 0 ? (top20Spend / totalSpendCr) * 100 : 0
  })()

  return (
    <div className="space-y-7">

      {/* ── BASELINE BAND — anchors every number below in the client's reality ── */}
      {!hideBaseline && !loading && allRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-brand-dark uppercase tracking-wider">Your Baseline</h4>
            <span className="text-[10px] text-caption">Pulled from your uploaded PO data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="acc-card py-3 px-4 border-l-4 border-l-brand-purple">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide">Addressable Spend</p>
              <p className="text-2xl font-black text-brand-dark mt-0.5">₹{formatIndianInt(totalSpendCr)}<span className="text-xs font-normal text-caption ml-1">Cr</span></p>
              <p className="text-[10px] text-caption mt-0.5">{totalPos.toLocaleString()} POs · {data?.total_mgs ?? allRows.length} MGs</p>
            </div>
            <div className="acc-card py-3 px-4 border-l-4 border-l-brand-purple">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide">% Under Contract</p>
              <p className={cn(
                'text-2xl font-black mt-0.5',
                contractedPct >= 50 ? 'text-green-700' : contractedPct >= 30 ? 'text-amber-600' : 'text-red-600',
              )}>{contractedPct.toFixed(0)}<span className="text-xs font-normal text-caption ml-0.5">%</span></p>
              <p className="text-[10px] text-caption mt-0.5">RC + ASL coverage today</p>
            </div>
            <div className="acc-card py-3 px-4 border-l-4 border-l-brand-purple">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide">Suppliers</p>
              <p className="text-2xl font-black text-brand-dark mt-0.5">{totalVendors.toLocaleString()}</p>
              <p className="text-[10px] text-caption mt-0.5">Top 20: {top20VendorPct.toFixed(0)}% of spend</p>
            </div>
            <div className="acc-card py-3 px-4 border-l-4 border-l-amber-500">
              <p className="text-[10px] text-caption uppercase font-semibold tracking-wide flex items-center gap-1">
                Maverick Spend
                {maverickPct > 10 && <span className="text-amber-600 text-[10px]">▲ flag</span>}
              </p>
              <p className={cn(
                'text-2xl font-black mt-0.5',
                maverickPct > 15 ? 'text-red-600' : maverickPct > 10 ? 'text-amber-600' : 'text-brand-dark',
              )}>₹{formatIndianInt(maverickSpendCr)}<span className="text-xs font-normal text-caption ml-1">Cr</span></p>
              <p className="text-[10px] text-caption mt-0.5">{maverickPct.toFixed(0)}% of total · spot/RFQ only</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Section A: Channel Decision Tree — moved to "Reference" at page bottom by default ── */}
      {!hideDecisionTree && (
        <div>
          <h4 className="text-xs font-bold text-brand-dark mb-3">A. Channel Decision Logic</h4>
          <ChannelDecisionTree />
        </div>
      )}

      {/* ── Channel Mix Simulator (was "Section B: As-Is/To-Be TAT") ── */}
      <div>
        <h4 className="text-xs font-bold text-brand-dark mb-3">Channel mix simulator <span className="text-caption font-normal">— drag to model the channel migration</span></h4>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-caption py-2">
            <Loader2 size={12} className="animate-spin text-brand-purple" /> Classifying material groups…
          </div>
        ) : (
          <>
            {/* Summary banner — handles "TAT already strong" case explicitly */}
            <div className="mb-4 p-4 bg-brand-dark text-white rounded-xl flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-[11px] text-white/50 mb-0.5">As-Is TAT</p>
                <p className="text-3xl font-bold">{sl.asis_tat.toFixed(0)}<span className="text-base font-normal text-white/50 ml-1">days</span></p>
                {sl.tat_source === 'benchmark' && (
                  <p className="text-[10px] text-white/40 mt-0.5">Benchmark — upload PR dump for actuals</p>
                )}
              </div>
              <div className="text-3xl text-white/20 font-thin">→</div>
              <div>
                <p className="text-[11px] text-white/50 mb-0.5">To-Be TAT (modelled)</p>
                <p className={cn('text-3xl font-bold', tatReduction > 0 ? 'text-green-300' : 'text-amber-300')}>
                  {tobeWTAT.toFixed(0)}<span className={cn('text-base font-normal ml-1', tatReduction > 0 ? 'text-green-300/60' : 'text-amber-300/60')}>days</span>
                </p>
              </div>
              {tatReduction > 0 ? (
                <div className="border-l border-white/20 pl-6 ml-2">
                  <p className="text-[11px] text-white/50 mb-0.5">TAT Reduction</p>
                  <p className="text-3xl font-bold text-green-300">▼ {tatReduction.toFixed(0)} days</p>
                  <p className="text-[11px] text-green-300/80">{tatReductionPct.toFixed(0)}% improvement</p>
                </div>
              ) : (
                <div className="border-l border-white/20 pl-6 ml-2 max-w-md">
                  <p className="text-[11px] text-amber-300/80 mb-0.5 font-bold uppercase tracking-wide">TAT already strong</p>
                  <p className="text-[12px] text-white/85 leading-relaxed">
                    Your actual cycle time is at or below the modelled to-be. <span className="text-amber-300 font-semibold">Don't optimise for TAT</span> — focus on coverage, savings, and consolidation. Maintain TAT via PR-to-RC compliance & exception governance.
                  </p>
                </div>
              )}
            </div>

            {/* Channel mix table + sliders */}
            <table className="w-full text-xs border-collapse mb-2">
              <thead>
                <tr className="bg-brand-dark text-white">
                  <th className="text-left px-3 py-2">Channel</th>
                  <th className="text-center px-2 py-2 w-20">As-Is %</th>
                  <th className="text-center px-2 py-2 w-52">To-Be % <span className="font-normal text-white/50">(adjust)</span></th>
                  <th className="text-center px-2 py-2 w-24">TAT (days)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-bg-secondary">
                  <td className="px-3 py-2 font-medium">📄 RC / Contracts</td>
                  <td className="text-center px-2 py-2 text-caption font-mono">{sl.asis_rc_pct.toFixed(0)}%</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <input type="range" min={0} max={90} step={1} value={toBeRC}
                        onChange={e => handleRC(+e.target.value)}
                        className="flex-1 accent-brand-purple h-1.5" />
                      <span className="font-bold text-brand-purple w-8 text-right">{toBeRC}%</span>
                    </div>
                  </td>
                  <td className="text-center px-2 py-2 font-semibold text-green-700">{sl.rc_tat} days</td>
                </tr>
                <tr className="border-b border-bg-secondary bg-purple-50/20">
                  <td className="px-3 py-2 font-medium">ASL</td>
                  <td className="text-center px-2 py-2 text-caption font-mono">{sl.asis_asl_pct.toFixed(0)}%</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <input type="range" min={0} max={50} step={1} value={toBeASL}
                        onChange={e => handleASL(+e.target.value)}
                        className="flex-1 accent-brand-purple h-1.5" />
                      <span className="font-bold text-brand-purple w-8 text-right">{toBeASL}%</span>
                    </div>
                  </td>
                  <td className="text-center px-2 py-2 font-semibold text-blue-700">{sl.asl_tat} days</td>
                </tr>
                <tr className="border-b border-bg-secondary">
                  <td className="px-3 py-2 font-medium">🔍 RFQ / Spot</td>
                  <td className="text-center px-2 py-2 text-caption font-mono">{sl.asis_rfq_pct.toFixed(0)}%</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <input type="range" min={0} max={90} step={1} value={toBeRFQ}
                        onChange={e => handleRFQ(+e.target.value)}
                        className="flex-1 accent-brand-purple h-1.5" />
                      <span className="font-bold text-brand-purple w-8 text-right">{toBeRFQ}%</span>
                    </div>
                  </td>
                  <td className="text-center px-2 py-2 font-semibold text-orange-600">{sl.rfq_tat} days</td>
                </tr>
                <tr className="bg-brand-dark/5 font-bold">
                  <td className="px-3 py-2 text-brand-dark">Weighted Avg TAT</td>
                  <td className="text-center px-2 py-2 text-caption">{sl.asis_tat} days</td>
                  <td className="text-center px-2 py-2 text-[10px] text-caption">{toBeRC + toBeASL + toBeRFQ}% total</td>
                  <td className="text-center px-2 py-2 text-brand-purple">{tobeWTAT.toFixed(0)} days</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-caption">
              Defaults populated from buying channel analysis. Adjust sliders to model different scenarios.
              {sl.tat_source === 'benchmark' && ' TAT based on industry benchmark — upload PR dump for actuals.'}
            </p>

            {/* ── ADDRESSABLE SAVINGS PANEL — derived from slider state + archetype spend ── */}
            {(() => {
              // Savings heuristic: every percentage-point shift from spot/RFQ → RC unlocks
              // ~3% price-leverage savings on the affected spend (conservative). ASL gives
              // ~1.5%. Industry benchmark — surfaced in the panel footnote below.
              const rcGain = Math.max(0, toBeRC - sl.asis_rc_pct)   // pp gained by RC
              const aslGain = Math.max(0, toBeASL - sl.asis_asl_pct) // pp gained by ASL
              const totalSpend = totalSpendCr
              // Low-end / high-end: 2% / 4% on the migrated RC slice; 1% / 2% on ASL
              const lowSav  = (rcGain / 100) * totalSpend * 0.02 + (aslGain / 100) * totalSpend * 0.01
              const highSav = (rcGain / 100) * totalSpend * 0.04 + (aslGain / 100) * totalSpend * 0.02
              // Per-archetype breakdown — sum spend in mg_rows by archetype, weight by gain
              const byArchetype: Record<string, number> = {}
              for (const r of allRows) {
                if (r.archetype === 'CAPEX') continue
                byArchetype[r.archetype] = (byArchetype[r.archetype] ?? 0) + (r.spend ?? 0)
              }
              const archRows = Object.entries(byArchetype)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([k, v]) => ({
                  archetype: k,
                  spend: v,
                  low:  (v / Math.max(1, totalSpend)) * lowSav,
                  high: (v / Math.max(1, totalSpend)) * highSav,
                }))

              if (highSav <= 0) return null
              return (
                <div className="mt-4 bg-gradient-to-br from-green-50 to-purple-50/40 border border-green-200 rounded-xl p-4">
                  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500 text-lg">★</span>
                      <span className="text-xs font-bold text-brand-dark uppercase tracking-wide">Addressable Savings — modelled scenario</span>
                    </div>
                    <span className="text-2xl font-black text-green-700">
                      ₹{formatIndianInt(lowSav)}<span className="text-base font-bold text-green-600 mx-0.5">–</span>{highSav.toFixed(0)}<span className="text-sm font-medium text-green-600 ml-1">Cr</span>
                    </span>
                  </div>
                  {archRows.length > 0 && (
                    <div className="space-y-1">
                      {archRows.map((a) => (
                        <div key={a.archetype} className="flex items-center justify-between text-[11px] py-1 border-b border-green-100/60 last:border-0">
                          <span className="text-brand-dark font-medium">{a.archetype}</span>
                          <span className="font-mono text-caption">{formatCr(a.spend)} spend</span>
                          <span className="font-bold text-green-700 font-mono">
                            ₹{formatIndianInt(a.low)}–{formatIndianInt(a.high)} Cr
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-caption mt-2 leading-relaxed">
                    Heuristic: 2–4% price-leverage savings on spend migrated from spot/RFQ → RC, 1–2% on spend migrated to ASL.
                    Final addressable size requires category-level negotiation benchmarks; this band is directional.
                  </p>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* ── Section C: MG Classification Table ── */}
      <div>
        {/* Highlight banner — when a category is selected from AI panel or 2x2 */}
        {highlightCategoryIdx != null && Object.values(mgToCategory).find((m) => m.categoryIdx === highlightCategoryIdx) && (
          <div className="mb-3 flex items-center justify-between bg-purple-50 border-l-4 border-l-brand-purple rounded px-3 py-2">
            <span className="text-xs text-brand-dark">
              <span className="text-caption mr-2">Filtered to AI category:</span>
              <span className="font-semibold">
                {Object.values(mgToCategory).find((m) => m.categoryIdx === highlightCategoryIdx)?.categoryName}
              </span>
              <span className="ml-2 text-caption">({rows.length} MG{rows.length === 1 ? '' : 's'})</span>
            </span>
            <button
              onClick={onClearHighlight}
              className="text-[11px] text-brand-purple hover:text-brand-dark font-semibold"
            >
              Clear filter ×
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-brand-dark">
            MG-level migration plan <span className="text-caption font-normal">— which material groups change channel</span>
            {data && (
              <span className="ml-2 font-normal text-caption">
                · {data.total_mgs} groups · {data.classified_pct.toFixed(0)}% classified
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2">
            {/* Archetype filter */}
            <select
              value={filterArchetype}
              onChange={e => setFilterArchetype(e.target.value)}
              className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
            >
              <option value="ALL">All archetypes</option>
              {archetypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {/* Sort */}
            <select
              value={sortCol}
              onChange={e => setSortCol(e.target.value as any)}
              className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
            >
              <option value="spend">Sort: Spend ↓</option>
              <option value="archetype">Sort: Archetype</option>
              <option value="confidence">Sort: Confidence</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-caption py-2">
            <Loader2 size={12} className="animate-spin text-brand-purple" /> Classifying…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-caption text-xs py-3">No material group data found in uploaded PO file.</p>
        ) : (
          <>
            <div className="overflow-auto rounded-lg border border-gray-200" style={{ maxHeight: 380 }}>
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-brand-dark text-white">
                  <tr>
                    <th className="text-left px-3 py-2">MG Code / Description</th>
                    <th className="text-left px-2 py-2">AI Category</th>
                    <th className="text-center px-2 py-2">Archetype</th>
                    <th className="text-left px-2 py-2">Signal</th>
                    <th className="text-left px-2 py-2">Current</th>
                    <th className="text-left px-2 py-2">Recommended</th>
                    <th className="text-center px-2 py-2">Δ Save</th>
                    <th className="text-right px-2 py-2">Spend%</th>
                    <th className="text-center px-2 py-2">As-Is TAT</th>
                    <th className="text-center px-2 py-2">To-Be TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const aiCat = mgToCategory[String(r.mg_code).trim()]
                    const ds = deltaSave(r.current_channel, r.rec_channel)
                    return (
                      <tr key={r.mg_code} className={cn(
                        'border-b border-gray-100',
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                        ds === 'high' && 'bg-green-50/60',
                      )}>
                        <td className="px-3 py-2">
                          <p className="font-mono text-[10px] text-caption">{r.mg_code}</p>
                          <p className="font-medium text-brand-dark leading-tight max-w-[160px] truncate" title={r.mg_desc}>{r.mg_desc}</p>
                        </td>
                        <td className="px-2 py-2 max-w-[140px]">
                          {aiCat ? (
                            <span
                              className="inline-block bg-purple-50 border border-brand-purple/30 text-brand-purple text-[10px] font-semibold px-1.5 py-0.5 rounded truncate max-w-full"
                              title={`${aiCat.categoryName}${aiCat.kraljic ? ' · ' + aiCat.kraljic : ''}`}
                            >
                              {aiCat.categoryName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-caption italic">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <ArchetypeBadge archetype={r.archetype} />
                        </td>
                        <td className="px-2 py-2">
                          {r.signal ? (
                            <span
                              className={cn(
                                'inline-block font-mono text-[9px] px-1.5 py-0.5 rounded border truncate max-w-[100px]',
                                r.signal.startsWith('Frequency:')
                                  ? 'bg-purple-50 border-purple-200 text-purple-700 font-semibold'
                                  : r.signal.startsWith('Keyword:')
                                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-500',
                              )}
                              title={r.signal}
                            >
                              {r.signal.startsWith('Frequency:')
                                ? `P3 · ${r.signal}`
                                : r.signal.startsWith('Keyword:')
                                ? `P4 · ${r.signal.replace('Keyword:', '')}`
                                : r.signal.startsWith('LiteralCode:')
                                ? `P0 · ${r.signal.replace('LiteralCode:', '')}`
                                : r.signal.startsWith('Item_Category')
                                ? `P1 · ${r.signal}`
                                : r.signal.startsWith('Material_Type')
                                ? `P2 · ${r.signal}`
                                : r.signal}
                            </span>
                          ) : (
                            <span className="text-[10px] text-caption italic">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[10px]', CURRENT_CHANNEL_CFG[r.current_channel] ?? 'text-gray-500 bg-gray-50 border-gray-200')}>
                            {r.current_channel}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <ChannelBadge channel={r.rec_channel} />
                        </td>
                        <td className="px-2 py-2 text-center" title={ds === 'high' ? 'High savings opportunity' : ds === 'med' ? 'Medium opportunity' : ds === 'low' ? 'Low opportunity' : 'No change required'}>
                          {ds === 'high' && <span className="text-green-600 font-black">●</span>}
                          {ds === 'med'  && <span className="text-amber-500 font-black">●</span>}
                          {ds === 'low'  && <span className="text-gray-400 font-black">●</span>}
                          {ds === 'none' && <span className="text-gray-200 font-black">○</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-caption">{r.spend_share_pct.toFixed(0)}%</td>
                        <td className="px-2 py-2 text-center font-mono text-caption">
                          {r.as_is_tat != null ? `${r.as_is_tat}d` : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {r.to_be_tat != null ? (
                            <span className="font-bold text-green-700">{r.to_be_tat}d</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Excluded rows */}
            {excluded.length > 0 && (
              <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-caption">
                <span className="font-semibold text-gray-600">Excluded from TAT model: </span>
                {excluded.slice(0, 5).map(r => (
                  <span key={r.mg_code} className="inline-block bg-red-50 border border-red-100 text-red-700 rounded px-1.5 py-0.5 mr-1 mb-0.5">
                    {r.mg_desc} — CAPEX
                  </span>
                ))}
                {excluded.length > 5 && <span>+{excluded.length - 5} more</span>}
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
              <p className="text-[10px] text-caption">
                Sorted by spend descending. Archetype via SAP field → keyword fallback.
              </p>
              <div className="flex items-center gap-3 text-[10px] text-caption">
                <span className="font-bold uppercase tracking-wider">Δ Save legend:</span>
                <span className="flex items-center gap-1"><span className="text-green-600 font-black">●</span> high (spot/RFQ → RC)</span>
                <span className="flex items-center gap-1"><span className="text-amber-500 font-black">●</span> medium</span>
                <span className="flex items-center gap-1"><span className="text-gray-400 font-black">●</span> low</span>
                <span className="flex items-center gap-1"><span className="text-gray-200 font-black">○</span> none</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── O4: Z-Curve (Tech & AI) Panel ─────────────────────────────────────────────

function ZCurvePanel() {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2">
        {ZCURVE_PHASES.map((phase, pi) => (
          <div key={pi} className="w-52 flex-shrink-0">
            <div
              className="text-white text-xs font-bold px-2 py-2 text-center mb-2 rounded"
              style={{
                background: 'linear-gradient(135deg, #460073 0%, #a100ff 100%)',
                clipPath: pi < ZCURVE_PHASES.length - 1
                  ? 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%)'
                  : 'none',
              }}
            >
              <span className="text-white/60 text-[9px] block">Phase {pi + 1}</span>
              <span className="leading-tight">{phase.name}</span>
            </div>
            <div className="space-y-1.5">
              {phase.agents.map((agent, ai) => (
                <AgentTooltip key={ai} text={agent.desc}>
                  <div className={cn(
                    'border-l-4 pl-2 pr-2 py-1.5 rounded-r text-xs cursor-pointer transition-all hover:shadow-md',
                    agent.bold
                      ? 'border-brand-purple bg-brand-purple text-white'
                      : 'border-brand-purple bg-white text-brand-dark hover:bg-purple-50'
                  )}>
                    <p className="font-semibold leading-tight">{agent.name}</p>
                  </div>
                </AgentTooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-caption mt-2 italic">Hover over any agent card to see its description. Purple-filled = priority focus areas.</p>
    </div>
  )
}

// ── O5: SRM Panel ─────────────────────────────────────────────────────────────

function SRMPanel() {
// --- FILE CONTINUES IN PART 2 ---
```

---
## frontend/src/components/results/OfferingsTab.tsx (Part 2 of 2 — lines 1751–end)

```tsx
// --- CONTINUED FROM PART 1 ---
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-bold text-brand-dark mb-2">1. SRM Role Definition</h4>
        <table className="w-full text-xs acc-table">
          <thead><tr><th>Role</th><th>Responsibility</th><th>KRA</th></tr></thead>
          <tbody>
            <tr>
              <td className="font-medium">Vendor Performance Manager</td>
              <td>Track scorecard, OTD, defect rate; Quarterly reviews</td>
              <td>OTD %, Defect Rate, Scorecard completion</td>
            </tr>
            <tr>
              <td className="font-medium">SRM Lead</td>
              <td>Strategic supplier engagement; Annual business reviews</td>
              <td>Strategic supplier satisfaction, development milestones</td>
            </tr>
            <tr>
              <td className="font-medium">Category Manager</td>
              <td>Supply base strategy; Supplier development</td>
              <td>Supply base diversification, savings, innovation</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="text-xs font-bold text-brand-dark mb-2">2. SRM Process Flow</h4>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {['Vendor Onboarding', 'Performance Monitoring', 'Scorecard Review', 'Corrective Action', 'Strategic Review'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-1 flex-shrink-0">
              <div className="bg-brand-dark text-white text-xs font-semibold px-3 py-2 rounded text-center w-28 leading-tight">{step}</div>
              {i < arr.length - 1 && <span className="text-brand-purple font-bold text-base">→</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-purple-50 border border-bg-secondary rounded p-3 text-xs text-brand-dark">
        <p className="font-semibold mb-1">3. SRM & Buying Channel Linkage</p>
        <p>The Approved Supplier List (ASL) is owned and maintained by the SRM team. Regular ASL review ensures procurement teams have access to pre-qualified vendors, enabling faster sourcing cycles and better quality outcomes.</p>
      </div>
    </div>
  )
}

// ── Training path data ────────────────────────────────────────────────────────

// Dimension clusters per persona
const PERSONA_DIM_CLUSTERS = {
  buyer:    ['D2', 'D3', 'D4'],                          // Sourcing, P2P, Contracts
  catmgr:   ['D6', 'D1', 'D7'],                          // Category Mgmt, Strategy, SRM
  cpo:      ['D8', 'D5', 'D9', 'D10', 'D11', 'D12', 'D13'], // Insights, Workforce, Perf, Digital, Demand, Finance, Governance
}

// Score band thresholds (procurement maturity 1–4 scale)
function getBand(score: number): 'foundation' | 'intermediate' | 'advanced' | 'leading' {
  if (score < 2.0) return 'foundation'
  if (score < 3.0) return 'intermediate'
  if (score < 3.5) return 'advanced'
  return 'leading'
}

const BAND_LABELS: Record<string, string> = {
  foundation:   'Foundation',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
  leading:      'Leading',
}

const BAND_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  foundation:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400' },
  intermediate: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  advanced:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  leading:      { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

// Learning modules per persona per band
const TRAINING_MODULES: Record<string, Record<string, { title: string; type: string; duration: string }[]>> = {
  buyer: {
    foundation: [
      { title: 'Procurement Fundamentals & Compliance', type: 'eLearning', duration: '4 hrs' },
      { title: 'P2P Process Walkthrough (PR → GRN)', type: 'eLearning', duration: '3 hrs' },
      { title: 'RFQ Preparation Basics', type: 'Workshop', duration: '1 day' },
      { title: 'SAP MM / ERP Basics for Buyers', type: 'eLearning', duration: '6 hrs' },
    ],
    intermediate: [
      { title: 'Supplier Negotiation Essentials', type: 'Workshop', duration: '2 days' },
      { title: 'Contract Interpretation & Risk Awareness', type: 'eLearning', duration: '4 hrs' },
      { title: 'E-Sourcing Platforms (SAP Ariba / Jaggaer)', type: 'Certification', duration: '2 days' },
      { title: 'Spend Analysis & P2P KPI Management', type: 'eLearning', duration: '3 hrs' },
    ],
    advanced: [
      { title: 'Advanced Commercial Negotiation', type: 'Workshop', duration: '3 days' },
      { title: 'Contract Risk & Dispute Management', type: 'Certification', duration: '2 days' },
      { title: 'Should-Cost Modelling for Buyers', type: 'Workshop', duration: '1 day' },
      { title: 'Automation & RPA in P2P Processes', type: 'eLearning', duration: '4 hrs' },
    ],
    leading: [
      { title: 'Buyer Excellence Coaching Certification', type: 'Certification', duration: '3 days' },
      { title: 'Process Innovation & Lean Procurement', type: 'Workshop', duration: '2 days' },
      { title: 'AI-Assisted Sourcing & Contract Analytics', type: 'eLearning', duration: '5 hrs' },
    ],
  },
  catmgr: {
    foundation: [
      { title: 'Category Management Fundamentals', type: 'eLearning', duration: '5 hrs' },
      { title: 'Spend Analysis & Supplier Research Basics', type: 'Workshop', duration: '1 day' },
      { title: 'Category Mapping & Spend Segmentation', type: 'eLearning', duration: '3 hrs' },
      { title: 'Procurement Strategy Awareness', type: 'eLearning', duration: '2 hrs' },
    ],
    intermediate: [
      { title: 'Strategic Sourcing Methodology (7-Step)', type: 'Certification', duration: '3 days' },
      { title: 'Category Plan Development & Business Case', type: 'Workshop', duration: '2 days' },
      { title: 'Market Intelligence & Pricing Benchmarks', type: 'eLearning', duration: '4 hrs' },
      { title: 'SRM Fundamentals — Supplier Scorecards', type: 'eLearning', duration: '3 hrs' },
    ],
    advanced: [
      { title: 'Category Portfolio Management', type: 'Workshop', duration: '2 days' },
      { title: 'Should-Cost & Total Cost of Ownership Modelling', type: 'Certification', duration: '2 days' },
      { title: 'Supplier Development & Relationship Programmes', type: 'Workshop', duration: '2 days' },
      { title: 'Advanced Spend Analytics & Visualisation', type: 'eLearning', duration: '5 hrs' },
    ],
    leading: [
      { title: 'Category Leadership & Stakeholder Alignment', type: 'Workshop', duration: '2 days' },
      { title: 'Innovation Sourcing & Co-Development', type: 'Workshop', duration: '1 day' },
      { title: 'ESG & Responsible Sourcing in Category Strategy', type: 'Certification', duration: '1 day' },
    ],
  },
  cpo: {
    foundation: [
      { title: 'Procurement Governance & Policy Foundations', type: 'eLearning', duration: '3 hrs' },
      { title: 'KPI Framework & Dashboard Interpretation', type: 'Workshop', duration: '1 day' },
      { title: 'Stakeholder Management Essentials', type: 'eLearning', duration: '2 hrs' },
      { title: 'Procurement Operating Model Basics', type: 'eLearning', duration: '4 hrs' },
    ],
    intermediate: [
      { title: 'Procurement Transformation Roadmap Design', type: 'Workshop', duration: '2 days' },
      { title: 'Digital Procurement Strategy & Tool Selection', type: 'Workshop', duration: '2 days' },
      { title: 'Performance Benchmarking & Maturity Assessment', type: 'Certification', duration: '2 days' },
      { title: 'Team Capability Building & Talent Strategy', type: 'eLearning', duration: '4 hrs' },
    ],
    advanced: [
      { title: 'Procurement Transformation Leadership', type: 'Certification', duration: '3 days' },
      { title: 'Analytics-Driven Procurement Decision Making', type: 'Workshop', duration: '2 days' },
      { title: 'ESG & Sustainable Procurement Strategy', type: 'Certification', duration: '2 days' },
      { title: 'Finance & Value Reporting for Procurement', type: 'Workshop', duration: '1 day' },
    ],
    leading: [
      { title: 'Board-Level Procurement Strategy & Influence', type: 'Workshop', duration: '2 days' },
      { title: 'Industry Benchmarking & External Thought Leadership', type: 'Workshop', duration: '1 day' },
      { title: 'AI & Autonomous Procurement Vision', type: 'eLearning', duration: '4 hrs' },
    ],
  },
}

const MODULE_TYPE_COLORS: Record<string, string> = {
  eLearning:    'bg-blue-100 text-blue-700',
  Workshop:     'bg-purple-100 text-purple-700',
  Certification:'bg-green-100 text-green-700',
}

const PERSONA_CONFIG = [
  {
    key: 'buyer' as const,
    label: 'Buyer',
    icon: '🛒',
    dimIds: PERSONA_DIM_CLUSTERS.buyer,
    dimLabels: 'D2 Sourcing · D3 P2P · D4 Contracts',
    color: 'blue',
    headerBg: 'bg-blue-600',
    headerText: 'text-white',
  },
  {
    key: 'catmgr' as const,
    label: 'Category Manager',
    icon: '📊',
    dimIds: PERSONA_DIM_CLUSTERS.catmgr,
    dimLabels: 'D6 Category · D1 Strategy · D7 SRM',
    color: 'purple',
    headerBg: 'bg-brand-purple',
    headerText: 'text-white',
  },
  {
    key: 'cpo' as const,
    label: 'CPO',
    icon: '🎯',
    dimIds: PERSONA_DIM_CLUSTERS.cpo,
    dimLabels: 'D8 Insights · D5 Workforce · D9–D13',
    color: 'dark',
    headerBg: 'bg-brand-dark',
    headerText: 'text-white',
  },
]

function TrainingPathsSection({ dimResults }: { dimResults: DimensionResult[] }) {
  const [activePath, setActivePath] = useState<string | null>(null)

  // Calculate cluster scores per persona
  const personaScores = PERSONA_CONFIG.map(p => {
    const dims = dimResults.filter(d => p.dimIds.includes(d.dim_id) && d.score !== null)
    const avg = dims.length > 0
      ? dims.reduce((sum, d) => sum + (d.score ?? 0), 0) / dims.length
      : null
    const band = avg !== null ? getBand(avg) : 'foundation'
    return { ...p, avg, band }
  })

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 bg-brand-purple rounded-full" />
        <h3 className="text-sm font-bold text-brand-dark">Recommended Learning Paths by Persona</h3>
      </div>
      <p className="text-xs text-caption">
        Training paths are derived from your assessment dimension scores. Each persona targets a different cluster of dimensions. Click a persona card to view the recommended programme.
      </p>

      {/* Persona score summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {personaScores.map(p => {
          const bandCfg = BAND_COLORS[p.band]
          const isActive = activePath === p.key
          return (
            <button
              key={p.key}
              onClick={() => setActivePath(prev => prev === p.key ? null : p.key)}
              className={cn(
                'text-left rounded-xl border-2 overflow-hidden transition-all shadow-sm hover:shadow-md',
                bandCfg.border,
                isActive ? 'ring-2 ring-offset-1 ring-brand-purple scale-[1.01]' : ''
              )}
            >
              <div className={cn('px-3 py-2.5 flex items-center gap-2', p.headerBg)}>
                <span className="text-xl">{p.icon}</span>
                <span className="text-white font-black text-sm">{p.label}</span>
                {p.avg !== null && (
                  <span className="ml-auto text-white/80 text-xs font-bold">{p.avg.toFixed(0)} / 4.0</span>
                )}
              </div>
              <div className={cn('px-3 py-2.5', bandCfg.bg)}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', bandCfg.dot)} />
                  <span className={cn('text-xs font-bold', bandCfg.text)}>{BAND_LABELS[p.band]} Level</span>
                </div>
                <p className="text-[10px] text-gray-500">{p.dimLabels}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 italic">
                  {TRAINING_MODULES[p.key][p.band].length} modules recommended
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Expanded module list */}
      <AnimatePresence>
        {activePath && (() => {
          const p = personaScores.find(x => x.key === activePath)!
          const modules = TRAINING_MODULES[p.key][p.band]
          const bandCfg = BAND_COLORS[p.band]
          return (
            <motion.div
              key={activePath}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className={cn('rounded-xl border-2 overflow-hidden', bandCfg.border)}
            >
              <div className={cn('px-4 py-3 flex items-center gap-3', p.headerBg)}>
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <p className="text-white font-black text-sm">{p.label} — {BAND_LABELS[p.band]} Track</p>
                  <p className="text-white/70 text-xs">{p.dimLabels} · Avg score: {p.avg?.toFixed(0) ?? 'N/A'} / 4.0</p>
                </div>
                <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold', bandCfg.badge)}>{BAND_LABELS[p.band]}</span>
              </div>
              <div className={cn('px-4 py-3', bandCfg.bg)}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Recommended Modules</p>
                <div className="space-y-2">
                  {modules.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-brand-dark leading-tight">{m.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', MODULE_TYPE_COLORS[m.type] ?? 'bg-gray-100 text-gray-600')}>{m.type}</span>
                        <span className="text-[10px] text-caption">{m.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-caption mt-3 italic">
                  As scores improve, re-run the assessment to unlock the next programme level.
                </p>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Band legend */}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(BAND_LABELS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full', BAND_COLORS[k].dot)} />
            <span className="text-gray-500">{v}: {k === 'foundation' ? '1.0–1.9' : k === 'intermediate' ? '2.0–2.9' : k === 'advanced' ? '3.0–3.4' : '3.5–4.0'}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── O6: Capability QRE + Radar Panel ─────────────────────────────────────────

function CapabilityPanel({ dimResults }: { dimResults: DimensionResult[] }) {
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    QRE_SKILLS.forEach(s => { init[s.id] = s.sample })
    return init
  })

  const radarData = Object.entries(
    QRE_SKILLS.reduce<Record<string, number[]>>((acc, s) => {
      if (!acc[s.category]) acc[s.category] = []
      acc[s.category].push(ratings[s.id] ?? s.sample)
      return acc
    }, {})
  ).map(([cat, vals]) => ({
    subject: cat,
    score: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)),
    fullMark: 5,
  }))

  const grouped = QRE_SKILLS.reduce<Record<string, typeof QRE_SKILLS>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const avgScore = Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length

  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 border border-brand-purple/20 rounded text-xs text-brand-dark">
        <p className="font-semibold mb-0.5">Sample QRE Output — Team Capability Assessment</p>
        <p className="text-caption">Adjust ratings (1=Foundational → 5=Expert). In the engagement each team member completes this independently; the radar shows the team average.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* QRE Table */}
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, skills]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QRE_CATEGORY_COLORS[cat] || '#888' }} />
                <span className="text-[11px] font-bold uppercase tracking-wide text-caption">{cat}</span>
              </div>
              <div className="space-y-1">
                {skills.map(skill => {
                  const r = ratings[skill.id] ?? skill.sample
                  return (
                    <div key={skill.id} className="flex items-center gap-2">
                      <span className="text-xs text-brand-dark flex-1 leading-tight min-w-0 truncate" title={skill.name}>{skill.name}</span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {[1, 2, 3, 4, 5].map(v => (
                          <button
                            key={v}
                            onClick={() => setRatings(prev => ({ ...prev, [skill.id]: v }))}
                            className={cn(
                              'w-6 h-6 rounded text-xs font-bold transition-all border',
                              r >= v ? 'text-white border-transparent' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-brand-purple/50',
                            )}
                            style={r >= v ? { backgroundColor: QRE_CATEGORY_COLORS[skill.category] || '#a100ff', borderColor: 'transparent' } : {}}
                            title={RATING_LABELS[v]}
                          >
                            {v}
                          </button>
                        ))}
                        <span className="text-[10px] text-caption w-20 ml-1">{RATING_LABELS[r]}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Radar + summary */}
        <div className="flex flex-col">
          <p className="text-xs font-bold text-brand-dark mb-1 text-center">Capability Radar — Category Average</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e6dcff" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#460073', fontWeight: 600 }} />
                <Radar name="Score" dataKey="score" stroke="#a100ff" fill="#a100ff" fillOpacity={0.3} strokeWidth={2} dot={{ r: 3, fill: '#a100ff' }} />
                <RechartsTooltip formatter={(v: number) => [`${v} / 5`, 'Avg']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Overall score */}
          <div className="mt-2 p-3 bg-brand-dark text-white rounded-lg text-center">
            <p className="text-xs text-white/60 mb-0.5">Overall Team Average</p>
            <p className="text-2xl font-bold">{avgScore.toFixed(0)} <span className="text-sm font-normal text-white/60">/ 5</span></p>
            <p className="text-xs text-white/80">{RATING_LABELS[Math.round(avgScore)] ?? ''}</p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {Object.entries(QRE_CATEGORY_COLORS).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1 text-[10px] text-caption">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Persona Training Paths ─────────────────────────────── */}
      <TrainingPathsSection dimResults={dimResults} />
    </div>
  )
}

// ── Before/After Strip — the visual spine of the Category Offering page ──────
// Frames the entire offering as a single solution: "this is your current state,
// these are the two changes that get you to the to-be state."

function BeforeAfterStrip({
  sessionId,
  aiCategoryCount,
}: {
  sessionId: string
  aiCategoryCount: number | null
}) {
  const [data, setData] = useState<BuyingChannelData | null>(null)
  useEffect(() => {
    api.getBuyingChannel(sessionId).then(setData).catch(() => {})
  }, [sessionId])

  if (!data) return null
  const sl = data.slider
  const allRows = data.mg_rows ?? []
  const totalSpendCr = allRows.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalVendors = allRows.reduce((s, r) => s + (r.vendor_count ?? 0), 0)
  const maverickSpendCr = allRows
    .filter(r => /spot|rfq/i.test(r.current_channel) && !/rc|asl/i.test(r.current_channel))
    .reduce((s, r) => s + (r.spend ?? 0), 0)
  const maverickPct = totalSpendCr > 0 ? (maverickSpendCr / totalSpendCr) * 100 : 0
  const asisContractedPct = sl.asis_rc_pct + sl.asis_asl_pct
  const tobeContractedPct = sl.tobe_rc_pct + sl.tobe_asl_pct
  const tobeWTAT = (sl.tobe_rc_pct / 100) * sl.rc_tat + (sl.tobe_asl_pct / 100) * sl.asl_tat + (sl.tobe_rfq_pct / 100) * sl.rfq_tat
  // Raw delta — can be negative when actual TAT already beats the modelled to-be
  const rawTatReductionPct = sl.asis_tat > 0 ? ((sl.asis_tat - tobeWTAT) / sl.asis_tat) * 100 : 0
  // Special case: actual TAT already at or below the modelled to-be. The TAT-reduction
  // story is invalid for this client — they're already strong on cycle time. Reframe
  // toward cost / coverage / consolidation, which are the levers that still apply.
  const tatAlreadyStrong = sl.asis_tat > 0 && tobeWTAT >= sl.asis_tat
  const tatReductionPct = tatAlreadyStrong ? 0 : rawTatReductionPct
  // Heuristic addressable savings band (matches simulator)
  const rcGain = Math.max(0, sl.tobe_rc_pct - sl.asis_rc_pct)
  const aslGain = Math.max(0, sl.tobe_asl_pct - sl.asis_asl_pct)
  const lowSav = (rcGain / 100) * totalSpendCr * 0.02 + (aslGain / 100) * totalSpendCr * 0.01
  const highSav = (rcGain / 100) * totalSpendCr * 0.04 + (aslGain / 100) * totalSpendCr * 0.02

  const Row = ({ label, current, future }: { label: string; current: React.ReactNode; future: React.ReactNode }) => (
    <div className="grid grid-cols-2 divide-x divide-bg-secondary">
      <div className="px-4 py-2.5">
        <p className="text-[10px] text-caption uppercase tracking-wide font-bold">{label}</p>
        <div className="text-sm text-brand-dark mt-0.5 font-medium">{current}</div>
      </div>
      <div className="px-4 py-2.5 bg-green-50/50">
        <p className="text-[10px] text-green-700 uppercase tracking-wide font-bold">{label}</p>
        <div className="text-sm text-brand-dark mt-0.5 font-medium">{future}</div>
      </div>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header — two-tone */}
      <div className="grid grid-cols-2 divide-x divide-bg-secondary">
        <div className="px-4 py-3 bg-bg-secondary/40">
          <p className="text-[10px] uppercase tracking-widest text-caption font-bold mb-0.5">Current state</p>
          <h4 className="text-sm font-bold text-brand-dark">Where you are today</h4>
          <p className="text-[11px] text-caption mt-0.5">From your uploaded PO data</p>
        </div>
        <div className="px-4 py-3 bg-green-50">
          <p className="text-[10px] uppercase tracking-widest text-green-800 font-bold mb-0.5">Target state — after channel migration</p>
          <h4 className="text-sm font-bold text-brand-dark">After re-categorisation + channel migration</h4>
          <p className="text-[11px] text-green-700 mt-0.5">If you adopt the recommended channel mix and category structure</p>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="divide-y divide-bg-secondary">
        <Row
          label="Spend & supplier base"
          current={
            <>{formatCr(totalSpendCr)} · <span className="text-caption">{totalVendors.toLocaleString()} active vendors</span></>
          }
          future={
            <>Same spend · <span className="text-green-700 font-bold">consolidated to 2–3 preferred vendors / leverage category</span></>
          }
        />
        <Row
          label="Category structure"
          current={
            <span className="text-amber-700">{data.total_mgs ?? allRows.length} material groups, grouped by SAP code</span>
          }
          future={
            aiCategoryCount
              ? <span className="text-green-700 font-bold">{aiCategoryCount} strategic categories — channel-positioned</span>
              : <span className="text-caption italic">Click "Generate Category Structure" below to compute</span>
          }
        />
        <Row
          label="Channel mix"
          current={
            <span><span className="text-red-600 font-bold">{sl.asis_rc_pct.toFixed(0)}% RC</span> · {sl.asis_asl_pct.toFixed(0)}% ASL · <span className="text-amber-700">{sl.asis_rfq_pct.toFixed(0)}% spot/RFQ</span></span>
          }
          future={
            <span><span className="text-green-700 font-bold">{sl.tobe_rc_pct.toFixed(0)}% RC</span> · {sl.tobe_asl_pct.toFixed(0)}% ASL · {sl.tobe_rfq_pct.toFixed(0)}% spot/RFQ</span>
          }
        />
        <Row
          label="Contract coverage"
          current={
            <span className={cn(asisContractedPct < 30 ? 'text-red-600' : asisContractedPct < 50 ? 'text-amber-700' : 'text-green-700', 'font-bold')}>
              {asisContractedPct.toFixed(0)}% of spend on contract
            </span>
          }
          future={
            <span className="text-green-700 font-bold">
              {tobeContractedPct.toFixed(0)}% on contract <span className="text-caption font-normal">(+{(tobeContractedPct - asisContractedPct).toFixed(0)}pp)</span>
            </span>
          }
        />
        <Row
          label="Maverick spend"
          current={
            <span className={cn(maverickPct > 10 ? 'text-red-600' : 'text-amber-700', 'font-bold')}>
              {formatCr(maverickSpendCr)} ({maverickPct.toFixed(0)}%)
            </span>
          }
          future={
            <span className="text-green-700 font-bold">{'< 2%'} <span className="text-caption font-normal">via PR-to-RC compliance gate</span></span>
          }
        />
        {tatAlreadyStrong ? (
          <Row
            label="Average TAT"
            current={
              <span className="text-green-700 font-bold">
                {sl.asis_tat.toFixed(0)} days <span className="text-caption font-normal">— already strong vs benchmark</span>
              </span>
            }
            future={
              <span className="text-brand-dark font-bold">
                Maintain ≤ {sl.asis_tat.toFixed(0)} days <span className="text-caption font-normal">— protect with PR-to-RC compliance & exception governance</span>
              </span>
            }
          />
        ) : (
          <Row
            label="Average TAT"
            current={
              <span className="text-amber-700 font-bold">{sl.asis_tat.toFixed(0)} days</span>
            }
            future={
              <span className="text-green-700 font-bold">
                {tobeWTAT.toFixed(0)} days <span className="text-caption font-normal">(–{formatIndianInt(tatReductionPct)}%)</span>
              </span>
            }
          />
        )}
      </div>

      {/* Impact strip — the bottom-line outcome (reframed when TAT already strong) */}
      <div className="bg-brand-dark text-white px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Bottom-line impact</p>
          <p className="text-sm font-bold mt-0.5">
            {tatAlreadyStrong
              ? <>TAT already strong — value lever shifts to <span className="text-green-300">savings</span> and <span className="text-green-300">consolidation</span>.</>
              : <>Two changes get you there: <span className="text-green-300">re-categorisation</span> and <span className="text-green-300">channel migration</span>.</>
            }
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[10px] text-white/60 uppercase tracking-wide">Addressable savings</p>
            <p className="text-xl font-black text-green-300">₹{formatIndianInt(lowSav)}–{formatIndianInt(highSav)} Cr</p>
          </div>
          <div className="text-right border-l border-white/20 pl-5">
            <p className="text-[10px] text-white/60 uppercase tracking-wide">Coverage uplift</p>
            <p className="text-xl font-black text-green-300">+{(tobeContractedPct - asisContractedPct).toFixed(0)}pp</p>
          </div>
          <div className="text-right border-l border-white/20 pl-5">
            <p className="text-[10px] text-white/60 uppercase tracking-wide">
              {tatAlreadyStrong ? 'Cycle-time risk' : 'TAT reduction'}
            </p>
            <p className="text-xl font-black text-green-300">
              {tatAlreadyStrong ? 'Low — protect' : `–${tatReductionPct.toFixed(0)}%`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section heading — numbered story-arc anchors ──────────────────────────────

function SectionHeading({ num, eyebrow, title, sub }: { num: number; eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-brand-purple text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
        {num}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-brand-purple font-bold">{eyebrow}</p>
        <h3 className="text-base font-bold text-brand-dark leading-tight">{title}</h3>
        {sub && <p className="text-[11px] text-caption mt-0.5 max-w-2xl">{sub}</p>}
      </div>
    </div>
  )
}

// ── Kraljic 2×2 — categories plotted by spend × supply complexity ─────────────
// Replaces the textbook classification cascade with the actual procurement
// decision frame: Strategic / Leverage / Bottleneck / Non-critical.

function KraljicMatrix({
  categories,
  highlightIdx = null,
  onCategoryClick,
}: {
  categories: AiCategory[]
  highlightIdx?: number | null
  onCategoryClick?: (idx: number) => void
}) {
  // Normalise spend (X) and complexity (Y) to a 0..100 scale.
  // Spend axis: relative to the largest category's spend
  const maxSpend = Math.max(1, ...categories.map((c) => c.spend_cr ?? 0))
  // Complexity axis from the AI's complexity field — High=80, Medium=50, Low=20.
  // Add jitter so dots don't overlap perfectly when many share complexity.
  const complexityScore = (c: string | undefined) =>
    c === 'High' ? 80 : c === 'Medium' ? 50 : c === 'Low' ? 20 : 50

  const QUADRANT_DESC: Record<string, { title: string; sub: string; color: string; bg: string }> = {
    Strategic:    { title: 'Strategic',    sub: 'Partner / develop · long-term contracts',  color: '#dc2626', bg: 'bg-red-50' },
    Leverage:     { title: 'Leverage',     sub: 'Aggregate volume · negotiate price · RC',  color: '#a100ff', bg: 'bg-purple-50' },
    Bottleneck:   { title: 'Bottleneck',   sub: 'Manage risk · dual-source · build buffer', color: '#d97706', bg: 'bg-amber-50' },
    'Non-critical': { title: 'Non-critical', sub: 'Catalogue / ASL · minimise admin',       color: '#6b7280', bg: 'bg-gray-50' },
  }

  // Plot data — one point per category
  const plotData = categories.map((c, idx) => ({
    idx,
    name: c.name,
    spend: c.spend_cr ?? 0,
    spendPct: c.spend_pct ?? 0,
    x: ((c.spend_cr ?? 0) / maxSpend) * 100,                    // 0..100
    y: complexityScore(c.complexity) + (idx % 5) * 2 - 4,        // small spread
    z: Math.max(20, ((c.spend_cr ?? 0) / maxSpend) * 800),       // bubble size
    quadrant: c.kraljic_quadrant ?? 'Leverage',
    color: QUADRANT_DESC[c.kraljic_quadrant ?? 'Leverage']?.color ?? '#a100ff',
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-bg-secondary/40 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-caption font-bold">Strategic Positioning</p>
          <h4 className="text-sm font-bold text-brand-dark">Category Map — spend × supply complexity</h4>
        </div>
        <span className="text-[11px] text-caption">Bubble size = spend · click any bubble to filter the MG table</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Chart */}
        <div className="md:col-span-2 p-3" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 16, right: 16, bottom: 36, left: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              {/* Quadrant divider lines */}
              <ReferenceLine x={50} stroke="#cbd5e1" strokeDasharray="2 4" />
              <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 10, fill: '#666' }}
                label={{ value: 'SPEND →', position: 'insideBottom', offset: -16, fontSize: 10, fill: '#666' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 10, fill: '#666' }}
                label={{ value: 'SUPPLY COMPLEXITY ↑', angle: -90, position: 'insideLeft', offset: 4, fontSize: 10, fill: '#666' }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 600]} />
              <RechartsTooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
                formatter={(_v: any, _n: any, p: any) => {
                  const d = p?.payload || {}
                  return [`${d.quadrant} · ₹${formatIndianInt((d.spend ?? 0))} Cr (${(d.spendPct ?? 0).toFixed(0)}%)`, d.name]
                }}
                labelFormatter={() => ''}
              />
              {/* One Scatter series per quadrant — colors by quadrant */}
              {(['Strategic', 'Leverage', 'Bottleneck', 'Non-critical'] as const).map((q) => {
                const points = plotData.filter((p) => p.quadrant === q)
                if (points.length === 0) return null
                const color = QUADRANT_DESC[q]?.color ?? '#a100ff'
                return (
                  <Scatter
                    key={q}
                    name={q}
                    data={points}
                    fill={color}
                    fillOpacity={0.8}
                    stroke="white"
                    strokeWidth={1}
                    onClick={(e: any) => onCategoryClick?.(e.idx)}
                  />
                )
              })}
              {/* Highlight ring on selected bubble */}
              {highlightIdx != null && (
                <Scatter
                  data={plotData.filter((p) => p.idx === highlightIdx)}
                  fill="transparent"
                  stroke="#460073"
                  strokeWidth={3}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Quadrant legend */}
        <div className="border-l border-gray-100 p-3 grid grid-cols-2 gap-2 content-start">
          {(['Strategic', 'Leverage', 'Bottleneck', 'Non-critical'] as const).map((q) => {
            const meta = QUADRANT_DESC[q]
            const count = categories.filter((c) => (c.kraljic_quadrant ?? 'Leverage') === q).length
            return (
              <div key={q} className={cn('rounded-lg p-2 border', meta.bg, 'border-transparent')}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                  <span className="text-[11px] font-bold text-brand-dark">{meta.title}</span>
                  <span className="text-[10px] text-caption ml-auto">{count}</span>
                </div>
                <p className="text-[10px] text-caption leading-snug">{meta.sub}</p>
              </div>
            )
          })}
          <div className="col-span-2 mt-1 text-[10px] text-caption italic">
            Each bubble = one AI-suggested category. Click to filter the MG table below.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Category Offering Shell — owns shared AI category state ───────────────────
// Lifts state above CostTakeoutPanel and AiBuyingCategories so both panels can
// share the AI category structure: the MG table can show which AI category each
// material group belongs to, and the Kraljic 2x2 can plot all categories.

interface MgCategoryMapping {
  categoryName: string
  categoryIdx: number
  kraljic?: string
  channel?: string
}

// ── Drill-down button — used in The Plan block ────────────────────────────────

function DrillButton({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left border rounded-lg px-3 py-2.5 transition-colors w-full',
        active
          ? 'bg-brand-purple text-white border-brand-purple'
          : 'bg-white border-bg-secondary hover:border-brand-purple/40 hover:bg-purple-50/40'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-brand-dark')}>{label}</span>
        <span className={cn('text-xs', active ? 'text-white/70' : 'text-brand-purple group-hover:translate-x-0.5 transition-transform')}>
          {active ? '×' : '→'}
        </span>
      </div>
      <p className={cn('text-[11px] mt-0.5', active ? 'text-white/75' : 'text-caption')}>{hint}</p>
    </button>
  )
}

type DrillDownId = 'categories' | 'migration' | 'plan'

function CategoryOfferingShell({ sessionId }: { sessionId: string }) {
  const [aiResult, setAiResult] = useState<AiBuyingCategoriesResult | null>(null)
  const [highlightCategoryIdx, setHighlightCategoryIdx] = useState<number | null>(null)
  const [drillDown, setDrillDown] = useState<DrillDownId | null>(null)
  const [data, setData] = useState<BuyingChannelData | null>(null)

  useEffect(() => {
    api.getBuyingChannel(sessionId).then(setData).catch(() => {})
  }, [sessionId])

  // ── Computed top-line numbers (defensive defaults if data not yet loaded) ──
  const sl = data?.slider
  const allRows = data?.mg_rows ?? []
  const totalSpendCr = allRows.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalVendors = allRows.reduce((s, r) => s + (r.vendor_count ?? 0), 0)
  const maverickSpendCr = allRows
    .filter(r => /spot|rfq/i.test(r.current_channel) && !/rc|asl/i.test(r.current_channel))
    .reduce((s, r) => s + (r.spend ?? 0), 0)
  const asisRC = sl?.asis_rc_pct ?? 0
  const asisRFQ = sl?.asis_rfq_pct ?? 0
  const tobeRC = sl?.tobe_rc_pct ?? 60
  const asisContractedPct = (sl?.asis_rc_pct ?? 0) + (sl?.asis_asl_pct ?? 0)
  const tobeContractedPct = (sl?.tobe_rc_pct ?? 60) + (sl?.tobe_asl_pct ?? 15)
  const coverageDelta = tobeContractedPct - asisContractedPct
  const tobeWTAT = sl
    ? (sl.tobe_rc_pct / 100) * sl.rc_tat + (sl.tobe_asl_pct / 100) * sl.asl_tat + (sl.tobe_rfq_pct / 100) * sl.rfq_tat
    : 0
  const tatReductionPct = sl && sl.asis_tat > 0 ? ((sl.asis_tat - tobeWTAT) / sl.asis_tat) * 100 : 0
  const tatAlreadyStrong = !!sl && sl.asis_tat > 0 && tobeWTAT >= sl.asis_tat
  // Savings band — same heuristic as the simulator
  const rcGain = Math.max(0, (sl?.tobe_rc_pct ?? 0) - (sl?.asis_rc_pct ?? 0))
  const aslGain = Math.max(0, (sl?.tobe_asl_pct ?? 0) - (sl?.asis_asl_pct ?? 0))
  const lowSav  = (rcGain / 100) * totalSpendCr * 0.02 + (aslGain / 100) * totalSpendCr * 0.01
  const highSav = (rcGain / 100) * totalSpendCr * 0.04 + (aslGain / 100) * totalSpendCr * 0.02

  const aiCategoryCount = aiResult?.categories?.length ?? null
  const totalMgs = data?.total_mgs ?? allRows.length

  // MG → AI category mapping (used by the migration drill-down)
  const mgToCategory: Record<string, MgCategoryMapping> = (() => {
    const map: Record<string, MgCategoryMapping> = {}
    if (!aiResult?.categories) return map
    aiResult.categories.forEach((cat, idx) => {
      cat.material_groups?.forEach((mg) => {
        if (mg.code) {
          map[String(mg.code).trim()] = {
            categoryName: cat.name,
            categoryIdx: idx,
            kraljic: cat.kraljic_quadrant,
            channel: cat.sourcing_strategy,
          }
        }
      })
    })
    return map
  })()

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-caption py-6">
        <Loader2 size={14} className="animate-spin text-brand-purple" /> Reading your PO data…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <div className="acc-card border-l-4 border-l-amber-500 py-4 px-5">
        <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">The problem</p>
        <p className="text-base text-brand-dark mt-1.5 leading-relaxed">
          <strong className="font-bold">{Math.round(asisRFQ)}%</strong> of your{' '}
          <strong className="font-bold">{formatCr(totalSpendCr)}</strong> spend is bought via spot/RFQ across{' '}
          <strong className="font-bold">{totalVendors.toLocaleString()} vendors</strong>.
          That's <strong className="text-amber-700 font-bold">{formatCr(maverickSpendCr)} of maverick spend</strong>{' '}
          and{' '}
          {highSav > 0 ? (
            <strong className="text-amber-700 font-bold">₹{formatIndianInt(lowSav)}–{formatIndianInt(highSav)} Cr of addressable savings</strong>
          ) : (
            <strong className="text-amber-700 font-bold">addressable savings</strong>
          )}{' '}
          you're leaving on the table every year.
        </p>
      </div>

      {/* ── THE FIX ──────────────────────────────────────────────────────── */}
      <div className="acc-card border-l-4 border-l-brand-purple py-4 px-5">
        <p className="text-[10px] uppercase tracking-widest text-brand-purple font-bold">The fix — two changes</p>
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-purple text-white text-xs font-black flex items-center justify-center flex-shrink-0">①</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-brand-dark">Re-group</p>
              <p className="text-sm text-brand-dark/80 leading-snug">
                <strong>{totalMgs} SAP material groups</strong> →{' '}
                <strong className="text-brand-purple">{aiCategoryCount ?? '~8'} strategic categories</strong>{' '}
                <span className="text-caption">(positioned by spend × supply complexity, with buying channel per category)</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-purple text-white text-xs font-black flex items-center justify-center flex-shrink-0">②</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-brand-dark">Re-channel</p>
              <p className="text-sm text-brand-dark/80 leading-snug">
                <strong>{Math.round(asisRC)}% RC today</strong> →{' '}
                <strong className="text-green-700">{Math.round(tobeRC)}% RC target</strong>{' '}
                <span className="text-caption">(consolidate top-3 leverage categories first)</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── THE RESULT ───────────────────────────────────────────────────── */}
      <div className="bg-brand-dark text-white rounded-xl px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold mb-3">The result — after channel migration</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-3xl font-black text-green-300 leading-none">
              ₹{formatIndianInt(lowSav)}–{formatIndianInt(highSav)}
              <span className="text-base text-green-300/70 ml-1 font-normal">Cr</span>
            </p>
            <p className="text-xs text-white/70 mt-1.5">addressable savings</p>
          </div>
          <div className="md:border-l border-white/15 md:pl-5">
            <p className="text-3xl font-black text-green-300 leading-none">
              +{coverageDelta.toFixed(0)}<span className="text-base text-green-300/70 ml-1 font-normal">pp</span>
            </p>
            <p className="text-xs text-white/70 mt-1.5">contract coverage</p>
          </div>
          <div className="md:border-l border-white/15 md:pl-5">
            {tatAlreadyStrong ? (
              <>
                <p className="text-2xl font-black text-green-300 leading-none">Already strong</p>
                <p className="text-xs text-white/70 mt-1.5">cycle time — protect, don't optimise</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-green-300 leading-none">
                  −{tatReductionPct.toFixed(0)}<span className="text-base text-green-300/70 ml-1 font-normal">%</span>
                </p>
                <p className="text-xs text-white/70 mt-1.5">cycle time</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── THE PLAN ─────────────────────────────────────────────────────── */}
      <div className="acc-card border-l-4 border-l-green-500 py-4 px-5">
        <p className="text-[10px] uppercase tracking-widest text-green-700 font-bold">The plan</p>
        <p className="text-base text-brand-dark mt-1 mb-3">
          Sequence → Negotiate → Operationalise · <span className="text-caption">3 phases, incrementally expanding category coverage</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <DrillButton
            label="See the new categories"
            hint="AI categories + channel rationale per category"
            active={drillDown === 'categories'}
            onClick={() => setDrillDown((d) => (d === 'categories' ? null : 'categories'))}
          />
          <DrillButton
            label="Open the migration plan"
            hint="Channel sliders + MG drill-down"
            active={drillDown === 'migration'}
            onClick={() => setDrillDown((d) => (d === 'migration' ? null : 'migration'))}
          />
          <DrillButton
            label="See the execution plan"
            hint="Sequence → Negotiate → Operationalise"
            active={drillDown === 'plan'}
            onClick={() => setDrillDown((d) => (d === 'plan' ? null : 'plan'))}
          />
        </div>
      </div>

      {/* ── DRILL-DOWN PANELS ────────────────────────────────────────────── */}
      <AnimatePresence initial={false} mode="wait">
        {drillDown === 'categories' && (
          <motion.div
            key="dd-categories"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Buying channel logic — classification cascade + archetype outcomes */}
            <BuyingChannelFlowchart />

            {aiResult && aiResult.categories?.length > 0 && (
              <KraljicMatrix
                categories={aiResult.categories}
                highlightIdx={highlightCategoryIdx}
                onCategoryClick={(idx) => setHighlightCategoryIdx(idx === highlightCategoryIdx ? null : idx)}
              />
            )}
            <AiBuyingCategories
              sessionId={sessionId}
              onResult={setAiResult}
              highlightIdx={highlightCategoryIdx}
              onCategoryClick={(idx) => setHighlightCategoryIdx(idx === highlightCategoryIdx ? null : idx)}
            />
          </motion.div>
        )}
        {drillDown === 'migration' && (
          <motion.div
            key="dd-migration"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <CostTakeoutPanel
              sessionId={sessionId}
              mgToCategory={mgToCategory}
              highlightCategoryIdx={highlightCategoryIdx}
              onClearHighlight={() => setHighlightCategoryIdx(null)}
              hideDecisionTree
              hideBaseline
            />
          </motion.div>
        )}
        {drillDown === 'plan' && (
          <motion.div
            key="dd-plan"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <NinetyDayRoadmap />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 90-Day Execution Roadmap ──────────────────────────────────────────────────
// Closes the Category Offering with a concrete sequence: Sequence → Negotiate →
// Operationalise. The story arc completes here.

function NinetyDayRoadmap() {
  const phases = [
    {
      id: 1,
      window: 'Phase 1',
      title: 'Sequence',
      tone: 'border-l-brand-purple bg-purple-50/40',
      pill: 'bg-brand-purple text-white',
      tasks: [
        'Agree target categories with CPO and category leads',
        'Lock the top-3 spend categories from the AI category structure',
        'Baseline data audit — RC coverage, supplier count, maverick % per category',
        'Confirm savings target and measurement approach with Finance',
      ],
    },
    {
      id: 2,
      window: 'Phase 2',
      title: 'Negotiate',
      tone: 'border-l-brand-purple bg-purple-50/40',
      pill: 'bg-brand-purple text-white',
      tasks: [
        'Issue RFQs / RFPs for the top-3 categories',
        'Award annual rate contracts to 2–3 preferred vendors per category',
        'Set up PR-to-RC compliance gate in SAP / source system',
        'Migrate ASL items into the catalogue',
      ],
    },
    {
      id: 3,
      window: 'Phase 3',
      title: 'Operationalise',
      tone: 'border-l-green-500 bg-green-50/40',
      pill: 'bg-green-600 text-white',
      tasks: [
        'Track RC adoption and TAT weekly; report deltas to CPO',
        'Refine the AI category structure with realised spend (re-run)',
        'Quantify and report addressable savings vs baseline',
        'Expand to next 5 categories (months 4–6 plan)',
      ],
    },
  ]
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-bg-secondary/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-caption font-bold">Channel Migration Execution Plan</p>
            <h4 className="text-sm font-bold text-brand-dark">Sequence → Negotiate → Operationalise</h4>
          </div>
          <span className="text-[11px] text-caption">
            Cadence: Weekly category review with CPO
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {phases.map((p) => (
          <div key={p.id} className={cn('p-4 border-l-4', p.tone)}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center', p.pill)}>
                {p.id}
              </span>
              <div>
                <p className="text-[10px] text-caption font-semibold uppercase tracking-wide">{p.window}</p>
                <p className="text-sm font-bold text-brand-dark leading-none">{p.title}</p>
              </div>
            </div>
            <ul className="space-y-1.5 mt-3">
              {p.tasks.map((t, i) => (
                <li key={i} className="text-[11px] text-brand-dark leading-relaxed flex items-start gap-1.5">
                  <span className="text-brand-purple font-bold flex-shrink-0 mt-0.5">▸</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Full-Page Offering Detail ─────────────────────────────────────────────────

function OfferingDetail({
  offering,
  kpiAssessment,
  sessionId,
  engagement,
  dimResults,
  onClose,
}: {
  offering: typeof OFFERINGS[0]
  kpiAssessment: KPIAssessmentResult | null
  sessionId: string
  engagement: Engagement
  dimResults: DimensionResult[]
  onClose: () => void
}) {
  const fte = engagement.fte_count ?? 20

  const renderContent = () => {
    switch (offering.id) {
      case 'op_model': return <OpModelPanel sessionId={sessionId} fte={fte} />
      case 'process': return <ProcessDesignPanel sessionId={sessionId} />
      case 'category_offering': return <CategoryOfferingShell sessionId={sessionId} />
      case 'tech': return <ZCurvePanel />
      case 'srm': return <SRMPanel />
      case 'capability': return <CapabilityPanel dimResults={dimResults} />
      default: return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      {/* Header */}
      <div className="bg-brand-dark rounded-xl px-6 py-5 mb-6 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-3 transition-colors"
          >
            <ChevronRightIcon size={12} className="rotate-180" /> Back to all offerings
          </button>
          <p className="text-white/60 text-xs mb-1 flex items-center gap-1"><Clock size={11} /> {offering.timeline} engagement</p>
          <h2 className="text-white font-bold text-2xl leading-tight mb-2 flex items-center gap-3">
            {(() => { const I = OFFERING_ICONS[offering.id]; return I ? <I size={28} className="opacity-90" /> : null })()}
            {offering.title}
          </h2>
          <p className="text-white/75 text-sm max-w-2xl mb-3">{offering.desc}</p>

          {offering.id === 'category_offering' ? (
            // For Category Offering, the BeforeAfterStrip below carries the outcome story.
            // The header just sets the frame in one line — no static benefit pills.
            <p className="text-white/80 text-xs italic mt-1">
              From spot-led buying to category-led strategy. Two changes get you there: re-categorisation and channel migration.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {offering.benefits.map((b, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full">
                  <span className="text-green-300 font-bold">✓</span> {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors ml-4 flex-shrink-0 p-1"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Full-width content */}
      <div className="w-full">
        {renderContent()}
      </div>
    </motion.div>
  )
}

// ── AI Buying Categories Panel ────────────────────────────────────────────────

interface AiCategory {
  name: string
  description: string
  sourcing_strategy: string
  complexity: string
  spend_cr: number
  spend_pct: number
  material_groups: { code: string; name: string; spend_cr: number; rationale: string }[]
  rationale: string
  recommended_actions: string[]
  // ── Enriched fields (Pass 2) — backend may not yet populate these; UI is defensive ──
  kraljic_quadrant?: 'Strategic' | 'Leverage' | 'Bottleneck' | 'Non-critical' | string
  supplier_count?: number
  hhi?: number                        // 0–10000; <1500 = fragmented, >2500 = concentrated
  maverick_spend_cr?: number          // spot/RFQ-only spend within this category
  savings_target_low_cr?: number
  savings_target_high_cr?: number
  channel_rationale?: string          // why THIS channel for THIS category, evidence-anchored
  market_notes?: string               // oligopoly vs fragmented, demand variability, etc
}

interface AiBuyingCategoriesResult {
  categories: AiCategory[]
  taxonomy_notes: string
  uncategorized: string[]
  source: string
  total_spend_cr: number
}

function AiBuyingCategories({
  sessionId,
  onResult,
  highlightIdx = null,
  onCategoryClick,
}: {
  sessionId: string
  onResult?: (r: AiBuyingCategoriesResult | null) => void
  highlightIdx?: number | null
  onCategoryClick?: (idx: number) => void
}) {
  const [result, setResult] = useState<AiBuyingCategoriesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [open, setOpen] = useState(true)

  const generate = async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/ai-buying-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_refresh: forceRefresh }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Generation failed' }))
        throw new Error(err.detail || 'Failed')
      }
      const d = await res.json()
      setResult(d.categories)
      onResult?.(d.categories)
      setOpen(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const strategyColor = (s: string) =>
    s === 'RC' ? 'bg-green-100 text-green-800 border-green-200'
    : s === 'RFQ' ? 'bg-blue-100 text-blue-800 border-blue-200'
    : s === 'ASL' ? 'bg-purple-100 text-purple-800 border-purple-200'
    : 'bg-gray-100 text-gray-700 border-gray-200'

  const complexityColor = (c: string) =>
    c === 'High' ? 'text-red-700' : c === 'Medium' ? 'text-amber-700' : 'text-green-700'

  const kraljicStyle = (q?: string) => {
    switch (q) {
      case 'Strategic':    return 'bg-red-50 text-red-800 border-red-200'
      case 'Leverage':     return 'bg-purple-50 text-brand-purple border-brand-purple/30'
      case 'Bottleneck':   return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Non-critical': return 'bg-gray-50 text-gray-700 border-gray-200'
      default:             return 'bg-bg-secondary text-caption border-bg-secondary'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-600" />
          <span className="text-sm font-bold text-brand-dark">AI Buying Category Intelligence</span>
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium border border-amber-200">
            Reads full PO dump
          </span>
          {result && (
            <span className="text-[10px] bg-purple-100 text-brand-purple px-1.5 py-0.5 rounded font-medium">✨ Gemini AI</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button
                onClick={() => generate(true)}
                disabled={loading}
                className="text-[11px] text-caption hover:text-brand-purple border border-gray-200 rounded px-2 py-1 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => setOpen(v => !v)} className="text-caption hover:text-brand-dark">
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
          {!result && (
            <button
              onClick={() => generate()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              {loading
                ? <><RefreshCw size={11} className="animate-spin" /> Analysing PO data…</>
                : <><Sparkles size={11} /> Generate Category Structure</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Prompt */}
      {!result && !loading && !error && (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-caption">
            AI reads your entire PO data, analyses material groups by spend and buying behaviour, and suggests a strategic buying category structure with recommended sourcing channels.
          </p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence initial={false}>
        {open && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4">
              {/* Summary */}
              {result.taxonomy_notes && (
                <p className="text-sm text-brand-dark mb-4 leading-relaxed">{result.taxonomy_notes}</p>
              )}

              {/* Category cards */}
              <div className="space-y-2">
                {result.categories?.map((cat, i) => (
                  <div key={i} className={cn(
                    'border rounded-xl overflow-hidden transition-colors',
                    highlightIdx === i
                      ? 'border-brand-purple ring-2 ring-brand-purple/30'
                      : 'border-gray-200',
                  )}>
                    {/* Category header */}
                    <button
                      onClick={() => {
                        setExpanded(expanded === i ? null : i)
                        onCategoryClick?.(i)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                        highlightIdx === i
                          ? 'bg-purple-50 hover:bg-purple-100'
                          : 'bg-gray-50 hover:bg-gray-100',
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-purple/10 text-brand-purple font-black text-sm flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-brand-dark">{cat.name}</span>
                          {cat.kraljic_quadrant && (
                            <span className={`text-[10px] border px-1.5 py-0.5 rounded font-semibold ${kraljicStyle(cat.kraljic_quadrant)}`}>
                              {cat.kraljic_quadrant}
                            </span>
                          )}
                          <span className={`text-[10px] border px-1.5 py-0.5 rounded font-semibold ${strategyColor(cat.sourcing_strategy)}`}>
                            Channel: {cat.sourcing_strategy}
                          </span>
                          <span className={`text-[10px] font-semibold ${complexityColor(cat.complexity)}`}>
                            {cat.complexity} complexity
                          </span>
                        </div>
                        <p className="text-[11px] text-caption mt-0.5">{cat.description}</p>
                        {/* Stat strip — supplier count, HHI, maverick spend, savings target */}
                        {(cat.supplier_count != null || cat.hhi != null || cat.maverick_spend_cr != null || cat.savings_target_high_cr != null) && (
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-caption flex-wrap">
                            {cat.supplier_count != null && (
                              <span><span className="font-semibold text-brand-dark">{cat.supplier_count}</span> suppliers</span>
                            )}
                            {cat.hhi != null && (
                              <span title="Herfindahl-Hirschman Index. <1500 = fragmented, >2500 = concentrated.">
                                HHI <span className="font-semibold text-brand-dark">{cat.hhi}</span>
                                <span className="ml-1 italic opacity-70">({cat.hhi < 1500 ? 'fragmented' : cat.hhi > 2500 ? 'concentrated' : 'moderate'})</span>
                              </span>
                            )}
                            {cat.maverick_spend_cr != null && cat.maverick_spend_cr > 0 && (
                              <span className="text-amber-700">
                                Maverick <span className="font-semibold">{formatCr(cat.maverick_spend_cr)}</span>
                              </span>
                            )}
                            {cat.savings_target_high_cr != null && (
                              <span className="text-green-700 font-semibold">
                                Savings ₹{formatIndianInt((cat.savings_target_low_cr ?? 0))}–{formatIndianInt(cat.savings_target_high_cr)} Cr
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-brand-dark">{formatCr(cat.spend_cr)}</p>
                        <p className="text-[10px] text-caption">{cat.spend_pct?.toFixed(0)}% of spend</p>
                      </div>
                      {expanded === i ? <ChevronUp size={14} className="text-caption flex-shrink-0" /> : <ChevronDown size={14} className="text-caption flex-shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence initial={false}>
                      {expanded === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                            <p className="text-xs text-gray-600 leading-relaxed">{cat.rationale}</p>

                            {/* Channel rationale — why THIS channel for THIS category */}
                            {cat.channel_rationale && (
                              <div className="bg-purple-50 border-l-4 border-l-brand-purple rounded px-3 py-2">
                                <p className="text-[10px] text-brand-purple font-bold uppercase tracking-wide mb-1">
                                  Why {cat.sourcing_strategy} for this category
                                </p>
                                <p className="text-[11px] text-brand-dark leading-relaxed">{cat.channel_rationale}</p>
                              </div>
                            )}

                            {/* Market notes */}
                            {cat.market_notes && (
                              <div className="bg-amber-50/60 border border-amber-100 rounded px-3 py-2">
                                <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wide mb-1">
                                  Supply-market notes
                                </p>
                                <p className="text-[11px] text-brand-dark leading-relaxed">{cat.market_notes}</p>
                              </div>
                            )}

                            {/* Material groups */}
                            {cat.material_groups?.length > 0 && (
                              <div>
                                <p className="text-[10px] text-brand-dark font-bold uppercase tracking-wide mb-2">Material Groups ({cat.material_groups.length})</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {cat.material_groups.map((mg, j) => (
                                    <div key={j} className="bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-2">
                                      <div className="flex items-start justify-between gap-1">
                                        <div>
                                          <span className="text-[10px] font-bold text-brand-dark">{mg.code}</span>
                                          {mg.name && <span className="text-[10px] text-caption ml-1">— {mg.name}</span>}
                                        </div>
                                        <span className="text-[10px] font-semibold text-brand-purple flex-shrink-0">{formatCr(mg.spend_cr)}</span>
                                      </div>
                                      {mg.rationale && <p className="text-[9px] text-caption mt-0.5">{mg.rationale}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recommended actions */}
                            {cat.recommended_actions?.length > 0 && (
                              <div>
                                <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1">Recommended Actions</p>
                                <ul className="space-y-1">
                                  {cat.recommended_actions.map((a, k) => (
                                    <li key={k} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                                      <span className="text-green-500 mt-0.5 flex-shrink-0">→</span>{a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Uncategorized */}
              {result.uncategorized?.length > 0 && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-caption font-bold mb-1">Uncategorized items</p>
                  <p className="text-[11px] text-caption">{result.uncategorized.join(', ')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  kpiAssessment: KPIAssessmentResult | null
  sessionId: string
  engagement: Engagement
  dimResults?: DimensionResult[]
}

export default function OfferingsTab({ kpiAssessment, sessionId, engagement, dimResults = [] }: Props) {
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const kpiResults = kpiAssessment?.kpi_results
  const activeOffering = OFFERINGS.find(o => o.id === activePanel)

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (activePanel && activeOffering) {
    return (
      <AnimatePresence mode="wait">
        <OfferingDetail
          key={activePanel}
          offering={activeOffering}
          kpiAssessment={kpiAssessment}
          sessionId={sessionId}
          engagement={engagement}
          dimResults={dimResults}
          onClose={() => setActivePanel(null)}
        />
      </AnimatePresence>
    )
  }

  // ── Grid view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-5">
        <div className="page-header rounded-lg px-5 py-4 mb-3">
          <h2 className="text-white font-bold text-lg">Accenture Procurement Offerings</h2>
          <p className="text-white/70 text-sm mt-0.5">Tailored interventions based on your assessment results. Click any card to explore the detailed artefact.</p>
        </div>
        <p className="text-xs text-caption">Cards highlighted in purple are triggered by identified KPI gaps.</p>
      </div>

      {/* AI panels */}
      <AiInsightsMini sessionId={sessionId} context="offerings" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...OFFERINGS]
          .sort((a, b) => {
            if (a.isPlaceholder) return 1
            if (b.isPlaceholder) return -1
            const aT = isTriggered(a, kpiResults) ? 0 : 1
            const bT = isTriggered(b, kpiResults) ? 0 : 1
            return aT - bT
          })
          .map(offering => {
            const triggered = isTriggered(offering, kpiResults)
            const Icon = OFFERING_ICONS[offering.id]

            // ── Placeholder card (e.g. Cost Takeout) ──
            if (offering.isPlaceholder) {
              return (
                <div
                  key={offering.id}
                  className="acc-card border-2 border-dashed border-gray-200 relative overflow-hidden opacity-45 select-none"
                >
                  <div className="absolute top-3 right-3">
                    <span className="inline-block bg-gray-200 text-gray-500 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                      Coming Soon
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gray-100">
                    {Icon && <Icon size={20} className="text-gray-300" />}
                  </div>
                  <h4 className="text-sm font-bold leading-tight mb-1 pr-24 text-gray-400">{offering.title}</h4>
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 bg-gray-100 text-gray-300">
                    <Clock size={10} className="inline mr-0.5" />{offering.timeline}
                  </span>
                  <p className="text-xs leading-relaxed text-gray-300">{offering.desc}</p>
                  <div className="mt-4 p-2 bg-gray-50 rounded border border-dashed border-gray-200 text-center">
                    <p className="text-[10px] text-caption font-medium">Artefact under development</p>
                  </div>
                </div>
              )
            }

            // ── Standard offering card ──
            return (
              <motion.div
                key={offering.id}
                whileHover={{ scale: triggered ? 1.02 : 1.01, boxShadow: triggered ? '0 4px 24px rgba(161,0,255,0.18)' : '0 2px 12px rgba(0,0,0,0.06)' }}
                onClick={() => setActivePanel(offering.id)}
                className={cn(
                  'acc-card cursor-pointer border-2 transition-all relative overflow-hidden',
                  triggered
                    ? 'border-brand-purple'
                    : 'border-bg-secondary opacity-60 hover:opacity-80 hover:border-gray-300'
                )}
              >
                {/* Relevance badge */}
                <div className="absolute top-3 right-3">
                  {triggered ? (
                    <span className="inline-block bg-brand-purple text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-wide shadow-sm">
                      Recommended
                    </span>
                  ) : (
                    <span className="inline-block bg-gray-100 text-gray-400 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                      Not triggered
                    </span>
                  )}
                </div>

                {/* Icon */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                  triggered ? 'bg-brand-purple/10' : 'bg-gray-100'
                )}>
                  {Icon && <Icon size={20} className={triggered ? 'text-brand-purple' : 'text-gray-400'} />}
                </div>

                <h4 className={cn('text-sm font-bold leading-tight mb-1 pr-24', triggered ? 'text-brand-dark' : 'text-gray-500')}>
                  {offering.title}
                </h4>

                <span className={cn(
                  'inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2',
                  triggered ? 'bg-bg-secondary text-brand-dark' : 'bg-gray-100 text-gray-400'
                )}>
                  ⏱ {offering.timeline}
                </span>

                <p className={cn('text-xs leading-relaxed', triggered ? 'text-caption' : 'text-gray-400')}>
                  {offering.desc}
                </p>

                {/* Benefits preview — only for triggered */}
                {triggered && (
                  <div className="mt-3 space-y-1.5">
                    {offering.benefits.slice(0, 2).map((b, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-[11px] text-green-700">
                        <span className="flex-shrink-0 mt-0.5 font-bold">✓</span>
                        <span>{b}</span>
                      </p>
                    ))}
                    {offering.benefits.length > 2 && (
                      <p className="text-[11px] text-caption">+{offering.benefits.length - 2} more benefits</p>
                    )}
                  </div>
                )}

                {/* Triggered KPI tags */}
                {triggered && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {offering.triggerKpis
                      .filter(k => kpiResults?.[k]?.has_gap)
                      .map(k => (
                        <span key={k} className="inline-block bg-red-50 text-red-700 border border-red-100 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                  </div>
                )}

                <p className={cn('text-xs font-semibold mt-3', triggered ? 'text-brand-purple' : 'text-gray-400')}>
                  Click to explore →
                </p>
              </motion.div>
            )
          })}
      </div>

      {/* ── Agentic AI Use-Cases catalogue ───────────────────────────────────── */}
      <div className="mt-8">
        <div className="page-header rounded-lg px-5 py-4 mb-4">
          <h2 className="text-white font-bold text-lg">Agentic AI Use-Cases</h2>
          <p className="text-white/70 text-sm mt-0.5">
            Explore the full S2P agentic use-case catalogue and build a quantified business case for any agent.
          </p>
        </div>
        <AiUsecasesTab sessionId={sessionId} />
      </div>
    </div>
  )
}
```

---
