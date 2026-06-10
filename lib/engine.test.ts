import { describe, expect, it } from 'vitest'
import {
  HOT_ERAS,
  PLAY_ROUNDS,
  SEGMENT_DAYS,
  START_BALANCE,
  VISIBLE_DAYS,
  applyDelta,
  effectiveStake,
  formatEra,
  isBust,
  mulberry32,
  percentileFor,
  pickSegmentStart,
  roundOutcome,
  segmentFromSeed,
  titleFor,
  type RatePoint,
} from './engine'

/** Синтетический датасет: все будни 2013-01-01 … 2025-12-31, курс не важен. */
function syntheticData(): RatePoint[] {
  const out: RatePoint[] = []
  const cur = new Date('2013-01-01T00:00:00Z')
  const end = new Date('2025-12-31T00:00:00Z')
  let r = 150
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) {
      out.push({ d: cur.toISOString().slice(0, 10), r })
      r += 0.05
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

const DATA = syntheticData()

describe('mulberry32', () => {
  it('детерминирован и лежит в [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)())
  })
})

describe('pickSegmentStart', () => {
  it('всегда оставляет 70 подряд идущих торговых дней', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const start = pickSegmentStart(DATA, mulberry32(seed))
      expect(start).toBeGreaterThanOrEqual(0)
      expect(start + SEGMENT_DAYS).toBeLessThanOrEqual(DATA.length)
    }
  })

  it('детерминирован по seed', () => {
    for (const seed of [1, 7, 123456789, 2 ** 31 - 1]) {
      expect(pickSegmentStart(DATA, mulberry32(seed))).toBe(pickSegmentStart(DATA, mulberry32(seed)))
    }
  })

  it('бросает ошибку на коротких данных', () => {
    expect(() => pickSegmentStart(DATA.slice(0, SEGMENT_DAYS - 1), mulberry32(1))).toThrow()
  })

  it('~30% игр попадают игровыми днями в горячие эпохи', () => {
    const inHotEra = (iso: string) => HOT_ERAS.some(([from, to]) => iso >= from && iso <= to)
    let hot = 0
    const N = 3000
    for (let seed = 0; seed < N; seed++) {
      const start = pickSegmentStart(DATA, mulberry32(seed))
      const playDays = DATA.slice(start + VISIBLE_DAYS, start + SEGMENT_DAYS)
      if (playDays.some((p) => inHotEra(p.d))) hot++
    }
    const share = hot / N
    expect(share).toBeGreaterThan(0.2)
    expect(share).toBeLessThan(0.45)
  })
})

describe('segmentFromSeed', () => {
  it('возвращает ровно 70 точек и совпадает сам с собой', () => {
    const a = segmentFromSeed(DATA, 999)
    const b = segmentFromSeed(DATA, 999)
    expect(a.points).toHaveLength(SEGMENT_DAYS)
    expect(a.startIdx).toBe(b.startIdx)
    expect(a.points[0]).toEqual(DATA[a.startIdx])
  })
})

describe('roundOutcome — математика выплат', () => {
  it('движение +1% при ставке 100k: множитель 0.2 → ±20 000', () => {
    const win = roundOutcome(100, 101, 'up', 100_000)
    expect(win.correct).toBe(true)
    expect(win.amount).toBe(20_000)
    expect(win.delta).toBe(20_000)

    const lose = roundOutcome(100, 101, 'down', 100_000)
    expect(lose.correct).toBe(false)
    expect(lose.delta).toBe(-20_000)
  })

  it('микродвижение упирается в пол 5% от ставки', () => {
    // 0.05% движения × 20 = 1% < пола в 5%
    const o = roundOutcome(200, 200.1, 'up', 100_000)
    expect(o.amount).toBe(5_000)
  })

  it('девальвация бьёт на всю катушку: +26% × 20 = 5.2× ставки', () => {
    // 20.08.2015 → 21.08.2015: 188.38 → 255.26
    const o = roundOutcome(188.38, 255.26, 'down', 100_000)
    expect(o.correct).toBe(false) // ставил на падение доллара — ха
    expect(o.amount).toBe(Math.round(100_000 * ((255.26 - 188.38) / 188.38) * 20))
    expect(o.amount).toBeGreaterThan(500_000)
  })

  it('плоский день засчитывается за «вниз»', () => {
    expect(roundOutcome(150, 150, 'down', 50_000).correct).toBe(true)
    expect(roundOutcome(150, 150, 'up', 50_000).correct).toBe(false)
  })

  it('ставка должна быть положительной', () => {
    expect(() => roundOutcome(100, 101, 'up', 0)).toThrow()
  })
})

describe('банкротство', () => {
  it('баланс не уходит ниже нуля', () => {
    expect(applyDelta(30_000, -500_000)).toBe(0)
    expect(applyDelta(30_000, 500_000)).toBe(530_000)
  })

  it('isBust', () => {
    expect(isBust(0)).toBe(true)
    expect(isBust(1)).toBe(false)
  })

  it('effectiveStake режет ставку по балансу, ALL_IN берёт всё', () => {
    expect(effectiveStake(250_000, 90_000)).toBe(90_000)
    expect(effectiveStake(50_000, 90_000)).toBe(50_000)
    expect(effectiveStake('ALL_IN', 777_777)).toBe(777_777)
  })
})

describe('вердикты и перцентили', () => {
  it('пороги титулов', () => {
    expect(titleFor(2_000_000).title).toBe('Сорос из Астаны')
    expect(titleFor(1_999_999).title).toBe('Брокер с Зелёного базара')
    expect(titleFor(1_200_000).title).toBe('Брокер с Зелёного базара')
    expect(titleFor(1_000_000).title).toBe('Хотя бы не минус')
    expect(titleFor(800_000).title).toBe('Хотя бы не минус')
    expect(titleFor(799_999).title).toBe('Курс тебя съел')
    expect(titleFor(300_000).title).toBe('Курс тебя съел')
    expect(titleFor(0).title).toBe('Февраль 2014 в душе')
  })

  it('перцентиль монотонный и в пределах [0, 100]', () => {
    let prev = -1
    for (let i = 0; i <= PLAY_ROUNDS; i++) {
      const p = percentileFor(i)
      expect(p).toBeGreaterThan(prev)
      expect(p).toBeLessThanOrEqual(100)
      prev = p
    }
  })

  it('formatEra — русский предложный падеж', () => {
    expect(formatEra('2015-08-21')).toBe('августе 2015')
    expect(formatEra('2014-02-11')).toBe('феврале 2014')
  })

  it('стартовый баланс — миллион', () => {
    expect(START_BALANCE).toBe(1_000_000)
  })
})
