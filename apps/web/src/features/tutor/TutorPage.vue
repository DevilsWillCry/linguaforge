<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import TagBadge from '@/shared/ui/TagBadge.vue'
import ChatPanel from './ChatPanel.vue'
import OutputTask from './OutputTask.vue'
import { useTutorStore } from './tutorStore'
import { SCENARIO_IDS } from './types'

const { t } = useI18n()
const tutor = useTutorStore()
const enrichment = useEnrichmentStore()

const tab = ref<'chat' | 'output'>('chat')
const TABS = ['chat', 'output'] as const

onMounted(() => void tutor.load())
</script>

<template>
  <section class="flex flex-col gap-4">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.tutor') }}</h1>
      <p class="mt-1 max-w-prose text-sm text-muted">{{ t('tutor.subtitle') }}</p>
    </header>

    <div v-if="enrichment.aiConfigured === false" class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-sm" role="status" data-testid="tutor-off">
      <p class="max-w-prose">{{ t('tutor.off') }}</p>
      <RouterLink to="/settings" class="lf-btn">{{ t('tutor.openSettings') }}</RouterLink>
    </div>

    <template v-else>
      <div class="flex gap-1" role="group" :aria-label="t('tutor.tabs.label')">
        <button v-for="name in TABS" :key="name" type="button" class="lf-btn" :aria-pressed="tab === name" @click="tab = name">
          {{ t(`tutor.tabs.${name}`) }}
        </button>
      </div>

      <OutputTask v-if="tab === 'output'" />
      <ChatPanel v-else-if="tutor.conversation" />

      <div v-else class="flex flex-col gap-4">
        <div v-if="tutor.targets.length" class="flex flex-col gap-1.5" data-testid="next-targets">
          <p class="text-xs text-muted">{{ t('tutor.targets') }}</p>
          <ul class="flex flex-wrap gap-1.5">
            <li v-for="target in tutor.targets" :key="target.id"><TagBadge :label="target.text" /></li>
          </ul>
        </div>
        <p v-else class="text-sm text-muted">{{ t('tutor.noTargets') }}</p>

        <section class="flex flex-col gap-2">
          <h2 class="font-semibold">{{ t('tutor.chooseScenario') }}</h2>
          <ul class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="scenarios">
            <li v-for="id in SCENARIO_IDS" :key="id">
              <button type="button" class="lf-btn min-h-14 w-full" :disabled="tutor.sending" @click="tutor.start(id)">
                {{ t(`tutor.scenarios.${id}`) }}
              </button>
            </li>
          </ul>
        </section>

        <section v-if="tutor.recent.length" class="flex flex-col gap-2" data-testid="recent-chats">
          <h2 class="font-semibold">{{ t('tutor.continue') }}</h2>
          <ul class="flex flex-col gap-2">
            <li v-for="item in tutor.recent" :key="item.id" class="flex items-center gap-2">
              <button type="button" class="lf-btn min-w-0 flex-1 justify-start text-left" @click="tutor.resume(item)">
                <span class="truncate">{{ t(`tutor.scenarios.${item.scenario}`) }} · {{ new Date(item.updatedAt).toLocaleDateString() }}</span>
              </button>
              <button type="button" class="lf-btn" :aria-label="t('tutor.remove', { name: t(`tutor.scenarios.${item.scenario}`) })" @click="tutor.removeConversation(item.id)">
                <Trash2 :size="15" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>
