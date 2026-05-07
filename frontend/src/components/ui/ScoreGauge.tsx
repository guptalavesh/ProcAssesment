import { useEffect, useState } from 'react'

interface Props {
  score: number
  size?: number
  variant?: 'on-dark' | 'on-light'
}

export default function ScoreGauge({ score, size = 96, variant = 'on-dark' }: Props) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const duration = 900
    const target = Math.min(Math.max(score, 0), 4)

    const step = (ts: number) => {
      if (!start) start = ts
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimated(target * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const strokeW = size * 0.09

  const totalAngle = 270
  const startAngle = 135
  const fraction = animated / 4

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const arcPoint = (angleDeg: number) => ({
    x: cx + r * Math.cos(toRad(angleDeg)),
    y: cy + r * Math.sin(toRad(angleDeg)),
  })

  const describeArc = (startDeg: number, endDeg: number) => {
    const s = arcPoint(startDeg)
    const e = arcPoint(endDeg)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  const trackEnd = startAngle + totalAngle
  const fillEnd = startAngle + totalAngle * fraction

  const trackStroke = variant === 'on-dark' ? 'rgba(255,255,255,0.20)' : 'rgba(70,0,115,0.12)'
  const fillStroke  = variant === 'on-dark' ? 'rgba(255,255,255,0.90)' : '#a100ff'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <path
        d={describeArc(startAngle, trackEnd)}
        fill="none"
        stroke={trackStroke}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {fraction > 0.01 && (
        <path
          d={describeArc(startAngle, fillEnd)}
          fill="none"
          stroke={fillStroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
