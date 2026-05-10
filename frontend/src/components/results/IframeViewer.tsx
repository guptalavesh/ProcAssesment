import { useEffect, useState } from 'react'

interface Props {
  html: string
  height?: number
  className?: string
}

export default function IframeViewer({ html, height = 500, className }: Props) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [html])

  if (!src) return null
  return (
    <iframe
      src={src}
      style={{ width: '100%', height, border: 'none' }}
      className={className}
      sandbox="allow-scripts"
    />
  )
}
