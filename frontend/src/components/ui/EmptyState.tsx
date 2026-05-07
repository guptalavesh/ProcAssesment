import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  Icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('text-center py-10 px-4', className)}>
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-full bg-bg-secondary/60 flex items-center justify-center mb-3">
          <Icon size={22} className="text-brand-purple" />
        </div>
      )}
      <p className="text-sm font-semibold text-brand-dark mb-1">{title}</p>
      {description && <p className="text-xs text-caption max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
