import { describe, expect, it } from 'vitest'
import RAW from '@/data/usdkzt.json'
import { SEGMENT_DAYS, type RatePoint } from './engine'

const DATA = RAW as RatePoint[]

describe('data/usdkzt.json — реальные курсы НБ РК', () => {
  it('не меньше 2500 точек', () => {
    expect(DATA.length).toBeGreaterThanOrEqual(2500)
  })

  it('покрывает 2013–2025 и отсортирован строго по дате', () => {
    expect(DATA[0].d <= '2013-01-05').toBe(true)
    expect(DATA[DATA.length - 1].d >= '2025-12-01').toBe(true)
    for (let i = 1; i < DATA.length; i++) {
      expect(DATA[i].d > DATA[i - 1].d).toBe(true)
    }
  })

  it('все значения — правдоподобные курсы', () => {
    for (const p of DATA) {
      expect(p.r).toBeGreaterThan(100)
      expect(p.r).toBeLessThan(600)
      expect(p.d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('август 2015: девальвация на месте (188 → ~255)', () => {
    const before = DATA.find((p) => p.d === '2015-08-20')
    const after = DATA.find((p) => p.d === '2015-08-21')
    expect(before).toBeDefined()
    expect(after).toBeDefined()
    expect(before!.r).toBeLessThan(200)
    expect(after!.r).toBeGreaterThan(230)
  })

  it('хватает на сегмент в любом месте', () => {
    expect(DATA.length).toBeGreaterThan(SEGMENT_DAYS * 10)
  })
})
