interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="page-header flex items-center justify-between">
      <div>
        <h1 className="text-white text-xl font-bold m-0">{title}</h1>
        {subtitle && <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}
