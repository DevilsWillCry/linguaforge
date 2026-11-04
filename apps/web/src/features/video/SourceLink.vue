<script setup lang="ts">
import { FileText, Play } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { EntrySource } from '@/domain/types'
import { sourceDestination, videoIdOfSource } from '@/domain/videoSources'

const props = defineProps<{
  source: EntrySource
  /** Icon only, for the table. */
  compact?: boolean
  /** The entry's name, so a screen reader can tell the table's many links apart. */
  name?: string
}>()
const { t } = useI18n()

/** Starts a little early, so the sentence isn't cut off at its first word. */
const LEAD_IN_SECONDS = 0.5

const destination = computed(() => sourceDestination(props.source))
const isVideo = computed(() => destination.value?.path === '/video')

/** The saved moment only applies to the video it was captured from. */
const isClip = computed(
  () => isVideo.value && props.source.videoId === videoIdOfSource(props.source) && props.source.startSec !== undefined,
)

const to = computed(() => {
  if (!destination.value) return null
  if (!isClip.value) return destination.value
  const { startSec, endSec } = props.source
  return {
    path: destination.value.path,
    query: {
      ...destination.value.query,
      t: String(Math.max(0, startSec! - LEAD_IN_SECONDS)),
      ...(endSec !== undefined ? { end: String(endSec) } : {}),
    },
  }
})

const label = computed(() => t(isClip.value ? 'video.clip' : isVideo.value ? 'video.openSource' : 'reading.openSource'))
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="lf-btn"
    data-testid="clip-link"
    :aria-label="compact && name ? `${label}: ${name}` : undefined"
    :title="compact ? label : undefined"
  >
    <component :is="isVideo ? Play : FileText" :size="15" aria-hidden="true" />
    <template v-if="!compact">{{ label }}</template>
  </RouterLink>
</template>
