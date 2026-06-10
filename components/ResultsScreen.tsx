'use client'

import { useEffect, useRef, useState } from 'react'
import ResultCard from '@/components/ResultCard'
import { useAnimatedNumber } from '@/lib/useAnimatedNumber'
import {
  PLAY_ROUNDS,
  START_BALANCE,
  eraComment,
  formatEra,
  formatTenge,
  percentileFor,
  titleFor,
} from '@/lib/engine'

interface Props {
  balance: number
  correct: number
  rounds: number
  seed: number
  firstPlayDay: string
  lastPlayDay: string
  best: number | null
  isNewBest: boolean
  games: number
  onPlayAgain: () => void
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function ResultsScreen({
  balance,
  correct,
  rounds,
  seed,
  firstPlayDay,
  lastPlayDay,
  best,
  isNewBest,
  games,
  onPlayAgain,
}: Props) {
  const { title, emoji } = titleFor(balance)
  const won = balance >= START_BALANCE
  const bust = balance <= 0
  const delta = balance - START_BALANCE

  // драматичная раскрутка от миллиона к итогу
  const [target, setTarget] = useState(START_BALANCE)
  useEffect(() => setTarget(balance), [balance])
  const animBalance = useAnimatedNumber(target, 1400)

  const cardRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState('tenge-simulator.vercel.app')
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  useEffect(() => {
    if (window.location.hostname !== 'localhost') setHost(window.location.host)
  }, [])

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNote(null)
    try {
      const { toPng } = await import('html-to-image')
      const node = cardRef.current
      if (!node) throw new Error('card not mounted')
      // первый прогон прогревает шрифты в html-to-image, второй — чистовой
      await toPng(node, { pixelRatio: 3, cacheBust: true })
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })

      const shareUrl = `${window.location.origin}/?s=${seed.toString(36)}&b=${balance}&a=${correct}`
      const text = `Я наторговал ${formatTenge(balance)} в Теңге Симуляторе. ${title} ${emoji} Угадал ${correct}/${rounds}. Слабо? ${shareUrl}`

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'tenge-simulator.png', { type: 'image/png' })

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = 'tenge-simulator.png'
        a.click()
        // без await: вне пользовательского жеста промис может не резолвиться
        void navigator.clipboard?.writeText(text).catch(() => {})
        setShareNote('Карточка скачана, текст со ссылкой — в буфере')
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setShareNote('Не вышло. Скриншоть по-старинке 🤷')
    } finally {
      setSharing(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 pb-4 pt-3">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[13px] font-bold tracking-[0.14em] text-terminal-text">
          ТЕҢГЕ СИМУЛЯТОР <span className="ml-0.5">🇰🇿</span>
        </h1>
        <span className="text-[10px] tracking-widest text-terminal-dim">СЕССИЯ ЗАКРЫТА</span>
      </header>

      <section className="panel mt-3 animate-risein px-4 py-5 text-center">
        <div className="text-[10px] tracking-[0.25em] text-terminal-dim">
          {bust ? `БАНКРОТ НА РАУНДЕ ${rounds}` : 'ИТОГОВЫЙ БАЛАНС'}
        </div>
        <div
          className={`mt-2 text-[40px] font-bold leading-none tabular-nums ${
            won ? 'text-up glow-up' : 'text-down glow-down'
          }`}
        >
          {formatTenge(animBalance)}
        </div>
        <div className={`mt-1 text-xs font-bold tabular-nums ${won ? 'text-up' : 'text-down'}`}>
          {delta >= 0 ? '+' : '−'}{formatTenge(Math.abs(delta))} к стартовому миллиону
        </div>

        <div className="mt-4 font-display text-[22px] font-black leading-tight text-terminal-text">
          {title} <span>{emoji}</span>
        </div>

        {isNewBest && (
          <div className="mt-2 inline-block animate-pulseglow rounded bg-gold/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-gold">
            ★ НОВЫЙ РЕКОРД
          </div>
        )}
      </section>

      <section className="panel mt-2 animate-risein px-4 py-3 text-sm leading-relaxed [animation-delay:120ms]">
        <p>
          Ты торговал в <span className="font-bold text-terminal-text">{formatEra(firstPlayDay)}</span>.{' '}
          <span className="text-terminal-dim">{eraComment(balance)}</span>
        </p>
        <p className="mt-1 text-[10px] tabular-nums text-terminal-dim">
          {formatDate(firstPlayDay)} — {formatDate(lastPlayDay)} · реальные курсы НБ РК
        </p>
      </section>

      <section className="panel mt-2 animate-risein px-4 py-3 text-sm [animation-delay:240ms]">
        <p>
          Ты угадал <span className="font-bold text-terminal-text">{correct}/{rounds}</span>. Лучше чем{' '}
          <span className="font-bold text-gold glow-gold">{percentileFor(correct)}%</span> игроков.
        </p>
        <p className="mt-1 flex justify-between text-[10px] text-terminal-dim">
          <span>
            РЕКОРД: <span className="tabular-nums text-terminal-text">{best !== null ? formatTenge(best) : '—'}</span>
          </span>
          <span>
            ИГР: <span className="tabular-nums text-terminal-text">{games}</span>
          </span>
        </p>
      </section>

      <section className="mt-auto animate-risein pt-3 [animation-delay:360ms]">
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className={`btn-press h-[60px] w-full rounded-xl border border-gold/60 bg-gold/10 text-base font-bold tracking-wide text-gold glow-gold ${
            sharing ? 'opacity-60' : ''
          }`}
        >
          {sharing ? 'ГОТОВЛЮ КАРТОЧКУ…' : 'ПОДЕЛИТЬСЯ ПОЗОРОМ / УСПЕХОМ'}
        </button>
        {shareNote && <div className="mt-1.5 text-center text-[10px] text-terminal-dim">{shareNote}</div>}
        <button
          type="button"
          onClick={onPlayAgain}
          className="btn-press mt-2 h-[52px] w-full rounded-xl border border-up/50 bg-up/10 text-sm font-bold tracking-wide text-up glow-up"
        >
          ИГРАТЬ ЕЩЁ ↻
        </button>
        <footer className="py-2 text-center text-[9px] text-terminal-dim/70">
          Не является инвестиционной рекомендацией 😉
        </footer>
      </section>

      {/* карточка для экспорта — за экраном */}
      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
        <ResultCard
          ref={cardRef}
          balance={balance}
          correct={correct}
          rounds={rounds}
          firstPlayDay={firstPlayDay}
          host={host}
        />
      </div>
    </main>
  )
}
