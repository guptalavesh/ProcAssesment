import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import type { DashboardData, KpiData } from '@/lib/types'
import { cn, scoreColor, formatPct, formatCr } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

interface Props { sessionId: string }

const KPI_ORDER = [
  'tat_pr_to_po', 'rc_adoption_volume', 'rc_adoption_value', 'supplier_otd',
  'savings_lpo', 'pac_prs', 'emergency_prs', 'tail_spend_pct',
  'spend_per_fte', 'proc_spend', 'pareto_vendors',
]

function formatKpiValue(kpi: KpiData): string {
  if (kpi.value == null) return '—'
  if (kpi.unit === '%') return formatPct(kpi.value)
  if (kpi.unit === 'days') return `${Math.round(kpi.value)} d`
  if (kpi.unit === '₹ Cr') return formatCr(kpi.value)
  return Math.round(kpi.value).toString()
}

function formatBench(kpi: KpiData): string {
  if (kpi.benchmark == null) return '—'
  if (kpi.unit === '%') return formatPct(kpi.benchmark)
  if (kpi.unit === 'days') return `${Math.round(kpi.benchmark)} d`
  if (kpi.unit === '₹ Cr') return formatCr(kpi.benchmark)
  return Math.round(kpi.benchmark).toString()
}

function gapColor(kpi: KpiData): string {
  if (kpi.value == null || kpi.benchmark == null) return 'text-caption'
  const isAbove = kpi.direction === 'higher_is_better' ? kpi.value >= kpi.benchmark : kpi.value <= kpi.benchmark
  return isAbove ? 'text-green-600' : 'text-red-600'
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  if (!kpi.available) {
    return (
      <div className="acc-card opacity-50 p-3">
        <p className="text-xs font-bold text-caption">{kpi.label}</p>
        <p className="text-sm text-caption mt-1">Not available</p>
      </div>
    )
  }

  const isAbove = kpi.value != null && kpi.benchmark != null
    ? (kpi.direction === 'higher_is_better' ? kpi.value >= kpi.benchmark : kpi.value <= kpi.benchmark)
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="acc-card p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-brand-dark flex-1">{kpi.label}</p>
        {isAbove !== null && (isAbove
          ? <TrendingUp size={12} className="text-green-600" />
          : <TrendingDown size={12} className="text-red-600" />)}
      </div>
      <p className={cn('text-2xl font-black', gapColor(kpi))}>{formatKpiValue(kpi)}</p>
      <p className="text-[10px] text-caption mt-0.5">vs benchmark <span className="font-mono">{formatBench(kpi)}</span></p>
      {kpi.confidence && (
        <span className={cn('text-[9px] inline-block mt-1 px-1.5 py-0.5 rounded font-semibold',
          kpi.confidence === 'high' ? 'bg-green-100 text-green-700'
          : kpi.confidence === 'medium' ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
        )}>
          {kpi.confidence} confidence
        </span>
      )}
    </motion.div>
  )
}

function TrendChart({ kpi }: { kpi: KpiData }) {
  if (!kpi.trend || kpi.trend.length === 0) return null
  return (
    <div className="acc-card mb-3">
      <p className="text-xs font-bold text-brand-dark mb-2">{kpi.label} — Monthly Trend</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={kpi.trend}>
          <CartesianGrid stroke="#f0eeed" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#a100ff" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function VendorPareto({ kpi }: { kpi: KpiData }) {
  if (!kpi.by_vendor || kpi.by_vendor.length === 0) return null
  const data = kpi.by_vendor.slice(0, 10)
  return (
    <div className="acc-card">
      <p className="text-xs font-bold text-brand-dark mb-2">Top 10 Vendor Pareto (₹ Cr)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="#f0eeed" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#460073' }} width={100} />
          <Tooltip />
          <Bar dataKey="value" fill="#a100ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function KpiDashboard({ sessionId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<{ plant?: string; category?: string; purchase_group?: string }>({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (filters.plant) params.plant = filters.plant
      if (filters.category) params.category = filters.category
      if (filters.purchase_group) params.purchase_group = filters.purchase_group
      const res = await api.getKpiDashboard(sessionId, params)
      setData(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, filters.plant, filters.category, filters.purchase_group])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        Icon={AlertCircle}
        title="Could not load dashboard"
        description={error}
        action={
          <button onClick={load} className="text-brand-purple text-sm font-semibold flex items-center gap-1 mx-auto">
            <RefreshCw size={12} /> Retry
          </button>
        }
      />
    )
  }

  if (!data) return null

  const sortedKpis = KPI_ORDER
    .map(id => data.kpis[id])
    .filter(Boolean) as KpiData[]
  const otherKpis = Object.values(data.kpis).filter(k => k && !KPI_ORDER.includes(k.id))
  const allKpis = [...sortedKpis, ...otherKpis]

  const proc = data.kpis['proc_spend']
  const tat = data.kpis['tat_pr_to_po']

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="acc-card py-3 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-brand-purple" />
          <span className="text-xs font-semibold text-brand-dark mr-2">Filters:</span>
          <select
            value={filters.plant || ''}
            onChange={e => setFilters(f => ({ ...f, plant: e.target.value || undefined }))}
            className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
          >
            <option value="">All plants</option>
            {data.filters.plants.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filters.category || ''}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value || undefined }))}
            className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
          >
            <option value="">All categories</option>
            {data.filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.purchase_group || ''}
            onChange={e => setFilters(f => ({ ...f, purchase_group: e.target.value || undefined }))}
            className="text-xs border border-bg-secondary rounded px-2 py-1 focus:outline-none focus:border-brand-purple"
          >
            <option value="">All purchase groups</option>
            {data.filters.purchase_groups.map(pg => <option key={pg} value={pg}>{pg}</option>)}
          </select>
          <span className="ml-auto text-xs text-caption">
            {data.summary.po_count} POs · {data.summary.vendor_count} vendors · ₹{data.summary.total_spend_cr.toFixed(1)} Cr
          </span>
        </div>
        {data.low_confidence && (
          <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1">
            <AlertCircle size={11} /> Low data volume — confidence may be limited
          </p>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {allKpis.map(kpi => <KpiCard key={kpi.id} kpi={kpi} />)}
      </div>

      {/* Trends */}
      {tat && tat.available && tat.trend.length > 0 && <TrendChart kpi={tat} />}

      {/* Vendor pareto */}
      {proc && proc.available && proc.by_vendor.length > 0 && <VendorPareto kpi={proc} />}
    </div>
  )
}
