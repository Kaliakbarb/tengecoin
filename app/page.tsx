import type { Metadata } from 'next'
import Game from '@/components/Game'
import { START_BALANCE, formatTenge, titleFor } from '@/lib/engine'

export const dynamic = 'force-dynamic'

type SearchParams = { [key: string]: string | string[] | undefined }

function parseSeed(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !raw) return null
  const n = parseInt(raw, 36)
  return Number.isInteger(n) && n >= 0 ? n >>> 0 : null
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const b = typeof searchParams.b === 'string' && searchParams.b !== '' ? Number(searchParams.b) : NaN
  const a = typeof searchParams.a === 'string' && searchParams.a !== '' ? Number(searchParams.a) : NaN
  const hasResult = Number.isFinite(b)

  const title = hasResult
    ? `Я наторговал ${formatTenge(b)} в Теңге Симуляторе. Слабо?`
    : 'Теңге Симулятор 🇰🇿 — угадай курс доллара'
  const description = hasResult
    ? `${titleFor(b).title} ${titleFor(b).emoji} Сыграй мой сценарий — тот же кусок истории USD/KZT.`
    : `${formatTenge(START_BALANCE)} на старте, реальная история USD/KZT, 10 раундов. Сколько у тебя останется?`

  const og = `/api/og?b=${hasResult ? Math.round(b) : ''}&a=${Number.isFinite(a) ? Math.round(a) : ''}`
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
  }
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  const seed = parseSeed(searchParams.s) ?? Math.floor(Math.random() * 0xffffffff)
  return <Game initialSeed={seed} />
}
