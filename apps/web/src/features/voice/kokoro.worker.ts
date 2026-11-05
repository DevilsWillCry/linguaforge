/**
 * Runs the Kokoro voice model away from the page, because generating audio takes
 * long enough to freeze the interface. Only downloads ever reach the network: the
 * text being spoken stays on this computer.
 */
import { KokoroTTS, TextSplitterStream, env } from 'kokoro-js'
// Served by the app rather than a CDN, so the voice keeps working offline.
import runtimeModule from '../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url'
import runtimeBinary from '../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url'
import type { WorkerReply, WorkerRequest } from './protocol'
import { VOICES, voiceFileUrl, MODEL_CACHES } from './voices'

type VoiceName = NonNullable<NonNullable<Parameters<KokoroTTS['generate']>[1]>['voice']>

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// The library's types only allow a string, but the runtime also accepts this form.
env.wasmPaths = { mjs: runtimeModule, wasm: runtimeBinary } as unknown as string

let model: Promise<KokoroTTS> | null = null
/** The newest request. Anything older stops at its next sentence. */
let currentId = 0
/** The runtime can't run two generations at once, so they wait in line. */
let line: Promise<void> = Promise.resolve()

const reply = (message: WorkerReply, transfer: Transferable[] = []) => postMessage(message, { transfer })

function load() {
  // q8 stays clear at 92 MB. The full model is 326 MB and generates no faster on the
  // CPU, the only device Firefox offers on Linux.
  model ??= KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress) => {
      if (progress.status === 'progress') {
        reply({ type: 'progress', file: progress.file, loaded: progress.loaded, total: progress.total })
      }
    },
  })
  return model
}

/**
 * The library fetches each voice the first time it's used, which would fail offline. This
 * fills the same cache ahead of time. Failing is harmless: it fetches them later as usual.
 */
async function downloadVoices() {
  const cache = await caches.open(MODEL_CACHES[1]!)
  for (const { id } of VOICES) {
    const url = voiceFileUrl(id)
    if (await cache.match(url)) continue
    const response = await fetch(url)
    if (response.ok) await cache.put(url, response)
  }
}

async function speak({ id, text, voice, speed }: Extract<WorkerRequest, { type: 'speak' }>) {
  if (id !== currentId) return
  const tts = await load()
  // Given a plain string, the library's stream never closes its splitter.
  const splitter = new TextSplitterStream()
  splitter.push(text)
  splitter.close()
  for await (const sentence of tts.stream(splitter, { voice: voice as VoiceName, speed })) {
    if (id !== currentId) return
    const samples = new Float32Array(sentence.audio.audio)
    reply(
      { type: 'chunk', id, samples, sampleRate: sentence.audio.sampling_rate, chars: sentence.text.length },
      [samples.buffer],
    )
  }
  reply({ type: 'done', id })
}

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'load') {
    load().then(
      async () => {
        await downloadVoices().catch((error) => console.warn(error))
        reply({ type: 'ready' })
      },
      (error) => {
        model = null
        console.error(error)
        reply({ type: 'loadFailed' })
      },
    )
  } else if (data.type === 'speak') {
    currentId = data.id
    line = line.then(() =>
      speak(data).catch((error) => {
        console.error(error)
        if (data.id === currentId) reply({ type: 'speakFailed', id: data.id })
      }),
    )
  } else {
    currentId = data.id
  }
})
