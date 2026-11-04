<script setup lang="ts">
import { liveQuery } from 'dexie'
import { CheckCircle2, ExternalLink } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { deckRepository, entryRepository, videoRepository } from '@/data/repositories'
import type { Entry } from '@/domain/types'
import {
  cleanWebLink,
  librarySources,
  linkedSource,
  sourceDestination,
  videoIdOfSource,
  webSearchUrl,
  youTubeSearchUrl,
  type LibrarySource,
  type SourceKind,
} from '@/domain/videoSources'
import { notify } from '@/shared/ui/useToasts'

/** Sources without a link show on both labs, because they could turn out to be either. */
const props = defineProps<{ kind: Exclude<SourceKind, 'unlinked'> }>()
const { t } = useI18n()

const entries = shallowRef<Entry[]>([])
const transcriptIds = shallowRef<Set<string>>(new Set())
const links = ref<Record<string, string>>({})
const badLink = ref<string | null>(null)

const subscription = liveQuery(async () => {
  const decks = await deckRepository.list()
  const lists = await Promise.all(decks.map((deck) => entryRepository.listByDeck(deck.id)))
  return { entries: lists.flat(), transcripts: await videoRepository.transcriptIds() }
}).subscribe({
  next: (value) => {
    entries.value = value.entries
    transcriptIds.value = new Set(value.transcripts)
  },
  error: (error) => console.error(error),
})
onBeforeUnmount(() => subscription.unsubscribe())

const sources = computed(() => librarySources(entries.value).filter((item) => item.kind === props.kind || item.kind === 'unlinked'))
const hasTranscript = (item: LibrarySource) => transcriptIds.value.has(`yt:${videoIdOfSource(item.source)}`)

/** Saves the link on every entry from this source, so it only has to be pasted once. */
async function link(item: LibrarySource) {
  const url = cleanWebLink(links.value[item.key])
  badLink.value = url ? null : item.key
  if (!url) return
  try {
    const members = entries.value.filter((entry) => item.entryIds.includes(entry.id))
    await Promise.all(members.map((entry) => entryRepository.patch(entry.id, { source: linkedSource(entry.source, url) })))
    delete links.value[item.key]
    notify(t('video.library.linked', { n: members.length }))
  } catch (error) {
    console.error(error)
    notify(t('errors.save'), { tone: 'error' })
  }
}
</script>

<template>
  <section v-if="sources.length" class="flex flex-col gap-2" data-testid="library-sources">
    <h2 class="font-semibold">{{ t('video.library.title') }}</h2>
    <p class="text-sm text-muted">{{ t('video.library.description') }}</p>
    <ul class="flex flex-col gap-2">
      <li
        v-for="item in sources"
        :key="item.key"
        class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 text-sm"
        data-testid="library-source"
      >
        <div v-if="item.kind !== 'unlinked'" class="flex flex-wrap items-center justify-between gap-2">
          <RouterLink :to="sourceDestination(item.source)!" class="min-w-0 font-medium wrap-anywhere underline-offset-2 hover:underline">
            {{ item.title }}
          </RouterLink>
          <span class="flex items-center gap-1.5 text-xs text-muted">
            <template v-if="item.kind === 'video'">
              <CheckCircle2 v-if="hasTranscript(item)" :size="13" aria-hidden="true" />
              {{ hasTranscript(item) ? t('video.library.hasTranscript') : t('video.library.noTranscript') }} ·
            </template>
            {{ t('video.library.entries', { n: item.entryIds.length }) }}
          </span>
        </div>
        <form v-else class="flex flex-col gap-2" novalidate @submit.prevent="link(item)">
          <p class="font-medium wrap-anywhere">{{ item.title }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <a :href="youTubeSearchUrl(item.title)" target="_blank" rel="noopener noreferrer" class="lf-btn">
              <ExternalLink :size="15" aria-hidden="true" />
              {{ t('video.library.search') }}
            </a>
            <a :href="webSearchUrl(item.title)" target="_blank" rel="noopener noreferrer" class="lf-btn">
              <ExternalLink :size="15" aria-hidden="true" />
              {{ t('video.library.searchWeb') }}
            </a>
            <span class="text-xs text-muted">{{ t('video.library.entries', { n: item.entryIds.length }) }}</span>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="block min-w-48 flex-1">
              <span class="lf-label">{{ t('video.library.pasteLink') }}</span>
              <input v-model="links[item.key]" type="url" class="lf-input" spellcheck="false" />
            </label>
            <button type="submit" class="lf-btn" :disabled="!links[item.key]?.trim()">{{ t('video.library.save') }}</button>
          </div>
          <p v-if="badLink === item.key" class="text-sm" role="alert">{{ t('video.library.badLink') }}</p>
        </form>
      </li>
    </ul>
  </section>
</template>
