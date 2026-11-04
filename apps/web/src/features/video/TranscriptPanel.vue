<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime } from '@/domain/subtitles'
import { notify } from '@/shared/ui/useToasts'
import { useVideoStore } from './videoStore'

const { t } = useI18n()
const video = useVideoStore()

const list = ref<HTMLElement | null>(null)
const pasted = ref('')

async function load(content: string, name: string) {
  if (await video.loadTranscript(content, name)) pasted.value = ''
  else notify(t('video.transcript.unreadable'), { tone: 'error' })
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await load(await file.text(), file.name)
  input.value = ''
}

// Scrolls only this list, never the page, so the player stays where the user left it.
watch(
  () => video.activeIndex,
  async (index) => {
    if (!video.autoScroll || index < 0 || !list.value) return
    await nextTick()
    const row = list.value.querySelector<HTMLElement>(`[data-cue="${index}"]`)
    if (!row) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    list.value.scrollTo({ top: row.offsetTop - list.value.clientHeight / 3, behavior: reduced ? 'auto' : 'smooth' })
  },
)

function cueIndexOf(node: Node | null): number | null {
  const element = node instanceof Element ? node : node?.parentElement
  const value = element?.closest<HTMLElement>('[data-cue]')?.dataset.cue
  return value === undefined ? null : Number(value)
}

/** Dragging over words captures that phrase. Otherwise a click captures the word under it. */
function onWordsPointerUp(event: MouseEvent) {
  const selection = getSelection()
  const selected = selection?.toString().trim()
  if (selected) {
    const index = cueIndexOf(selection!.anchorNode)
    if (index !== null) video.startCapture(selected.replace(/\s+/g, ' '), index)
    return
  }
  captureWordAt(event.target)
}

function captureWordAt(target: EventTarget | null) {
  const word = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-word]') : null
  if (!word) return
  const index = cueIndexOf(word)
  if (index === null) return
  const segment = video.lines[index]?.[Number(word.dataset.word)]
  if (segment) video.startCapture(segment.text, index, segment.entry)
}

function onWordKey(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  captureWordAt(event.target)
}
</script>

<template>
  <section class="flex min-h-0 flex-col gap-3 rounded-card border border-line bg-surface p-4" data-testid="transcript">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-semibold">{{ t('video.transcript.title') }}</h2>
      <div v-if="video.cues.length" class="flex flex-wrap items-center gap-3">
        <label class="inline-flex min-h-8 items-center gap-2 text-sm">
          <input v-model="video.autoScroll" type="checkbox" />
          {{ t('video.transcript.autoScroll') }}
        </label>
        <button type="button" class="lf-btn" @click="video.removeTranscript()">{{ t('video.transcript.replace') }}</button>
      </div>
    </header>

    <div v-if="!video.cues.length" class="flex flex-col gap-3" data-testid="transcript-empty">
      <p class="text-sm text-muted">{{ t('video.transcript.why') }}</p>
      <label class="block">
        <span class="lf-label">{{ t('video.transcript.file') }}</span>
        <input type="file" accept=".srt,.vtt,text/vtt,text/plain" class="lf-input" @change="onFile" />
      </label>
      <label class="block">
        <span class="lf-label">{{ t('video.transcript.paste') }}</span>
        <textarea v-model="pasted" rows="5" class="lf-input font-mono text-[0.8125rem]" spellcheck="false" />
      </label>
      <p class="text-xs text-muted">{{ t('video.transcript.pasteHint') }}</p>
      <button type="button" class="lf-btn self-start" :disabled="!pasted.trim()" @click="load(pasted, t('video.transcript.pastedName'))">
        {{ t('video.transcript.load') }}
      </button>
    </div>

    <template v-else>
      <p class="text-xs text-muted">{{ t('video.transcript.hint') }}</p>
      <ol ref="list" class="relative max-h-[28rem] overflow-y-auto lg:max-h-[calc(100dvh-14rem)]" data-testid="transcript-lines">
        <li
          v-for="(cue, index) in video.cues"
          :key="index"
          class="grid grid-cols-[3.25rem_1fr] gap-2 rounded-lg px-1 py-1.5"
          :class="index === video.activeIndex && 'bg-raised'"
          :data-cue="index"
          :aria-current="index === video.activeIndex ? 'true' : undefined"
          data-testid="cue"
        >
          <button
            type="button"
            class="self-start rounded text-left text-xs text-muted tabular-nums hover:text-ink"
            :aria-label="t('video.transcript.seek', { time: formatTime(cue.startSec) })"
            @click="video.playCue(index)"
          >
            {{ formatTime(cue.startSec) }}
          </button>
          <p class="text-sm" lang="en" @mouseup="onWordsPointerUp" @keydown="onWordKey">
            <template v-for="(segment, position) in video.lines[index]" :key="position">
              <!-- Only the line playing is in the tab order, or a long video would mean thousands of stops. -->
              <span
                v-if="segment.isWord"
                class="cursor-pointer rounded hover:bg-line"
                :class="segment.entry && 'font-medium underline decoration-accent decoration-2 underline-offset-2'"
                :data-word="position"
                :data-status="segment.entry?.status"
                :role="index === video.activeIndex ? 'button' : undefined"
                :tabindex="index === video.activeIndex ? 0 : undefined"
              >{{ segment.text }}</span>
              <template v-else>{{ segment.text }}</template>
            </template>
          </p>
        </li>
      </ol>
    </template>
  </section>
</template>
