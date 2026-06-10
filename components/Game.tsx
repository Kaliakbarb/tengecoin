'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import Chart from '@/components/Chart'
import ResultsScreen from '@/components/ResultsScreen'
import { playLose, playTick, playWin } from '@/lib/sound'
import { useAnimatedNumber } from '@/lib/useAnimatedNumber'
import RAW_RATES from '@/data/usdkzt.json'
import {
  PLAY_ROUNDS,
  START_BALANCE,
  STAKE_CHOICES,
  VISIBLE_DAYS,
  applyDelta,
  effectiveStake,
  formatTenge,
  isBust,
  roundOutcome,
  segmentFromSeed,
  type Direction,
  type RatePoint,
  type RoundOutcome,
  type StakeChoice,
} from '@/lib/engine'

const RATES = RAW_RATES as RatePoint[]

interface Pending {
  guess: Direction
  outcome: RoundOutcome
  balanceBefore: number
}

interface State {
  seed: number
  round: number
  balance: number
  stake: StakeChoice
  phase: 'betting' | 'revealing' | 'done'
  pending: Pending | null
  correct: number
  streak: number
  lastDelta: number | null
  flash: { kind: 'win' | 'lose'; id: number } | null
  shakeId: number
}

type Action =
  | { type: 'bet'; guess: Direction; points: RatePoint[] }
  | { type: 'commit' }
  | { type: 'stake'; stake: StakeChoice }
  | { type: 'new'; seed: number }

function init(seed: number): State {
  return {
    seed,
    round: 0,
    balance: START_BALANCE,
    stake: 100_000,
    phase: 'betting',
    pending: null,
    correct: 0,
    streak: 0,
    lastDelta: null,
    flash: null,
    shakeId: 0,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'stake':
      return state.phase === 'betting' ? { ...state, stake: action.stake } : state

    case 'bet': {
      if (state.phase !== 'betting' || state.balance <= 0) return state
      const stake = effectiveStake(state.stake, state.balance)
      const prev = action.points[VISIBLE_DAYS + state.round - 1]
      const next = action.points[VISIBLE_DAYS + state.round]
      const outcome = roundOutcome(prev.r, next.r, action.guess, stake)
      return {
        ...state,
        phase: 'revealing',
        pending: { guess: action.guess, outcome, balanceBefore: state.balance },
      }
    }

    case 'commit': {
      if (state.phase !== 'revealing' || !state.pending) return state
      const { outcome, balanceBefore } = state.pending
      const balance = applyDelta(balanceBefore, outcome.delta)
      const round = state.round + 1
      const done = round >= PLAY_ROUNDS || isBust(balance)
      const bigLoss = !outcome.correct && outcome.amount > 0.2 * balanceBefore
      return {
        ...state,
        balance,
        round,
        phase: done ? 'done' : 'betting',
        pending: null,
        correct: state.correct + (outcome.correct ? 1 : 0),
        streak: outcome.correct ? state.streak + 1 : 0,
        lastDelta: outcome.delta,
        flash: { kind: outcome.correct ? 'win' : 'lose', id: (state.flash?.id ?? 0) + 1 },
        shakeId: bigLoss ? state.shakeId + 1 : state.shakeId,
      }
    }

    case 'new':
      return init(action.seed)
  }
}

const STAKE_LABELS: Record<string, string> = {
  '50000': '50K',
  '100000': '100K',
  '250000': '250K',
  ALL_IN: 'ВА-БАНК',
}

export default function Game({ initialSeed }: { initialSeed: number }) {
  const [state, dispatch] = useReducer(reducer, initialSeed, init)
  const segment = useMemo(() => segmentFromSeed(RATES, state.seed), [state.seed])

  const [soundOn, setSoundOn] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [games, setGames] = useState(0)
  const [shaking, setShaking] = useState(false)
  const recordedRef = useRef(false)

  const animBalance = useAnimatedNumber(state.balance, 750)

  // seed в URL — «сыграй мой сценарий»
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('s', state.seed.toString(36))
    url.searchParams.delete('b')
    url.searchParams.delete('a')
    window.history.replaceState(null, '', url.toString())
  }, [state.seed])

  useEffect(() => {
    setBest(Number(localStorage.getItem('tenge_best') ?? '') || null)
    setGames(Number(localStorage.getItem('tenge_games') ?? '0') || 0)
    setSoundOn(localStorage.getItem('tenge_sound') === '1')
  }, [])

  // звук, конфетти и тряска — по факту закрытия раунда
  useEffect(() => {
    if (!state.flash) return
    if (state.flash.kind === 'win') {
      if (soundOn) playWin()
      if (state.streak >= 3) {
        confetti({
          particleCount: 60 + state.streak * 20,
          spread: 75,
          origin: { y: 0.65 },
          colors: ['#00e676', '#ffd166', '#ffffff'],
          disableForReducedMotion: true,
        })
      }
    } else if (soundOn) {
      playLose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flash?.id])

  useEffect(() => {
    if (state.shakeId === 0) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 520)
    return () => clearTimeout(t)
  }, [state.shakeId])

  // запись результатов в localStorage один раз за игру
  useEffect(() => {
    if (state.phase !== 'done' || recordedRef.current) return
    recordedRef.current = true
    const g = games + 1
    setGames(g)
    localStorage.setItem('tenge_games', String(g))
    if (best === null || state.balance > best) {
      setBest(state.balance)
      localStorage.setItem('tenge_best', String(state.balance))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const handleBet = useCallback(
    (guess: Direction) => {
      if (soundOn) playTick()
      dispatch({ type: 'bet', guess, points: segment.points })
    },
    [segment.points, soundOn],
  )

  const handleRevealDone = useCallback(() => dispatch({ type: 'commit' }), [])

  const handlePlayAgain = useCallback(() => {
    recordedRef.current = false
    dispatch({ type: 'new', seed: Math.floor(Math.random() * 0xffffffff) })
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('tenge_sound', next ? '1' : '0')
  }

  const revealedCount = VISIBLE_DAYS + state.round + (state.phase === 'revealing' ? 1 : 0)
  const lastCommitted = segment.points[VISIBLE_DAYS + state.round - 1]
  const prevCommitted = segment.points[VISIBLE_DAYS + state.round - 2]
  const dayDelta = lastCommitted.r - prevCommitted.r
  const isNewBest = state.phase === 'done' && best !== null && state.balance >= best && state.balance > START_BALANCE

  if (state.phase === 'done') {
    return (
      <ResultsScreen
        balance={state.balance}
        correct={state.correct}
        rounds={state.round}
        seed={state.seed}
        firstPlayDay={segment.points[VISIBLE_DAYS].d}
        lastPlayDay={segment.points[VISIBLE_DAYS + state.round - 1].d}
        best={best}
        isNewBest={isNewBest}
        games={games}
        onPlayAgain={handlePlayAgain}
      />
    )
  }

  const betting = state.phase === 'betting'
  const effStake = effectiveStake(state.stake, state.balance)

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 pb-3 pt-3 ${shaking ? 'animate-shake' : ''}`}
    >
      {/* шапка */}
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[13px] font-bold tracking-[0.14em] text-terminal-text">
          ТЕҢГЕ СИМУЛЯТОР <span className="ml-0.5">🇰🇿</span>
        </h1>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
          className="btn-press rounded-md border border-terminal-edge bg-terminal-panel px-2 py-1 text-xs"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </header>

      {/* статусная строка */}
      <div className="mt-2 flex items-center justify-between text-[10px] tracking-wider text-terminal-dim">
        <span className="flex items-center gap-1.5">
          <span className="led" /> USD/KZT · АРХИВ НБ РК
        </span>
        <span>
          РАУНД <span className="text-terminal-text">{Math.min(state.round + 1, PLAY_ROUNDS)}/{PLAY_ROUNDS}</span>
        </span>
      </div>

      {/* баланс */}
      <section className="panel mt-2 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-widest text-terminal-dim">БАЛАНС</span>
          <span className="flex items-center gap-2">
            {state.streak >= 2 && (
              <span className="animate-pulseglow rounded bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                СЕРИЯ ×{state.streak}
              </span>
            )}
            {state.lastDelta !== null && (
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  state.lastDelta >= 0 ? 'text-up glow-up' : 'text-down glow-down'
                }`}
              >
                {state.lastDelta >= 0 ? '+' : '−'}{formatTenge(Math.abs(state.lastDelta))}
              </span>
            )}
          </span>
        </div>
        <div
          className={`mt-1 text-[30px] font-bold leading-none tabular-nums ${
            state.balance >= START_BALANCE ? 'text-up glow-up' : 'text-down glow-down'
          }`}
        >
          {formatTenge(animBalance)}
        </div>
      </section>

      {/* график */}
      <section className="panel relative mt-2 h-[240px] overflow-hidden p-1.5">
        <div className="pointer-events-none absolute left-3 top-2 z-10">
          <div className="text-[10px] tracking-widest text-terminal-dim">КУРС ЗА $1</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-terminal-text">{lastCommitted.r.toFixed(2)}</span>
            <span className={`text-[11px] font-bold tabular-nums ${dayDelta > 0 ? 'text-down' : 'text-up'}`}>
              {dayDelta >= 0 ? '+' : ''}{dayDelta.toFixed(2)}
            </span>
          </div>
        </div>
        <Chart points={segment.points} revealedCount={revealedCount} onRevealDone={handleRevealDone} />
        {state.flash && (
          <div
            key={state.flash.id}
            className={`animate-flashup pointer-events-none absolute inset-0 z-20 ${
              state.flash.kind === 'win' ? 'bg-up' : 'bg-down'
            }`}
          />
        )}
      </section>

      {/* ставка */}
      <section className="mt-2">
        <div className="flex items-center justify-between text-[10px] tracking-widest text-terminal-dim">
          <span>СТАВКА</span>
          <span className="tabular-nums">{formatTenge(effStake)}</span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {STAKE_CHOICES.map((choice) => {
            const active = state.stake === choice
            return (
              <button
                key={String(choice)}
                type="button"
                disabled={!betting}
                onClick={() => dispatch({ type: 'stake', stake: choice })}
                className={`btn-press rounded-lg border py-2 text-[11px] font-bold tracking-wide ${
                  active
                    ? 'border-gold/60 bg-gold/10 text-gold glow-gold'
                    : 'border-terminal-edge bg-terminal-panel text-terminal-dim'
                } ${!betting ? 'opacity-60' : ''}`}
              >
                {STAKE_LABELS[String(choice)]}
              </button>
            )
          })}
        </div>
      </section>

      {/* зона большого пальца: прогноз на завтра */}
      <section className="mt-auto pt-3">
        <div className="mb-1.5 text-center text-[10px] tracking-widest text-terminal-dim">
          {betting ? 'КУДА КУРС ЗАВТРА?' : 'СМОТРИМ…'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!betting}
            onClick={() => handleBet('up')}
            className={`btn-press h-[68px] rounded-xl border border-up/50 bg-up/10 text-base font-bold tracking-wide text-up glow-up ${
              !betting ? 'opacity-50' : ''
            }`}
          >
            ДОЛЛАР ⬆
          </button>
          <button
            type="button"
            disabled={!betting}
            onClick={() => handleBet('down')}
            className={`btn-press h-[68px] rounded-xl border border-down/50 bg-down/10 text-base font-bold tracking-wide text-down glow-down ${
              !betting ? 'opacity-50' : ''
            }`}
          >
            ДОЛЛАР ⬇
          </button>
        </div>
        <footer className="py-2 text-center text-[9px] text-terminal-dim/70">
          Не является инвестиционной рекомендацией 😉
        </footer>
      </section>
    </main>
  )
}
