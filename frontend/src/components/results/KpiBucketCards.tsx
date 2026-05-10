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
  'Risk':               ShieldCheck,
  'Risk Management':    ShieldCheck,
  'Cost & Spend':       DollarSign,
  'Cost':               DollarSign,
  'Spend':              BarChart2,
  'Digitization':       Monitor,
  'Digital':            Monitor,
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

        {bucket.score != null && (
          <div className="mt-2 px-1">
            <div className="relative w-full h-1.5 bg-bg-muted rounded-full overflow-visible">
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(bucket.score / 4) * 100}%`, backgroundColor: iconColor }}
              />
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
