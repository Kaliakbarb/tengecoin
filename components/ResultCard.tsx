'use client'

import { forwardRef } from 'react'
import { START_BALANCE, formatEra, formatTenge, percentileFor, titleFor } from '@/lib/engine'

interface Props {
  balance: number
  correct: number
  rounds: number
  firstPlayDay: string
  host: string
}

/**
 * Карточка результата для PNG-экспорта (html-to-image).
 * Рендерится за экраном в фиксированном размере 360×450, экспорт — pixelRatio 3.
 */
const ResultCard = forwardRef<HTMLDivElement, Props>(function ResultCard(
  { balance, correct, rounds, firstPlayDay, host },
  ref,
) {
  const { title, emoji } = titleFor(balance)
  const won = balance >= START_BALANCE
  const deltaPct = Math.round(((balance - START_BALANCE) / START_BALANCE) * 100)
  const bust = balance <= 0

  return (
    <div
      ref={ref}
      className="flex h-[450px] w-[360px] flex-col px-7 py-6"
      style={{
        backgroundColor: '#060a0d',
        backgroundImage:
          'radial-gradient(420px 240px at 50% -8%, rgba(0,230,118,0.1), transparent 65%),' +
          'repeating-linear-gradient(0deg, rgba(140,170,190,0.05) 0 1px, transparent 1px 36px),' +
          'repeating-linear-gradient(90deg, rgba(140,170,190,0.05) 0 1px, transparent 1px 36px)',
        border: '1px solid #1a242c',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold tracking-[0.16em] text-terminal-text">
          ТЕҢГЕ СИМУЛЯТОР 🇰🇿
        </span>
        <span className="led" />
      </div>

      <div className="mt-8 text-[10px] tracking-[0.25em] text-terminal-dim">
        {bust ? `БАНКРОТ НА РАУНДЕ ${rounds}` : `ИТОГ ЗА ${rounds} РАУНДОВ`}
      </div>
      <div
        className={`mt-2 text-[38px] font-bold leading-none tabular-nums ${
          won ? 'text-up glow-up' : 'text-down glow-down'
        }`}
      >
        {formatTenge(balance)}
      </div>
      <div className={`mt-1.5 text-[13px] font-bold tabular-nums ${won ? 'text-up' : 'text-down'}`}>
        {deltaPct >= 0 ? '+' : ''}{deltaPct}% к миллиону
      </div>

      <div className="mt-6 font-display text-[20px] font-bold leading-snug text-terminal-text">
        {title} {emoji}
      </div>

      <div className="mt-auto border-t border-terminal-edge pt-4 text-[11px] leading-relaxed text-terminal-dim">
        <div>
          Угадал <span className="font-bold text-terminal-text">{correct}/{rounds}</span> · лучше{' '}
          <span className="font-bold text-terminal-text">{percentileFor(correct)}%</span> игроков
        </div>
        <div className="mt-0.5">
          Торговал в <span className="font-bold text-terminal-text">{formatEra(firstPlayDay)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="whitespace-nowrap text-[10px] font-bold tracking-wide text-gold glow-gold">{host}</span>
        <span className="whitespace-nowrap text-[9px] tracking-[0.18em] text-terminal-dim">СЛАБО ПОВТОРИТЬ?</span>
      </div>
    </div>
  )
})

export default ResultCard
