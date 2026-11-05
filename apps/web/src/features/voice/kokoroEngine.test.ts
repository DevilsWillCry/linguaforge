import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKokoroEngine, type VoiceWorker } from './kokoroEngine'
import type { WorkerReply, WorkerRequest } from './protocol'

const OPTIONS = { voice: 'af_heart', speed: 1 }
const SAMPLE_RATE = 1000

function setup() {
  const sent: WorkerRequest[] = []
  const started: { at: number; seconds: number }[] = []
  const stopped: number[] = []
  let clock = 0
  const workers: VoiceWorker[] = []

  const engine = createKokoroEngine({
    createWorker: () => {
      const worker: VoiceWorker = {
        onmessage: null,
        onerror: null,
        terminate: vi.fn(),
        postMessage: (message) => {
          sent.push(message)
        },
      }
      workers.push(worker)
      return worker
    },
    createAudio: () =>
      ({
        currentTime: 0,
        destination: {},
        resume: async () => {},
        createBuffer: (_channels: number, length: number, rate: number) => ({
          duration: length / rate,
          copyToChannel: () => {},
        }),
        createBufferSource() {
          const source = {
            buffer: null as { duration: number } | null,
            connect: () => {},
            start: (at: number) => started.push({ at, seconds: source.buffer!.duration }),
            stop: () => stopped.push(1),
          }
          return source
        },
      }) as unknown as AudioContext,
    now: () => clock,
  })

  const reply = (message: WorkerReply) => workers.at(-1)!.onmessage!({ data: message } as MessageEvent<WorkerReply>)
  const chunk = (id: number, seconds: number, chars: number) =>
    reply({ type: 'chunk', id, samples: new Float32Array(seconds * SAMPLE_RATE), sampleRate: SAMPLE_RATE, chars })
  /** Lets speak() get past waiting for the model, and returns the id it sent. */
  const speaking = async () => {
    await vi.advanceTimersByTimeAsync(0)
    const last = sent.at(-1)
    if (last?.type !== 'speak') throw new Error('Nothing was sent to speak')
    return last.id
  }
  const tick = (ms: number) => {
    clock += ms
  }
  return { engine, sent, started, stopped, workers, reply, chunk, speaking, tick }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('loading', () => {
  it('reports progress across every file', async () => {
    const { engine, reply } = setup()
    const seen: number[] = []
    const loaded = engine.load((fraction) => seen.push(fraction))
    reply({ type: 'progress', file: 'config.json', loaded: 10, total: 10 })
    reply({ type: 'progress', file: 'model.onnx', loaded: 45, total: 90 })
    reply({ type: 'ready' })
    await loaded
    expect(seen).toEqual([1, 0.55])
  })

  it('only starts one worker however many ask', async () => {
    const { engine, workers, reply } = setup()
    const both = Promise.all([engine.load(), engine.load()])
    reply({ type: 'ready' })
    await both
    expect(workers).toHaveLength(1)
  })

  it('can try again after a failed load', async () => {
    const { engine, reply, workers } = setup()
    const first = engine.load()
    reply({ type: 'loadFailed' })
    await expect(first).rejects.toThrow()
    expect(workers[0]!.terminate).toHaveBeenCalled()

    const second = engine.load()
    reply({ type: 'ready' })
    await second
    expect(workers).toHaveLength(2)
  })

  it('reports cancelling as a failure of that load', async () => {
    const { engine } = setup()
    const loading = engine.load()
    engine.dispose()
    await expect(loading).rejects.toThrow('Cancelled')
  })
})

describe('speaking', () => {
  async function ready() {
    const context = setup()
    const loaded = context.engine.load()
    context.reply({ type: 'ready' })
    await loaded
    return context
  }

  it('plays one sentence as soon as it is generated', async () => {
    const { engine, chunk, reply, started, speaking } = await ready()
    const text = 'Hello there.'
    const spoken = engine.speak(text, OPTIONS)
    const id = await speaking()
    chunk(id, 1, text.length)
    expect(started).toHaveLength(1)
    reply({ type: 'done', id })
    await spoken
  })

  it('holds audio back until generating the rest should not leave a gap', async () => {
    const { engine, chunk, reply, started, speaking, tick } = await ready()
    const onStart = vi.fn()
    const spoken = engine.speak(`Hi. ${'x'.repeat(100)}`, { ...OPTIONS, onStart })
    const id = await speaking()

    tick(2000)
    chunk(id, 1, 4)
    expect(started).toHaveLength(0)
    expect(onStart).not.toHaveBeenCalled()

    tick(2000)
    chunk(id, 7, 100)
    expect(onStart).toHaveBeenCalledOnce()
    expect(started).toHaveLength(2)
    expect(started[1]!.at).toBeCloseTo(started[0]!.at + 1 + 0.1)
    reply({ type: 'done', id })
    await spoken
  })

  it('stops holding after the longest acceptable wait', async () => {
    const { engine, chunk, started, speaking, tick } = await ready()
    void engine.speak(`Hi. ${'x'.repeat(200)}`, OPTIONS)
    const id = await speaking()
    tick(3000)
    chunk(id, 1, 4)
    expect(started).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(4999)
    expect(started).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(started).toHaveLength(1)

    tick(20000)
    chunk(id, 8, 200)
    expect(started).toHaveLength(2)
  })

  it('replays a line without generating it again', async () => {
    const { engine, chunk, reply, sent, started, speaking } = await ready()
    const first = engine.speak('Hello.', OPTIONS)
    const id = await speaking()
    chunk(id, 1, 6)
    reply({ type: 'done', id })
    await first

    const generated = sent.filter((message) => message.type === 'speak').length
    await engine.speak('Hello.', OPTIONS)
    expect(sent.filter((message) => message.type === 'speak')).toHaveLength(generated)
    expect(started).toHaveLength(2)
  })

  it('generates again for a different voice or speed', async () => {
    const { engine, sent, speaking, chunk, reply } = await ready()
    const first = engine.speak('Hello.', OPTIONS)
    const id = await speaking()
    chunk(id, 1, 6)
    reply({ type: 'done', id })
    await first

    void engine.speak('Hello.', { ...OPTIONS, speed: 0.7 })
    await speaking()
    expect(sent.at(-1)).toMatchObject({ type: 'speak', speed: 0.7 })
  })

  it('silences the current line when told to stop, and ignores its later audio', async () => {
    const { engine, chunk, sent, started, stopped, speaking } = await ready()
    const spoken = engine.speak('One. Two.', OPTIONS)
    const id = await speaking()
    chunk(id, 5, 4)
    expect(started).toHaveLength(1)

    engine.stop()
    await spoken
    expect(stopped).toHaveLength(1)
    expect(sent.at(-1)).toEqual({ type: 'cancel', id })

    chunk(id, 5, 5)
    expect(started).toHaveLength(1)
  })

  it('a new line replaces the one being spoken', async () => {
    const { engine, chunk, started, stopped, speaking } = await ready()
    const first = engine.speak('One.', OPTIONS)
    const firstId = await speaking()
    chunk(firstId, 1, 4)
    const second = engine.speak('Two.', OPTIONS)
    await first
    expect(stopped).toHaveLength(1)

    const secondId = await speaking()
    expect(secondId).not.toBe(firstId)
    chunk(firstId, 1, 1)
    expect(started).toHaveLength(1)
    chunk(secondId, 1, 4)
    expect(started).toHaveLength(2)
    void second
  })

  it('only the newest of two quick requests is spoken, and neither one hangs', async () => {
    const { engine, sent, reply } = setup()
    const first = engine.speak('One.', OPTIONS)
    const second = engine.speak('Two.', OPTIONS)
    reply({ type: 'ready' })
    await first
    await vi.advanceTimersByTimeAsync(0)
    const spoken = sent.filter((message) => message.type === 'speak')
    expect(spoken).toEqual([expect.objectContaining({ text: 'Two.' })])
    void second
  })

  it('stopping while the model loads means nothing plays afterwards', async () => {
    const { engine, sent, reply } = setup()
    const spoken = engine.speak('One.', OPTIONS)
    engine.stop()
    reply({ type: 'ready' })
    await spoken
    expect(sent.filter((message) => message.type === 'speak')).toHaveLength(0)
  })

  it('rejects when generating fails, so the caller can fall back', async () => {
    const { engine, reply, speaking } = await ready()
    const spoken = engine.speak('One.', OPTIONS)
    const id = await speaking()
    reply({ type: 'speakFailed', id })
    await expect(spoken).rejects.toThrow()
  })

  it('rejects when the worker crashes, and recovers with a new one', async () => {
    const { engine, workers, speaking, reply } = await ready()
    const spoken = engine.speak('One.', OPTIONS)
    await speaking()
    workers.at(-1)!.onerror!({} as ErrorEvent)
    await expect(spoken).rejects.toThrow()

    const again = engine.load()
    reply({ type: 'ready' })
    await again
    expect(workers).toHaveLength(2)
  })
})
