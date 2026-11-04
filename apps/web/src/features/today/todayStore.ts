import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { studySessionRepository } from '@/data/repositories'

export interface SessionStep {
  id: 'warmup' | 'new' | 'input' | 'output' | 'wrapup'
  minutes: number
  /** Where the step happens. Steps without one aren't built yet. */
  path?: string
  /** The phase that builds this step. */
  phase?: number
}

/** The Standard session of about 45 minutes. Phase 6 adds the other intensities. */
export const SESSION_STEPS: SessionStep[] = [
  { id: 'warmup', minutes: 10, path: '/review' },
  { id: 'new', minutes: 10, path: '/enrich' },
  { id: 'input', minutes: 10, phase: 4 },
  { id: 'output', minutes: 10, phase: 5 },
  { id: 'wrapup', minutes: 5 },
]

interface SessionState {
  day: string
  started: boolean
  running: boolean
  stepIndex: number
  /** Study seconds for the whole session, and since the current step began. */
  seconds: number
  stepSeconds: number
}

function localDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const freshState = (): SessionState => ({
  day: localDay(),
  started: false,
  running: false,
  stepIndex: 0,
  seconds: 0,
  stepSeconds: 0,
})

/** Kept in a store, not the page, so the timer keeps running while the user reviews. */
export const useTodayStore = defineStore('today', () => {
  const state = useLocalStorage<SessionState>('lf-today-session', freshState())
  // Each day starts a new session.
  if (state.value.day !== localDay()) state.value = freshState()

  const { pause: stopTimer, resume: startTimer } = useIntervalFn(
    () => {
      state.value = { ...state.value, seconds: state.value.seconds + 1, stepSeconds: state.value.stepSeconds + 1 }
    },
    1000,
    { immediate: false },
  )
  if (state.value.running) startTimer()

  const step = computed(() => SESSION_STEPS[state.value.stepIndex] ?? null)
  const finished = computed(() => state.value.started && !step.value)

  function setRunning(running: boolean) {
    state.value = { ...state.value, running }
    if (running) startTimer()
    else stopTimer()
  }

  function start() {
    state.value = { ...freshState(), started: true, running: true }
    startTimer()
  }

  /** Records the minutes spent, for the Phase 6 dashboard, and moves to the next step. */
  async function advance() {
    const current = step.value
    if (!current) return
    const minutes = Math.round(state.value.stepSeconds / 60)
    if (minutes > 0) {
      await studySessionRepository
        .add({ id: nanoid(), activity: current.id, startedAt: new Date().toISOString(), minutes })
        .catch((error) => console.error(error))
    }
    const stepIndex = state.value.stepIndex + 1
    const running = stepIndex < SESSION_STEPS.length && state.value.running
    state.value = { ...state.value, stepIndex, stepSeconds: 0, running }
    if (!running) stopTimer()
  }

  function restart() {
    stopTimer()
    state.value = freshState()
  }

  return { state, step, finished, start, advance, restart, pause: () => setRunning(false), resume: () => setRunning(true) }
})
