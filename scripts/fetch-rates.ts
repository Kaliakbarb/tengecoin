/**
 * Builds data/usdkzt.json — real USD/KZT daily rates, 2013-01-01 → 2025-12-31.
 *
 * Strategy:
 *   1. stooq.com bulk CSV (one request, fast — but often geo-blocked / rate-limited)
 *   2. fallback: National Bank of Kazakhstan official rates RSS, one request per
 *      weekday, fetched through a concurrency pool (~3400 requests, a few minutes)
 *
 * Run: npm run fetch-rates
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FROM = '2013-01-01'
const TO = '2025-12-31'
const MIN_POINTS = 2500
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'usdkzt.json')

interface RatePoint {
  d: string
  r: number
}

async function tryStooq(): Promise<RatePoint[] | null> {
  try {
    const res = await fetch('https://stooq.com/q/d/l/?s=usdkzt&i=d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    if (!text.startsWith('Date,')) return null
    const out: RatePoint[] = []
    for (const row of text.trim().split('\n').slice(1)) {
      const [d, , , , close] = row.split(',')
      if (d >= FROM && d <= TO && close && Number.isFinite(+close)) out.push({ d, r: +close })
    }
    return out.length >= MIN_POINTS ? out : null
  } catch {
    return null
  }
}

function weekdays(from: string, to: string): string[] {
  const out: string[] = []
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

async function fetchNbkDay(iso: string, retries = 4): Promise<RatePoint | null> {
  const [y, m, d] = iso.split('-')
  const url = `https://nationalbank.kz/rss/get_rates.cfm?fdate=${d}.${m}.${y}`
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      const xml = await res.text()
      const match = xml.match(/<title>USD<\/title>\s*<description>([\d.]+)<\/description>/)
      if (match) return { d: iso, r: parseFloat(match[1]) }
      if (res.ok) return null
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
  }
  return null
}

async function nbkBulk(): Promise<RatePoint[]> {
  const days = weekdays(FROM, TO)
  console.log(`NBK fallback: fetching ${days.length} weekdays with a pool of 12…`)
  const out: (RatePoint | null)[] = new Array(days.length).fill(null)
  let next = 0
  let done = 0
  async function worker() {
    while (next < days.length) {
      const i = next++
      out[i] = await fetchNbkDay(days[i])
      done++
      if (done % 250 === 0) console.log(`  ${done}/${days.length}`)
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker))
  return out.filter((p): p is RatePoint => p !== null)
}

async function main() {
  let points = await tryStooq()
  if (points) {
    console.log(`stooq: got ${points.length} points`)
  } else {
    console.log('stooq unreachable — falling back to National Bank of Kazakhstan')
    points = await nbkBulk()
  }

  points.sort((a, b) => (a.d < b.d ? -1 : 1))

  if (points.length < MIN_POINTS) {
    console.error(`FATAL: only ${points.length} points (< ${MIN_POINTS}); refusing to write`)
    process.exit(1)
  }

  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(points))
  console.log(`wrote ${points.length} points → ${OUT}`)
  console.log(`range: ${points[0].d} (${points[0].r}) … ${points[points.length - 1].d} (${points[points.length - 1].r})`)

  const aug2015 = points.filter((p) => p.d >= '2015-08-15' && p.d <= '2015-08-25')
  console.log('Aug 2015 sanity check:', aug2015.map((p) => `${p.d}=${p.r}`).join(' '))
}

main()
