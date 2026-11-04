<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { cleanWebLink } from '@/domain/videoSources'
import CaptureCard from '@/features/capture/CaptureCard.vue'
import LibrarySources from '@/features/capture/LibrarySources.vue'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { useReadingStore } from './readingStore'

const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const reading = useReadingStore()
const enrichment = useEnrichmentStore()

const link = ref('')
const linkError = ref(false)
const pasted = ref('')
const typed = ref('')

const heading = computed(() => reading.article?.title ?? t('nav.reading'))
const originalUrl = computed(() => cleanWebLink(reading.article?.url ?? reading.failedUrl ?? undefined))
const coverage = computed(() =>
  reading.stats.words ? Math.round((reading.stats.libraryWords / reading.stats.words) * 100) : 0,
)
const showStart = computed(() => !reading.article && !reading.loading)

/** The address decides what's open, so links from the Library and the back button work. */
function syncWithRoute() {
  const url = typeof route.query.url === 'string' ? cleanWebLink(route.query.url) : null
  if (url) void reading.openUrl(url)
  else if (reading.article?.url || reading.errorCode) reading.close()
}

onMounted(syncWithRoute)
watch(() => route.query.url, syncWithRoute)
onBeforeUnmount(() => reading.close())

function openLink() {
  const url = cleanWebLink(link.value)
  linkError.value = !url
  if (url) void router.push({ path: '/reading', query: { url } })
}

function readPasted() {
  // Keeps the address of a page that failed, so captures still point back to it.
  reading.openText(pasted.value, t('reading.pastedTitle'), reading.failedUrl ?? undefined)
  pasted.value = ''
}

async function backToStart() {
  reading.close()
  if (route.query.url) await router.push('/reading')
}

function sentenceOf(node: Node | null): { paragraph: number; sentence: number } | null {
  const element = node instanceof Element ? node : node?.parentElement
  const holder = element?.closest<HTMLElement>('[data-sentence]')
  if (!holder) return null
  return { paragraph: Number(holder.dataset.paragraph), sentence: Number(holder.dataset.sentence) }
}

/** Dragging over words captures that phrase. Otherwise a click captures the word under it. */
function onPointerUp(event: MouseEvent) {
  const selection = getSelection()
  const selected = selection?.toString().trim()
  if (selected) {
    const place = sentenceOf(selection!.anchorNode)
    if (place) {
      const sentence = reading.paragraphs[place.paragraph]?.[place.sentence]?.text ?? ''
      reading.startCapture(selected.replace(/\s+/g, ' '), sentence)
    }
    return
  }
  const word = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-word]') : null
  const place = word && sentenceOf(word)
  if (!word || !place) return
  const sentence = reading.paragraphs[place.paragraph]?.[place.sentence]
  const segment = sentence?.segments[Number(word.dataset.word)]
  if (sentence && segment) reading.startCapture(segment.text, sentence.text, segment.entry)
}

function captureTyped() {
  if (!typed.value.trim()) return
  reading.captureTyped(typed.value)
  typed.value = ''
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="min-w-0 text-2xl font-semibold tracking-tight wrap-break-word">{{ heading }}</h1>
      <button v-if="reading.article" type="button" class="lf-btn" @click="backToStart">{{ t('reading.backToList') }}</button>
    </header>

    <p v-if="reading.loading" class="text-sm text-muted" aria-live="polite" data-testid="reading-loading">{{ t('reading.loading') }}</p>

    <div v-if="showStart" class="flex max-w-2xl flex-col gap-4">
      <p class="text-sm text-muted">{{ t('reading.subtitle') }}</p>

      <div v-if="reading.errorCode" class="flex flex-col items-start gap-2 rounded-card border border-line bg-surface p-4 text-sm" role="alert" data-testid="reading-error">
        <p class="font-medium">{{ t(`reading.errors.${reading.errorCode}`) }}</p>
        <template v-if="originalUrl && reading.errorCode !== 'blocked_url' && reading.errorCode !== 'invalid_url'">
          <p class="text-muted">{{ t('reading.fallback') }}</p>
          <a :href="originalUrl" target="_blank" rel="noopener noreferrer" class="lf-btn">
            <ExternalLink :size="15" aria-hidden="true" />
            {{ t('reading.original') }}
          </a>
        </template>
      </div>

      <form class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4" data-testid="reading-open" novalidate @submit.prevent="openLink">
        <label class="block">
          <span class="lf-label">{{ t('reading.link') }}</span>
          <input v-model="link" type="url" class="lf-input" placeholder="https://…" spellcheck="false" />
        </label>
        <p v-if="linkError" class="text-sm" role="alert">{{ t('video.library.badLink') }}</p>
        <button type="submit" class="lf-btn lf-btn-primary self-start" :disabled="!link.trim()">{{ t('reading.open') }}</button>
      </form>

      <div class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <label class="block">
          <span class="lf-label">{{ t('reading.paste') }}</span>
          <textarea v-model="pasted" rows="5" class="lf-input" lang="en" />
        </label>
        <p class="text-xs text-muted">{{ t('reading.pasteHint') }}</p>
        <button type="button" class="lf-btn self-start" :disabled="!pasted.trim()" @click="readPasted">{{ t('reading.read') }}</button>
      </div>

      <LibrarySources kind="page" />

      <section v-if="reading.recent.length" class="flex flex-col gap-2" data-testid="reading-recent">
        <h2 class="font-semibold">{{ t('reading.recent') }}</h2>
        <ul class="flex flex-col gap-1 text-sm">
          <li v-for="item in reading.recent" :key="item.url">
            <RouterLink :to="{ path: '/reading', query: { url: item.url } }" class="wrap-anywhere underline-offset-2 hover:underline">{{ item.title }}</RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="reading.article" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <article class="min-w-0 rounded-card border border-line bg-surface p-4 sm:p-6" lang="en" data-testid="reading-article" @mouseup="onPointerUp">
        <p class="mb-3 text-xs text-muted" lang="es">{{ t('reading.hint') }}</p>
        <p v-for="(paragraph, paragraphIndex) in reading.paragraphs" :key="paragraphIndex" class="mb-4 max-w-prose leading-7">
          <span
            v-for="(sentence, sentenceIndex) in paragraph"
            :key="sentenceIndex"
            :data-paragraph="paragraphIndex"
            :data-sentence="sentenceIndex"
          >
            <template v-for="(segment, position) in sentence.segments" :key="position">
              <span
                v-if="segment.isWord"
                class="cursor-pointer rounded hover:bg-line"
                :class="segment.entry && 'font-medium underline decoration-accent decoration-2 underline-offset-2'"
                :data-word="position"
                :data-status="segment.entry?.status"
              >{{ segment.text }}</span>
              <template v-else>{{ segment.text }}</template>
            </template>
            {{ ' ' }}
          </span>
        </p>
      </article>

      <aside class="flex flex-col gap-4 lg:sticky lg:top-4">
        <CaptureCard
          v-if="reading.capture"
          :capture="reading.capture"
          :hint="t('reading.captureHint')"
          @save="reading.saveCapture"
          @cancel="reading.capture = null"
        />

        <!-- The keyboard path to capturing, since single words in a long page aren't tab stops. -->
        <form class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4" data-testid="reading-type" @submit.prevent="captureTyped">
          <label class="block">
            <span class="lf-label">{{ t('reading.typeLabel') }}</span>
            <input v-model="typed" type="text" class="lf-input" lang="en" spellcheck="false" />
          </label>
          <button type="submit" class="lf-btn self-start" :disabled="!typed.trim()">{{ t('reading.typeButton') }}</button>
        </form>

        <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 text-sm" data-testid="reading-stats">
          <h2 class="font-semibold">{{ t('reading.stats.title') }}</h2>
          <dl class="grid grid-cols-2 gap-3">
            <div>
              <dd class="text-xl font-semibold tabular-nums">{{ n(reading.stats.words) }}</dd>
              <dt class="text-xs text-muted">{{ t('reading.stats.words') }}</dt>
            </div>
            <div>
              <dd class="text-xl font-semibold tabular-nums" data-testid="reading-items">{{ reading.stats.items }}</dd>
              <dt class="text-xs text-muted">{{ t('reading.stats.items') }}</dt>
            </div>
          </dl>
          <p class="text-xs text-muted">{{ t('reading.stats.coverage', { percent: coverage }) }}</p>

          <div v-if="reading.estimate" aria-live="polite" data-testid="reading-level">
            <p class="text-xl font-semibold">{{ reading.estimate.level }}</p>
            <p class="text-xs text-muted">{{ reading.estimate.reason }}</p>
          </div>
          <template v-else-if="enrichment.aiConfigured">
            <button type="button" class="lf-btn self-start" :disabled="reading.estimating" @click="reading.estimateLevel()">
              {{ reading.estimating ? t('reading.level.working') : t('reading.level.button') }}
            </button>
            <p class="text-xs text-muted">{{ t('reading.level.hint') }}</p>
          </template>
          <p v-else class="text-xs text-muted">{{ t('reading.level.off') }}</p>
        </section>

        <a v-if="originalUrl" :href="originalUrl" target="_blank" rel="noopener noreferrer" class="lf-btn self-start">
          <ExternalLink :size="15" aria-hidden="true" />
          {{ t('reading.original') }}
        </a>
      </aside>
    </div>
  </section>
</template>
