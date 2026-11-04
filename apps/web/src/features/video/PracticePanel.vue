<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { checkAnswer } from '@/domain/answers'
import { clozeTargets, diffWords } from '@/domain/transcriptWords'
import { useVideoStore } from './videoStore'

const { t } = useI18n()
const video = useVideoStore()

const index = ref(0)
const checked = ref(false)
const typed = ref('')
const blanks = ref<Record<number, string>>({})
const results = ref<number[]>([])
const panel = ref<HTMLElement | null>(null)

const isCloze = computed(() => video.mode === 'cloze')
const segments = computed(() => video.lines[index.value] ?? [])
const targets = computed(() => (isCloze.value ? clozeTargets(segments.value) : new Set<number>()))
const cue = computed(() => video.cues[index.value])

const diff = computed(() => diffWords(cue.value?.text ?? '', typed.value))
const blankResult = (position: number) => checkAnswer(segments.value[position]?.text ?? '', blanks.value[position] ?? '')
const finished = computed(() => index.value >= video.cues.length)
const average = computed(() =>
  results.value.length ? Math.round(results.value.reduce((sum, score) => sum + score, 0) / results.value.length) : 0,
)

/** The next line with something to practice. Cloze skips lines with nothing to hide. */
function firstUsable(from: number): number {
  for (let i = Math.max(from, 0); i < video.cues.length; i += 1) {
    if (!isCloze.value || clozeTargets(video.lines[i] ?? []).size) return i
  }
  return video.cues.length
}

async function show(position: number) {
  index.value = firstUsable(position)
  checked.value = false
  typed.value = ''
  blanks.value = {}
  if (finished.value) return
  video.playCue(index.value, true)
  await nextTick()
  panel.value?.querySelector<HTMLElement>('input, textarea')?.focus()
}

function check() {
  if (checked.value) return
  if (isCloze.value) {
    const positions = [...targets.value]
    const right = positions.filter((position) => blankResult(position) !== 'wrong').length
    results.value = [...results.value, positions.length ? Math.round((right / positions.length) * 100) : 0]
  } else {
    results.value = [...results.value, diff.value.score]
  }
  checked.value = true
}

function onEnter(event: KeyboardEvent) {
  event.preventDefault()
  if (checked.value) void show(index.value + 1)
  else check()
}

// Starts from the line playing, so practice picks up where watching stopped.
onMounted(() => void show(video.activeIndex))
watch(
  () => video.mode,
  () => {
    results.value = []
    void show(video.activeIndex)
  },
)

const DIFF_CLASSES = {
  same: '',
  missing: 'font-semibold underline decoration-2 decoration-[var(--hue-rose)]',
  extra: 'line-through text-muted',
}
</script>

<template>
  <section ref="panel" class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4" data-testid="practice" :data-mode="video.mode">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="font-semibold">{{ t(`video.modes.${video.mode}`) }}</h2>
      <p v-if="results.length" class="text-sm text-muted tabular-nums" data-testid="practice-score">
        {{ t('video.practice.score', { score: average, n: results.length }) }}
      </p>
    </header>

    <p v-if="finished" class="text-sm" data-testid="practice-finished">{{ t('video.practice.finished') }}</p>

    <template v-else>
      <p class="text-sm text-muted">{{ t(`video.practice.${video.mode}Prompt`) }}</p>
      <p v-if="video.source?.kind === 'youtube'" class="text-xs text-muted" data-testid="captions-hint">{{ t('video.practice.captionsHint') }}</p>

      <!-- Nothing here shows the text of the line until the answer has been checked. -->
      <p v-if="isCloze" class="leading-9" lang="en" data-testid="cloze-line">
        <template v-for="(segment, position) in segments" :key="position">
          <template v-if="targets.has(position)">
            <input
              v-if="!checked"
              v-model="blanks[position]"
              type="text"
              class="lf-input inline-block w-32 align-baseline"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :aria-label="t('video.practice.blank')"
              @keydown.enter="onEnter"
            />
            <mark v-else class="rounded bg-raised px-1 font-semibold text-ink" :data-result="blankResult(position)">{{ segment.text }}</mark>
          </template>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>

      <template v-else>
        <label class="block">
          <span class="lf-label">{{ t('video.practice.typeHere') }}</span>
          <textarea
            v-model="typed"
            rows="2"
            class="lf-input"
            lang="en"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :readonly="checked"
            @keydown.enter="onEnter"
          />
        </label>
        <div v-if="checked" class="flex flex-col gap-2 rounded-lg bg-raised p-3 text-sm" data-testid="dictation-result" aria-live="polite">
          <p class="font-semibold tabular-nums">{{ diff.score }}%</p>
          <p lang="en">
            <template v-for="(word, position) in diff.words" :key="position">
              <span :class="DIFF_CLASSES[word.kind]" :data-kind="word.kind">{{ word.word }}</span>{{ ' ' }}
            </template>
          </p>
          <p class="text-xs text-muted">{{ t('video.practice.diffLegend') }}</p>
          <p class="text-muted" lang="en">{{ cue?.text }}</p>
        </div>
      </template>

      <div class="flex flex-wrap items-center gap-2">
        <button v-if="!checked" type="button" class="lf-btn lf-btn-primary" @click="check">{{ t('video.practice.check') }}</button>
        <button v-else type="button" class="lf-btn lf-btn-primary" @click="show(index + 1)">{{ t('video.practice.next') }}</button>
        <button type="button" class="lf-btn" @click="video.playCue(index, true)">{{ t('video.practice.listenAgain') }}</button>
        <span class="text-xs text-muted">Enter</span>
      </div>
    </template>
  </section>
</template>
