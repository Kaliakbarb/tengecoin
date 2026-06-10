import { START_BALANCE, formatTenge, percentileFor, titleFor } from '@/lib/engine'

export const runtime = 'edge'

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function svgText(value: string, attrs: string) {
  return `<text ${attrs}>${escapeSvg(value)}</text>`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bRaw = searchParams.get('b')
  const aRaw = searchParams.get('a')
  const b = bRaw ? Number(bRaw) : NaN
  const a = aRaw ? Number(aRaw) : NaN
  const hasResult = Number.isFinite(b)

  const balance = Math.max(0, Math.round(hasResult ? b : START_BALANCE))
  const won = balance >= START_BALANCE
  const accent = won ? '#00e676' : '#ff5252'
  const accuracy = Number.isFinite(a) ? Math.min(10, Math.max(0, Math.round(a))) : null
  const { title, emoji } = hasResult ? titleFor(balance) : { title: 'Угадай курс доллара', emoji: '' }

  const kicker = hasResult ? 'ТЕҢГЕ СИМУЛЯТОР 🇰🇿' : 'ТЕҢГЕ СИМУЛЯТОР 🇰🇿'
  const main = hasResult ? formatTenge(balance) : '1 000 000 ₸'
  const sub = hasResult
    ? `${title} ${emoji}`
    : 'Угадай курс доллара на реальной истории USD/KZT'
  const footer = hasResult
    ? accuracy === null
      ? 'Слабо?'
      : `угадал ${accuracy}/10 · лучше ${percentileFor(accuracy)}% игроков`
    : 'Сколько доживёт?'

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="38%" stop-color="#060a0d" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#060a0d"/>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <path d="M50 560 L200 556 L350 552 L480 548 L570 546 L610 420 L690 440 L770 400 L900 412 L1030 390 L1150 398"
    fill="none" stroke="${accent}" stroke-width="4" opacity="0.35"/>
  <circle cx="1035" cy="92" r="46" fill="${accent}" opacity="0.12"/>
  <circle cx="168" cy="500" r="72" fill="#ffd166" opacity="0.08"/>
  ${svgText(kicker, 'x="600" y="130" text-anchor="middle" fill="#5c6b75" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="8"')}
  ${svgText(hasResult ? 'Я наторговал' : sub, 'x="600" y="198" text-anchor="middle" fill="#c9d6dd" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700"')}
  ${svgText(main, `x="600" y="318" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="800" filter="url(#glow)"`)}
  ${svgText(hasResult ? sub : 'на старте', 'x="600" y="386" text-anchor="middle" fill="#c9d6dd" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800"')}
  ${svgText(footer, 'x="600" y="464" text-anchor="middle" fill="#ffd166" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800"')}
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
