interface Props {
  className?: string
  title?: string
}

export default function AccentureMark({ className, title }: Props) {
  return (
    <svg
      viewBox="0 0 328.0399 360"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={title ?? 'Accenture'}
    >
      <polygon points="0,360 328.0399,226.9993 328.0399,133.0008 0,0 0,93.9987 212.1184,180 0,266.0013" />
    </svg>
  )
}
