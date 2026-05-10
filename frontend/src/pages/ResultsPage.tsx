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
import { api } from '@/lib/api'
import { useAssessmentStore } from '@/store/assessmentStore'
import type { AssessmentResults, KPIResult } from '@/lib/types'
import { cn, formatCr, formatPct, roundN } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'

function fmtKpiVal(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—'
  if (unit === '₹ Cr')   return formatCr(value)
  if (unit === 'days')   return `${roundN(value)} days`
  if (unit === '%' || unit === '' || unit === 'fraction' || !unit) return formatPct(value * 100)
  return `${roundN(value)} ${unit}`
}

type Tab = 'kpi' | 'dashboard' | 'rca' | 'offerings'

const TAB_PREAMBLES: Record<Tab, string> = {
  kpi:       'Your KPI landscape at a glance. Click any row for the full insight, root cause, and recommended action.',
  dashboard: 'Interactive charts across every bucket and KPI. Filter by bucket using the cards above.',
  rca:       'Systemic drivers behind your gaps, grouped by bucket. The highest-priority bucket is expanded by default.',
  offerings: 'Transformation services mapped to your actual findings — including buying channel logic, agentic AI use-cases and a strategic category structure inferred from your PO data.',
}

function scoreBadgeClass(score: number | null): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-500'
  if (score >= 4) return 'bg-green-100 text-green-800'
  if (score >= 3) return 'bg-blue-100 text-blue-800'
  if (score >= 2) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

function GapIndicator({ gapPct }: { gapPct: number | null; direction?: string }) {
  if (gapPct === null || gapPct === undefined) return <span className="text-caption">—</span>
  // Backend returns gap_pct as a fraction whose SIGN already encodes
  // direction: positive = above benchmark (good), negative = below (gap).
  // Frontend just multiplies by 100 to render a percentage.
  const isAbove = gapPct >= 0
  const pct = Math.min(999, Math.abs(gapPct) * 100)
  const Icon = isAbove ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', isAbove ? 'text-green-600' : 'text-red-600')}>
      <Icon size={11} /> {isAbove ? '+' : '−'}{pct.toFixed(0)}%
    </span>
  )
}

function KpiRow({ kpi, highlighted }: { kpi: KPIResult; highlighted?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (highlighted) setOpen(true)
  }, [highlighted])
  return (
    <>
      <tr
        className={cn(
          'cursor-pointer hover:bg-bg-secondary/60 transition-colors',
          highlighted && 'bg-accent-100 animate-pulse',
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
                    <div className="p-3 bg-accent-50 border border-accent-100 rounded text-xs">
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

function KpiBuckets({
  kpiResults, computedKpis, activeBucket, highlightedKpi,
}: {
  kpiResults: Record<string, KPIResult>
  computedKpis: string[]
  activeBucket: string | null
  highlightedKpi?: string | null
}) {
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [openBuckets, setOpenBuckets] = useState<Set<string>>(new Set())

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
      if (next.has(bucket)) next.delete(bucket); else next.add(bucket)
      return next
    })
  }

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

  useEffect(() => {
    if (!sessionId || !results?.kpi_assessment) return
    const contexts: ('kpi_overview' | 'rca' | 'offerings')[] = ['kpi_overview', 'rca', 'offerings']
    contexts.forEach((ctx) => {
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
        .then((d) => setAiInsight(ctx, d.insights || d))
        .catch((e: any) => setAiError(ctx, e.message))
        .finally(() => setAiLoading(ctx, false))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, results?.kpi_assessment])

  const handleKpiChipClick = (kpiName: string) => {
    setActiveBucket(null)
    setTab('kpi')
    setHighlightedKpi(kpiName)
    setTimeout(() => setHighlightedKpi(null), 2500)
  }

  useEffect(() => {
    if (!sessionId) {
      api.createSession()
        .then(r => setSessionId(r.session_id))
        .catch(() => setLoading(false))
      return
    }
    api.getResults(sessionId)
      .then(r => { setLocalResults(r); setResults(r) })
      .catch(e => {
        const msg: string = e.message
        if (msg.includes('not found or expired')) {
          api.createSession()
            .then(r => setSessionId(r.session_id))
            .catch(() => {})
          setError('Assessment not run yet.')
        } else {
          setError(msg)
        }
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleDownload = async () => {
    if (!sessionId) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/v1/session/${sessionId}/results/report`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `${clientName || 'Assessment'}_Maturity_Assessment.xlsx`,
      })
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(`Proposal export failed: ${e.message}`)
    } finally {
      setDownloadingProposal(false)
    }
  }

  const handleBucketClick = (bucket: string | null) => {
    setActiveBucket(bucket)
    if (bucket !== null && tab !== 'kpi' && tab !== 'rca') {
      setTab('kpi')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-purple" size={32} />
    </div>
  )

  const assessmentNotRun = error === 'Assessment not run yet.'
  if (error && !assessmentNotRun) return (
    <div className="text-center py-12">
      <p className="text-red-600 mb-3">{error}</p>
      <button onClick={() => navigate('/configure')} className="text-brand-purple text-sm underline">← Back</button>
    </div>
  )

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
      {showTimelineModal && sessionId && (
        <ProgramTimelineModal
          sessionId={sessionId}
          onClose={() => setShowTimelineModal(false)}
          onExport={() => { setShowTimelineModal(false); handlePptDownload() }}
          exporting={downloadingPpt}
        />
      )}

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
            className="flex items-center gap-1.5 text-xs border border-brand-purple text-brand-purple px-3 py-1.5 rounded-lg font-semibold hover:bg-accent-50 transition-colors disabled:opacity-60"
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

      {results.kpi_assessment && (
        <KpiBucketCards
          ka={results.kpi_assessment}
          activeBucket={activeBucket}
          onBucketClick={handleBucketClick}
        />
      )}

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
        <p className="text-xs text-caption mb-3 leading-relaxed">{TAB_PREAMBLES[tab]}</p>

        {tab === 'kpi' && (
          <div className="space-y-3">
            {sessionId && <AiInsightsMini sessionId={sessionId} context="kpi_overview" onKpiClick={handleKpiChipClick} />}
            {Object.keys(kpiResults).length > 0
              ? <KpiBuckets kpiResults={kpiResults} computedKpis={computedKpis} activeBucket={activeBucket} highlightedKpi={highlightedKpi} />
              : <p className="text-caption text-sm text-center py-8">No KPI results available.</p>
            }
          </div>
        )}

        {tab === 'dashboard' && sessionId && (
          <KpiDashboard sessionId={sessionId} />
        )}

        {tab === 'rca' && showRca && (
          <div className="space-y-0">
            {sessionId && <AiInsightsMini sessionId={sessionId} context="rca" onKpiClick={handleKpiChipClick} />}
            <RCATab
              kpiAssessment={results.kpi_assessment}
              activeBucket={activeBucket}
            />
          </div>
        )}

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
