import { MAX_HOLD_MS, readyToPlay } from './pacing'
import type { WorkerReply, WorkerRequest } from './protocol'

/** The parts of a Worker the engine uses, so tests can supply their own. */
export interface VoiceWorker {
  postMessage(message: WorkerRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface EngineDeps {
  createWorker(): VoiceWorker
  /** Called on first use, because browsers only allow sound after someone interacts. */
  createAudio(): AudioContext
  now(): number
}

interface Clip {
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

interface SpeakOptions {
  voice: string
  speed: number
  /** Called when sound is about to start, which can be several seconds later. */
  onStart?: () => void
}

/** "Listen again" is common in reviews, and shouldn't have to generate the same audio. */
const REMEMBERED_LINES = 12
/** A short breath between sentences, which the model generates separately. */
const SENTENCE_PAUSE_SECONDS = 0.1
const SCHEDULE_AHEAD_SECONDS = 0.02

export function createKokoroEngine(deps: EngineDeps) {
  let worker: VoiceWorker | null = null
  let audio: AudioContext | null = null
  let nextId = 0
  let loading: Promise<void> | null = null
  let settleLoading: { resolve: () => void; reject: (reason: Error) => void } | null = null
  let onProgress: ((fraction: number) => void) | null = null
  const fileProgress = new Map<string, { loaded: number; total: number }>()
  const remembered = new Map<string, Clip[]>()

  /** What's being spoken now. A new line or stop() replaces it. */
  let session: {
    id: number
    key: string
    clips: Clip[]
    pending: Clip[]
    remainingChars: number
    startedAt: number
    playing: boolean
    playAt: number
    sources: AudioBufferSourceNode[]
    holdTimer: ReturnType<typeof setTimeout> | null
    finished: () => void
    failed: (error: Error) => void
    onStart: (() => void) | undefined
  } | null = null

  function reportProgress(reply: Extract<WorkerReply, { type: 'progress' }>) {
    fileProgress.set(reply.file, { loaded: reply.loaded, total: reply.total })
    const totals = [...fileProgress.values()].reduce(
      (sum, file) => ({ loaded: sum.loaded + file.loaded, total: sum.total + file.total }),
      { loaded: 0, total: 0 },
    )
    if (totals.total) onProgress?.(Math.min(1, totals.loaded / totals.total))
  }

  function schedule(clip: Clip, current: NonNullable<typeof session>) {
    audio ??= deps.createAudio()
    const buffer = audio.createBuffer(1, clip.samples.length, clip.sampleRate)
    buffer.copyToChannel(clip.samples, 0)
    const source = audio.createBufferSource()
    source.buffer = buffer
    source.connect(audio.destination)
    const at = Math.max(audio.currentTime + SCHEDULE_AHEAD_SECONDS, current.playAt)
    source.start(at)
    current.playAt = at + buffer.duration + SENTENCE_PAUSE_SECONDS
    current.sources.push(source)
  }

  function startPlaying(current: NonNullable<typeof session>) {
    if (current.playing) return
    current.playing = true
    if (current.holdTimer) clearTimeout(current.holdTimer)
    current.onStart?.()
    void audio?.resume().catch(() => {})
    for (const clip of current.pending) schedule(clip, current)
    current.pending = []
  }

  function onChunk(reply: Extract<WorkerReply, { type: 'chunk' }>) {
    const current = session
    if (current?.id !== reply.id) return
    const clip = { samples: reply.samples, sampleRate: reply.sampleRate }
    current.clips.push(clip)
    current.remainingChars -= reply.chars

    if (current.playing) {
      schedule(clip, current)
      return
    }
    current.pending.push(clip)
    const seconds = (clips: Clip[]) => clips.reduce((sum, item) => sum + item.samples.length / item.sampleRate, 0)
    const generationRate = (deps.now() - current.startedAt) / 1000 / seconds(current.clips)
    if (readyToPlay({ bufferedSeconds: seconds(current.pending), remainingChars: current.remainingChars, generationRate })) {
      startPlaying(current)
    } else if (!current.holdTimer) {
      const waited = deps.now() - current.startedAt
      current.holdTimer = setTimeout(() => startPlaying(current), Math.max(0, MAX_HOLD_MS - waited))
    }
  }

  function onDone(id: number) {
    const current = session
    if (current?.id !== id) return
    startPlaying(current)
    remembered.delete(current.key)
    remembered.set(current.key, current.clips)
    if (remembered.size > REMEMBERED_LINES) remembered.delete(remembered.keys().next().value!)
    session = null
    current.finished()
  }

  function failSession(error: Error) {
    const current = session
    if (!current) return
    if (current.holdTimer) clearTimeout(current.holdTimer)
    session = null
    current.failed(error)
  }

  function workerFailed(error: Error) {
    settleLoading?.reject(error)
    failSession(error)
    worker?.terminate()
    worker = null
    loading = null
  }

  function ensureWorker(): VoiceWorker {
    if (worker) return worker
    const created = deps.createWorker()
    created.onerror = () => workerFailed(new Error('The voice worker stopped'))
    created.onmessage = ({ data: reply }) => {
      if (reply.type === 'progress') reportProgress(reply)
      else if (reply.type === 'ready') settleLoading?.resolve()
      else if (reply.type === 'chunk') onChunk(reply)
      else if (reply.type === 'done') onDone(reply.id)
      else if (reply.type === 'speakFailed' && session?.id === reply.id) failSession(new Error('Generating speech failed'))
      else if (reply.type === 'loadFailed') workerFailed(new Error('Loading the voice model failed'))
    }
    worker = created
    return created
  }

  /** Downloads the model the first time, and loads it from the browser's cache after that. */
  function load(progress?: (fraction: number) => void): Promise<void> {
    onProgress = progress ?? null
    if (loading) return loading
    fileProgress.clear()
    loading = new Promise<void>((resolve, reject) => {
      settleLoading = { resolve, reject }
      ensureWorker().postMessage({ type: 'load' })
    })
    return loading
  }

  /** Silences the current line. Its speak() call resolves rather than rejects. */
  function stop() {
    nextId++
    const current = session
    if (!current) return
    if (current.holdTimer) clearTimeout(current.holdTimer)
    session = null
    for (const source of current.sources) {
      try {
        source.stop()
      } catch {
        // Already finished playing.
      }
    }
    worker?.postMessage({ type: 'cancel', id: current.id })
    current.finished()
  }

  async function speak(text: string, { voice, speed, onStart }: SpeakOptions): Promise<void> {
    stop()
    const id = nextId
    audio ??= deps.createAudio()
    await load(onProgress ?? undefined)
    // Another line was asked for, or stop() was called, while the model was loading.
    if (id !== nextId) return

    const key = `${voice}|${speed}|${text}`
    return new Promise<void>((finished, failed) => {
      session = {
        id,
        key,
        clips: [],
        pending: [],
        remainingChars: text.length,
        startedAt: deps.now(),
        playing: false,
        playAt: 0,
        sources: [],
        holdTimer: null,
        finished,
        failed,
        onStart,
      }
      const known = remembered.get(key)
      if (known) {
        session.pending = [...known]
        session.clips = known
        onDone(id)
        return
      }
      ensureWorker().postMessage({ type: 'speak', id, text, voice, speed })
    })
  }

  /** Frees the model's memory. It loads again from the cache if needed. */
  function dispose() {
    stop()
    settleLoading?.reject(new Error('Cancelled'))
    worker?.terminate()
    worker = null
    loading = null
    remembered.clear()
  }

  return { load, speak, stop, dispose }
}

export type KokoroEngine = ReturnType<typeof createKokoroEngine>
