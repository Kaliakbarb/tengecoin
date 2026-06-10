import { ImageResponse } from 'next/og'
import { START_BALANCE, formatTenge, percentileFor, titleFor } from '@/lib/engine'

export const runtime = 'edge'

const monoBold = fetch(new URL('./JetBrainsMono-Bold.ttf', import.meta.url)).then((r) => r.arrayBuffer())
const monoRegular = fetch(new URL('./JetBrainsMono-Regular.ttf', import.meta.url)).then((r) => r.arrayBuffer())
// JetBrains Mono не содержит ₸ (U+20B8) — Noto Sans подхватывает его фоллбеком
const notoBold = fetch(new URL('./NotoSans-Bold.ttf', import.meta.url)).then((r) => r.arrayBuffer())

/** Ломаная «в стиле августа 2015» для фоновой драмы. */
function Spark({ color }: { color: string }) {
  return (
    <svg width="1100" height="240" viewBox="0 0 1100 240" style={{ position: 'absolute', bottom: 0, left: 50 }}>
      <polyline
        points="0,200 150,196 300,192 430,188 520,186 560,60 640,80 720,40 850,52 980,30 1100,38"
        fill="none"
        stroke={color}
        strokeWidth="3"
        opacity="0.35"
      />
    </svg>
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bRaw = searchParams.get('b')
  const aRaw = searchParams.get('a')
  const b = bRaw ? Number(bRaw) : NaN
  const a = aRaw ? Number(aRaw) : NaN
  const hasResult = Number.isFinite(b)

  const fonts = [
    { name: 'JetBrains Mono', data: await monoBold, weight: 700 as const, style: 'normal' as const },
    { name: 'JetBrains Mono', data: await monoRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Noto Sans', data: await notoBold, weight: 700 as const, style: 'normal' as const },
  ]

  const base: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#060a0d',
    // у satori ограниченный CSS-парсер: только простые linear-gradient
    backgroundImage: 'linear-gradient(180deg, rgba(0,230,118,0.10) 0%, rgba(6,10,13,0) 38%)',
    fontFamily: 'JetBrains Mono',
    color: '#c9d6dd',
    position: 'relative',
  }

  if (!hasResult) {
    return new ImageResponse(
      (
        <div style={base}>
          <Spark color="#00e676" />
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: 6 }}>ТЕҢГЕ СИМУЛЯТОР 🇰🇿</div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#5c6b75' }}>
            Угадай курс доллара на реальной истории USD/KZT
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: '#00e676', fontWeight: 700 }}>
            {formatTenge(START_BALANCE)} на старте. Сколько доживёт?
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts, emoji: 'twemoji' },
    )
  }

  const balance = Math.max(0, Math.round(b))
  const { title, emoji } = titleFor(balance)
  const won = balance >= START_BALANCE
  const accent = won ? '#00e676' : '#ff5252'
  const accuracy = Number.isFinite(a) ? Math.min(10, Math.max(0, Math.round(a))) : null

  return new ImageResponse(
    (
      <div style={base}>
        <Spark color={accent} />
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: '#5c6b75' }}>
          ТЕҢГЕ СИМУЛЯТОР 🇰🇿
        </div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 30, color: '#c9d6dd' }}>Я наторговал</div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 96, fontWeight: 700, color: accent }}>
          {formatTenge(balance)}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 40, fontWeight: 700 }}>
          {title} {emoji}
        </div>
        {accuracy !== null && (
          <div style={{ display: 'flex', marginTop: 18, fontSize: 26, color: '#5c6b75' }}>
            угадал {accuracy}/10 · лучше {percentileFor(accuracy)}% игроков
          </div>
        )}
        <div style={{ display: 'flex', marginTop: 26, fontSize: 32, fontWeight: 700, color: '#ffd166' }}>
          Слабо?
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, emoji: 'twemoji' },
  )
}
