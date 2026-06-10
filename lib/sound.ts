'use client'

/** Крошечный WebAudio-синтезатор: никаких аудиофайлов, только осцилляторы. */

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, endFreq?: number) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** короткий щелчок при ставке */
export function playTick() {
  tone(1500, 0.045, 'square', 0.035)
}

/** «касса» при выигрыше */
export function playWin() {
  tone(660, 0.09, 'sine', 0.06)
  tone(880, 0.1, 'sine', 0.06, 0.07)
  tone(1320, 0.16, 'sine', 0.05, 0.15)
}

/** грустный спуск при проигрыше */
export function playLose() {
  tone(280, 0.3, 'sawtooth', 0.05, 0, 110)
}
