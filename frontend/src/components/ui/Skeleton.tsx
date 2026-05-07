import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export default function Skeleton({ className }: Props) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-sm bg-neutral-150',
        className,
      )}
    />
  )
}
