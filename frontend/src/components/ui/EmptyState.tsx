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
    <div className={cn('text-center py-12 px-4', className)}>
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-md bg-accent-50 flex items-center justify-center mb-3">
          <Icon size={20} className="text-accent" />
        </div>
      )}
      <p className="text-[14px] font-semibold text-neutral-900 mb-1">{title}</p>
      {description && <p className="text-[12px] text-neutral-500 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
