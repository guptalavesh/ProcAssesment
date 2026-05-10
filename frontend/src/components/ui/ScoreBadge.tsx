import { cn, scoreBg } from '@/lib/utils'

interface Props {
  score: number | null
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const LABELS: Record<number, string> = { 1: 'Foundation', 2: 'Intermediate', 3: 'Advanced', 4: 'Leading' }

export default function ScoreBadge({ score, label, size = 'sm' }: Props) {
  const displayLabel = label ?? (score !== null ? LABELS[Math.floor(score)] ?? '—' : '—')
  return (
    <span className={cn(
      'score-badge',
      scoreBg(score),
      size === 'sm' && 'text-xs px-2 py-0.5',
      size === 'md' && 'text-sm px-3 py-1',
      size === 'lg' && 'text-base px-4 py-1.5',
    )}>
      {score !== null ? score.toFixed(0) : '—'} {displayLabel}
    </span>
  )
}
