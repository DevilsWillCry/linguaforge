import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import { liveQuery, type Subscription } from 'dexie'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { i18n } from '@/app/i18n'
import { deckRepository, entryRepository, videoRepository } from '@/data/repositories'
import { cueIndexAt, parseSubtitles } from '@/domain/subtitles'
import { buildPhraseIndex, segmentLine } from '@/domain/transcriptWords'
import type { Cue, Deck, Entry, EntrySource, MediaKey, VideoSession } from '@/domain/types'
import { saveCapture as saveToLibrary, type Capture } from '@/features/capture/saveCapture'
import { notify } from '@/shared/ui/useToasts'
import type { MediaPlayer } from './mediaPlayer'

export type VideoMode = 'watch' | 'cloze' | 'dictation'

export type MediaSource =
  | { kind: 'youtube'; key: MediaKey; videoId: string; startSec?: number; endSec?: number }
  | { kind: 'file'; key: MediaKey; url: string; name: string; isAudio: boolean }

export interface VideoCapture extends Capture {
  startSec: number
  endSec: number
}

const TICK_MS = 150
const SAVE_EVERY_MS = 10_000

const { t } = i18n.global

export const useVideoStore = defineStore('video', () => {
  const source = shallowRef<MediaSource | null>(null)
  const player = shallowRef<MediaPlayer | null>(null)
  const session = shallowRef<VideoSession | null>(null)
  const cues = shallowRef<Cue[]>([])
  const transcriptName = ref('')
  const library = shallowRef<Entry[]>([])
  const decks = shallowRef<Deck[]>([])

  const time = ref(0)
  const playing = ref(false)
  const rate = ref(1)
  const loop = ref<{ a: number | null; b: number | null }>({ a: null, b: null })
  const stopAt = ref<number | null>(null)
  const mode = ref<VideoMode>('watch')
  const capture = shallowRef<VideoCapture | null>(null)
  const autoScroll = useLocalStorage('lf-video-autoscroll', true)

  const activeIndex = computed(() => cueIndexAt(cues.value, time.value))
  const phraseIndex = computed(() => buildPhraseIndex(library.value))
  const lines = computed(() => cues.value.map((cue) => segmentLine(cue.text, phraseIndex.value)))
  const loopActive = computed(() => loop.value.a !== null && loop.value.b !== null)

  let playedMs = 0
  let sinceSaveMs = 0

  const saveSession = async () => {
    const current = session.value
    if (!current) return
    const updated: VideoSession = {
      ...current,
      positionSec: time.value,
      minutesWatched: current.minutesWatched + playedMs / 60_000,
      title: player.value?.title() ?? current.title,
      updatedAt: new Date().toISOString(),
    }
    playedMs = 0
    session.value = updated
    await videoRepository.saveSession(updated).catch((error) => console.error(error))
  }

  // The player can't push its position, so it's read several times a second. That's also
  // what ends a loop or a sentence on time.
  const { pause: stopTicking, resume: startTicking } = useIntervalFn(
    () => {
      const current = player.value
      if (!current) return
      time.value = current.time()
      playing.value = current.isPlaying()
      // YouTube only knows the title once the video has loaded, so it shows up when it does.
      const title = current.title()
      if (title && session.value && session.value.title !== title) session.value = { ...session.value, title }
      if (!playing.value) return

      playedMs += TICK_MS
      sinceSaveMs += TICK_MS
      if (sinceSaveMs >= SAVE_EVERY_MS) {
        sinceSaveMs = 0
        void saveSession()
      }
      const { a, b } = loop.value
      if (a !== null && b !== null && time.value >= b) {
        current.seek(a)
        time.value = a
      } else if (stopAt.value !== null && time.value >= stopAt.value) {
        stopAt.value = null
        current.pause()
      }
    },
    TICK_MS,
    { immediate: false },
  )

  let librarySubscription: Subscription | null = null

  function watchLibrary() {
    librarySubscription ??= liveQuery(async () => {
      const allDecks = await deckRepository.list()
      const language = allDecks.filter((deck) => deck.schema.languageFeatures)
      const entries = await Promise.all(language.map((deck) => entryRepository.listByDeck(deck.id)))
      return { decks: language, entries: entries.flat() }
    }).subscribe({
      next: (value) => {
        decks.value = value.decks
        library.value = value.entries
      },
      error: (error) => console.error(error),
    })
  }

  /** Opens something to watch, with its saved transcript and session if it has them. */
  async function open(next: MediaSource) {
    await close()
    watchLibrary()
    const [saved, transcript] = await Promise.all([
      videoRepository.getSession(next.key),
      videoRepository.getTranscript(next.key),
    ])
    session.value = saved ?? {
      id: next.key,
      ...(next.kind === 'youtube' ? { videoId: next.videoId } : { title: next.name }),
      positionSec: 0,
      minutesWatched: 0,
      wordsCaptured: 0,
      updatedAt: new Date().toISOString(),
    }
    cues.value = transcript?.cues ?? []
    transcriptName.value = transcript?.name ?? ''
    // Set last, because this mounts the player, which needs the saved position.
    source.value = next
  }

  /** Where playback should begin: the requested moment, or where the user left off. */
  const startPosition = computed(() => {
    const current = source.value
    if (current?.kind === 'youtube' && current.startSec !== undefined) return current.startSec
    return session.value?.positionSec ?? 0
  })

  function attach(ready: MediaPlayer) {
    player.value = ready
    ready.setRate(rate.value)
    const current = source.value
    if (current?.kind === 'youtube' && current.endSec !== undefined) stopAt.value = current.endSec
    time.value = startPosition.value
    startTicking()
  }

  async function close() {
    stopTicking()
    await saveSession()
    player.value?.destroy()
    player.value = null
    if (source.value?.kind === 'file') URL.revokeObjectURL(source.value.url)
    source.value = null
    session.value = null
    cues.value = []
    capture.value = null
    mode.value = 'watch'
    loop.value = { a: null, b: null }
    stopAt.value = null
    time.value = 0
    playing.value = false
    playedMs = 0
    sinceSaveMs = 0
  }

  // Asks the player, because `playing` can be a moment out of date after a quick second press.
  const togglePlay = () => (player.value?.isPlaying() ? player.value.pause() : player.value?.play())

  function seek(seconds: number) {
    stopAt.value = null
    player.value?.seek(seconds)
    time.value = seconds
  }

  function setRate(value: number) {
    rate.value = value
    player.value?.setRate(value)
  }

  /** Plays one line. With `once`, it stops at the end of the line, as practice modes need. */
  function playCue(index: number, once = false) {
    const cue = cues.value[index]
    if (!cue) return
    seek(cue.startSec)
    stopAt.value = once ? cue.endSec : null
    player.value?.play()
  }

  const repeatCue = () => playCue(Math.max(activeIndex.value, 0), true)
  const previousCue = () => playCue(Math.max(activeIndex.value - 1, 0))
  const nextCue = () => playCue(Math.min(activeIndex.value + 1, cues.value.length - 1))

  /** Marks one end of the loop. A loop whose ends are reversed would never finish, so they swap. */
  function setLoopPoint(point: 'a' | 'b') {
    const next = { ...loop.value, [point]: time.value }
    loop.value = next.a !== null && next.b !== null && next.a > next.b ? { a: next.b, b: next.a } : next
  }

  const clearLoop = () => {
    loop.value = { a: null, b: null }
  }

  /** Returns false if the text holds no subtitles, leaving any existing transcript in place. */
  async function loadTranscript(content: string, name: string): Promise<boolean> {
    const key = source.value?.key
    const parsed = parseSubtitles(content)
    if (!key || !parsed.length) return false
    cues.value = parsed
    transcriptName.value = name
    await videoRepository
      .saveTranscript({ id: key, name, cues: parsed, updatedAt: new Date().toISOString() })
      .catch((error) => console.error(error))
    return true
  }

  async function removeTranscript() {
    const key = source.value?.key
    cues.value = []
    transcriptName.value = ''
    if (mode.value !== 'watch') mode.value = 'watch'
    if (key) await videoRepository.removeTranscript(key).catch((error) => console.error(error))
  }

  /** Opens the capture card for a word or phrase, and pauses so the sentence isn't missed. */
  function startCapture(text: string, cueIndex: number, entry?: Entry) {
    const cue = cues.value[cueIndex]
    if (!cue) return
    player.value?.pause()
    capture.value = { text, sentence: cue.text, startSec: cue.startSec, endSec: cue.endSec, ...(entry ? { entry } : {}) }
  }

  function captureSource(current: VideoCapture): EntrySource {
    const media = source.value
    // Asks the player, because the saved session only learns the title every few seconds.
    const title = player.value?.title() ?? session.value?.title
    if (media?.kind !== 'youtube') return title ? { title } : {}
    return {
      ...(title ? { title } : {}),
      url: `https://www.youtube.com/watch?v=${media.videoId}&t=${Math.floor(current.startSec)}s`,
      videoId: media.videoId,
      startSec: current.startSec,
      endSec: current.endSec,
    }
  }

  async function saveCapture(text: string) {
    const current = capture.value
    const deck = decks.value[0]
    if (!current || !deck || !text.trim()) return
    try {
      const saved = await saveToLibrary(current, text, deck, captureSource(current), 'Video')
      notify(saved.created ? t('video.capture.added', { name: saved.name }) : t('video.capture.updated', { name: saved.name }))
      if (session.value && saved.created) {
        session.value = { ...session.value, wordsCaptured: session.value.wordsCaptured + 1 }
      }
      await saveSession()
      capture.value = null
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  return {
    source,
    player,
    session,
    cues,
    lines,
    transcriptName,
    time,
    playing,
    rate,
    loop,
    loopActive,
    mode,
    capture,
    autoScroll,
    activeIndex,
    startPosition,
    open,
    attach,
    close,
    togglePlay,
    seek,
    setRate,
    playCue,
    repeatCue,
    previousCue,
    nextCue,
    setLoopPoint,
    clearLoop,
    loadTranscript,
    removeTranscript,
    startCapture,
    saveCapture,
  }
})
