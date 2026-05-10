interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="page-header">
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-neutral-900 m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-neutral-500 mt-1">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
