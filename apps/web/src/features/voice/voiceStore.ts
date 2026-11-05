import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { i18n } from '@/app/i18n'
import { notify } from '@/shared/ui/useToasts'
import { hasBrowserVoice, speakWithBrowser, stopBrowserVoice } from './browserVoice'
import { createKokoroEngine } from './kokoroEngine'
import { DEFAULT_VOICE, MODEL_CACHES, type VoiceId } from './voices'

const { t } = i18n.global

export type VoiceChoice = 'browser' | 'natural'
export type VoiceStatus = 'idle' | 'downloading' | 'ready' | 'failed'

export const useVoiceStore = defineStore('voice', () => {
  const choice = useLocalStorage<VoiceChoice>('lf-voice-choice', 'browser')
  const voiceId = useLocalStorage<VoiceId>('lf-voice-id', DEFAULT_VOICE)
  /** Whether the model is in this browser's cache, so choosing it needs no new download. */
  const downloaded = useLocalStorage('lf-voice-downloaded', false)
  const status = ref<VoiceStatus>('idle')
  const progress = ref(0)
  /** A line was asked for and its audio isn't ready yet. */
  const preparing = ref(false)
  let lastLine = 0

  const engine = createKokoroEngine({
    createWorker: () => new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' }),
    createAudio: () => new AudioContext(),
    now: () => performance.now(),
  })

  const usingNatural = computed(() => choice.value === 'natural' && status.value !== 'failed')

  /** Loads the model before it's needed, so the first line doesn't have to wait for it. */
  function prepare() {
    if (choice.value !== 'natural' || status.value !== 'idle') return
    engine.load().then(
      () => {
        if (status.value === 'idle') status.value = 'ready'
      },
      (error) => {
        console.error(error)
        // Removing the download also ends this, and isn't a failure.
        if (choice.value === 'natural') status.value = 'failed'
      },
    )
  }

  async function download() {
    if (status.value === 'downloading') return
    status.value = 'downloading'
    progress.value = 0
    try {
      await engine.load((fraction) => {
        progress.value = fraction
      })
      downloaded.value = true
      choice.value = 'natural'
      status.value = 'ready'
    } catch (error) {
      // Cancelling already put everything back.
      if (status.value !== 'downloading') return
      console.error(error)
      status.value = 'failed'
      notify(t('settings.voice.downloadFailed'), { tone: 'error' })
    }
  }

  function cancelDownload() {
    status.value = 'idle'
    stop()
    engine.dispose()
  }

  function choose(next: VoiceChoice) {
    if (next === 'natural' && (!downloaded.value || status.value === 'failed')) {
      void download()
      return
    }
    choice.value = next
    if (next === 'natural') prepare()
  }

  async function removeDownload() {
    stop()
    choice.value = 'browser'
    engine.dispose()
    downloaded.value = false
    status.value = 'idle'
    await Promise.all(MODEL_CACHES.map((name) => caches.delete(name))).catch((error) => console.error(error))
  }

  /** The basic voice, for when the natural one can't be used. Says so if there's none. */
  async function fallBack(text: string, rate: number) {
    status.value = 'failed'
    const hasVoice = await hasBrowserVoice()
    notify(t(hasVoice ? 'settings.voice.fellBack' : 'settings.voice.noneLeft'), { tone: 'error' })
    if (hasVoice) speakWithBrowser(text, rate)
  }

  async function say(text: string, rate = 1) {
    if (!usingNatural.value) {
      if (await hasBrowserVoice()) speakWithBrowser(text, rate)
      return
    }
    const line = ++lastLine
    preparing.value = true
    const settled = () => {
      if (line === lastLine) preparing.value = false
    }
    try {
      await engine.speak(text, { voice: voiceId.value, speed: rate, onStart: settled })
      if (status.value === 'idle') status.value = 'ready'
    } catch (error) {
      console.error(error)
      if (line === lastLine) await fallBack(text, rate)
    } finally {
      settled()
    }
  }

  function stop() {
    lastLine++
    preparing.value = false
    engine.stop()
    stopBrowserVoice()
  }

  return {
    choice,
    voiceId,
    downloaded,
    status,
    progress,
    preparing,
    usingNatural,
    prepare,
    download,
    cancelDownload,
    choose,
    removeDownload,
    say,
    stop,
  }
})
