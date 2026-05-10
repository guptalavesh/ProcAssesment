import { useEffect, useRef, useState } from 'react'

interface Props {
  target: number | null
  duration?: number
  decimals?: number
  className?: string
}

export default function AnimatedCounter({ target, duration = 1200, decimals = 0, className }: Props) {
  const [display, setDisplay] = useState('—')
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === null) { setDisplay('—'); return }
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay((target * eased).toFixed(decimals))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, decimals])

  return <span className={className}>{display}</span>
}
