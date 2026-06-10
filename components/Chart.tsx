'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { VISIBLE_DAYS, type RatePoint } from '@/lib/engine'

/**
 * Даты скрыты до конца игры: время кодируем фиктивной базой,
 * подписи оси — «День N» от начала сегмента.
 */
const DAY = 86_400
const BASE_TS = 1_600_000_000

const toTime = (i: number) => (BASE_TS + i * DAY) as UTCTimestamp
const toDayNum = (t: number) => Math.round((t - BASE_TS) / DAY) + 1

const REVEAL_MS = 750

interface Props {
  /** полный сегмент из 70 точек */
  points: RatePoint[]
  /** сколько точек уже раскрыто (60 на старте, +1 за раунд) */
  revealedCount: number
  /** конец анимации раскрытия новой свечи */
  onRevealDone: () => void
}

export default function Chart({ points, revealedCount, onRevealDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const shownRef = useRef(0)
  const segKeyRef = useRef('')
  const rafRef = useRef(0)
  const onDoneRef = useRef(onRevealDone)
  onDoneRef.current = onRevealDone
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const monoFamily =
      getComputedStyle(document.body).getPropertyValue('--font-mono').trim() || 'monospace'

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#5c6b75',
        fontSize: 10,
        fontFamily: monoFamily,
        attributionLogo: false, // атрибуция TradingView — в README
      },
      grid: {
        vertLines: { color: 'rgba(140, 170, 190, 0.05)' },
        horzLines: { color: 'rgba(140, 170, 190, 0.08)' },
      },
      crosshair: {
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: {
        borderColor: '#1a242c',
        scaleMargins: { top: 0.14, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#1a242c',
        tickMarkFormatter: (t: number) => `День ${toDayNum(t)}`,
      },
      handleScroll: false,
      handleScale: false,
      localization: { priceFormatter: (p: number) => p.toFixed(2) },
    })

    const series = chart.addAreaSeries({
      lineColor: '#00e676',
      topColor: 'rgba(0, 230, 118, 0.2)',
      bottomColor: 'rgba(0, 230, 118, 0)',
      lineWidth: 2,
      priceLineColor: '#2c3c46',
      crosshairMarkerVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series
    shownRef.current = 0
    segKeyRef.current = ''
    setReady(true)

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series || points.length === 0) return

    cancelAnimationFrame(rafRef.current)

    const setRange = (lastIdx: number, shift = 0) => {
      chart.timeScale().setVisibleLogicalRange({
        from: lastIdx - VISIBLE_DAYS + 0.5 + shift,
        to: lastIdx + 0.7 + shift,
      })
    }

    const segKey = `${points[0].d}:${points.length}`
    const shown = shownRef.current
    const isNewSegment = segKey !== segKeyRef.current

    if (isNewSegment || revealedCount < shown) {
      // новая игра — рисуем без анимации
      segKeyRef.current = segKey
      series.setData(points.slice(0, revealedCount).map((p, i) => ({ time: toTime(i), value: p.r })))
      shownRef.current = revealedCount
      setRange(revealedCount - 1)
      return
    }

    if (revealedCount === shown) return

    // раскрытие следующего дня: тянем точку от прошлого закрытия к новому
    if (revealedCount - shown > 1) {
      series.setData(points.slice(0, revealedCount - 1).map((p, i) => ({ time: toTime(i), value: p.r })))
    }
    const targetIdx = revealedCount - 1
    const fromValue = points[targetIdx - 1].r
    const toValue = points[targetIdx].r
    const t0 = performance.now()

    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / REVEAL_MS)
      const eased = 1 - Math.pow(1 - k, 3)
      series.update({ time: toTime(targetIdx), value: fromValue + (toValue - fromValue) * eased })
      setRange(targetIdx - 1, eased)
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        shownRef.current = revealedCount
        onDoneRef.current()
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [points, revealedCount])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        aria-hidden
        className={`skeleton pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-500 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  )
}
