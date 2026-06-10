'use client'

import { useEffect, useRef, useState } from 'react'

/** Плавно «докручивает» число до target за duration мс (easeOutCubic). */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplay(from + (target - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = target
    }
  }, [target, duration])

  return display
}
