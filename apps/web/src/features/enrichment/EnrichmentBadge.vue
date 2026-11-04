<script setup lang="ts">
import { LoaderCircle, Sparkles } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Entry } from '@/domain/types'
import TagBadge from '@/shared/ui/TagBadge.vue'

defineProps<{ entry: Entry }>()
const { t } = useI18n()
</script>

<template>
  <TagBadge v-if="entry.enrichment === 'empty'" :label="t('library.toComplete')" :icon="Sparkles" color="accent" />
  <TagBadge v-else-if="entry.enrichment === 'pending'" :label="t('enrich.pendingBadge')" :icon="LoaderCircle" color="accent" />
  <TagBadge v-else-if="entry.enrichment === 'draft'" :label="t('enrich.draftBadge')" :icon="Sparkles" color="amber" />
</template>
