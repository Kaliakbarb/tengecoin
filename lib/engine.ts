/**
 * Чистая игровая логика «Теңге Симулятора».
 * Никакого DOM — всё детерминировано от seed, полностью покрыто vitest.
 */

export interface RatePoint {
  /** ISO-дата торгового дня, например "2015-08-21" */
  d: string
  /** официальный курс USD/KZT */
  r: number
}

export type Direction = 'up' | 'down'
export type StakeChoice = 50_000 | 100_000 | 250_000 | 'ALL_IN'

export const VISIBLE_DAYS = 60
export const PLAY_ROUNDS = 10
export const SEGMENT_DAYS = VISIBLE_DAYS + PLAY_ROUNDS // 70
export const START_BALANCE = 1_000_000
export const STAKE_CHOICES: StakeChoice[] = [50_000, 100_000, 250_000, 'ALL_IN']

/** выигрыш = ставка × max(MIN_WIN_RATIO, |дневное движение| × MOVE_MULTIPLIER) */
export const MOVE_MULTIPLIER = 20
export const MIN_WIN_RATIO = 0.05

/** Эпохи, где курс делал больно. ~30% игр стартуют так, чтобы игровые дни попали сюда. */
export const HOT_ERAS: ReadonlyArray<readonly [string, string]> = [
  ['2014-02-05', '2014-03-15'], // девальвация 11.02.2014: 155 → 185
  ['2015-08-15', '2015-10-20'], // отпуск курса 20.08.2015: 188 → 255+
  ['2020-03-05', '2020-04-15'], // нефть по $20
  ['2022-02-21', '2022-04-05'], // февраль 2022: 467 на пике
]
export const HOT_ERA_WEIGHT = 0.3

/** Детерминированный PRNG: один seed — одна и та же игра. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Первый индекс с датой >= iso (данные отсортированы по дате). */
function lowerBound(data: RatePoint[], iso: string): number {
  let lo = 0
  let hi = data.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (data[mid].d < iso) lo = mid + 1
    else hi = mid
  }
  return lo
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/**
 * Выбирает старт сегмента из 70 подряд идущих торговых дней.
 * С вероятностью HOT_ERA_WEIGHT «горячий» день попадает в игровые раунды
 * (индексы start+60 … start+69).
 */
export function pickSegmentStart(data: RatePoint[], rng: () => number): number {
  const maxStart = data.length - SEGMENT_DAYS
  if (maxStart < 0) throw new Error(`need at least ${SEGMENT_DAYS} points, got ${data.length}`)

  if (rng() < HOT_ERA_WEIGHT) {
    const era = HOT_ERAS[Math.floor(rng() * HOT_ERAS.length)]
    const lo = lowerBound(data, era[0])
    const hi = lowerBound(data, era[1])
    if (hi > lo) {
      const hotIdx = lo + Math.floor(rng() * (hi - lo))
      const offset = VISIBLE_DAYS + Math.floor(rng() * PLAY_ROUNDS)
      return clamp(hotIdx - offset, 0, maxStart)
    }
  }
  return Math.floor(rng() * (maxStart + 1))
}

/** Сегмент игры от seed: 70 точек, детерминированно. */
export function segmentFromSeed(data: RatePoint[], seed: number): { startIdx: number; points: RatePoint[] } {
  const startIdx = pickSegmentStart(data, mulberry32(seed))
  return { startIdx, points: data.slice(startIdx, startIdx + SEGMENT_DAYS) }
}

export interface RoundOutcome {
  correct: boolean
  /** дневное движение курса, доля (0.01 = +1%) */
  pct: number
  /** сумма на кону, ₸ (всегда > 0) */
  amount: number
  /** изменение баланса: +amount или -amount */
  delta: number
}

/**
 * Исход раунда. Плоский день (курс не изменился) засчитывается за «Доллар ⬇»:
 * ставка «вверх» требует строгого роста.
 */
export function roundOutcome(prevRate: number, nextRate: number, guess: Direction, stake: number): RoundOutcome {
  if (stake <= 0) throw new Error('stake must be positive')
  const pct = (nextRate - prevRate) / prevRate
  const correct = pct > 0 ? guess === 'up' : guess === 'down'
  const amount = Math.round(stake * Math.max(MIN_WIN_RATIO, Math.abs(pct) * MOVE_MULTIPLIER))
  return { correct, pct, amount, delta: correct ? amount : -amount }
}

/** Баланс не уходит ниже нуля: проигрыш больше баланса = банкротство. */
export function applyDelta(balance: number, delta: number): number {
  return Math.max(0, balance + delta)
}

export function isBust(balance: number): boolean {
  return balance <= 0
}

/** Реальная ставка: фиксированную режем по балансу, ALL_IN — весь баланс. */
export function effectiveStake(choice: StakeChoice, balance: number): number {
  return choice === 'ALL_IN' ? balance : Math.min(choice, balance)
}

export interface Verdict {
  title: string
  emoji: string
}

export function titleFor(balance: number): Verdict {
  if (balance >= 2_000_000) return { title: 'Сорос из Астаны', emoji: '🦅' }
  if (balance >= 1_200_000) return { title: 'Брокер с Зелёного базара', emoji: '📈' }
  if (balance >= 800_000) return { title: 'Хотя бы не минус', emoji: '😮‍💨' }
  if (balance >= 300_000) return { title: 'Курс тебя съел', emoji: '📉' }
  return { title: 'Февраль 2014 в душе', emoji: '💀' }
}

/** Фейково-правдоподобный перцентиль от числа угаданных раундов (0–10). */
const PERCENTILE_BY_CORRECT = [2, 6, 13, 24, 38, 54, 70, 83, 92, 97, 99] as const

export function percentileFor(correctCount: number): number {
  return PERCENTILE_BY_CORRECT[clamp(Math.round(correctCount), 0, PLAY_ROUNDS)]
}

const MONTHS_PREPOSITIONAL = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
] as const

/** "2015-08-21" → "августе 2015" (для «Ты торговал в …») */
export function formatEra(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MONTHS_PREPOSITIONAL[Number(m) - 1]} ${y}`
}

export function formatTenge(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₸'
}

/** Комментарий к раскрытию эпохи на экране результатов. */
export function eraComment(finalBalance: number): string {
  if (finalBalance <= 0) return 'Вечная память депозиту.'
  if (finalBalance < START_BALANCE) return 'Соболезнуем.'
  if (finalBalance >= 2_000_000) return 'Нацбанку стоит присмотреться к тебе.'
  return 'Неплохо выкрутился.'
}
