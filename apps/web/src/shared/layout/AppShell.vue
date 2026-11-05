<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { Plus } from 'lucide-vue-next'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { BrandIcon, NAV_ITEMS } from '@/app/router'
import { useCaptureStore } from '@/features/capture/captureStore'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { useLibraryStore } from '@/features/library/libraryStore'
import ToastList from '@/shared/ui/ToastList.vue'

const { t } = useI18n()
const route = useRoute()
const capture = useCaptureStore()
const library = useLibraryStore()
const enrichment = useEnrichmentStore()

// Runs from any page, because new entries should be drafted without visiting the queue.
onMounted(() => void enrichment.start())

const mobileTabs = computed(() => NAV_ITEMS.filter((item) => item.mobileTab))
const settingsItem = computed(() => NAV_ITEMS.find((item) => item.name === 'settings')!)

// These only show when opened, so they load once the page is up rather than delaying it.
const CommandPalette = defineAsyncComponent(() => import('@/features/capture/CommandPalette.vue'))
const QuickAddDialog = defineAsyncComponent(() => import('@/features/capture/QuickAddDialog.vue'))
const EntryEditor = defineAsyncComponent(() => import('@/features/library/EntryEditor.vue'))
const AFTER_LOAD_MS = 1500
const pageSettled = ref(false)
const dialogsWanted = computed(() => pageSettled.value || capture.paletteOpen || capture.quickAddOpen || library.editing !== null)
onMounted(() => {
  setTimeout(() => {
    pageSettled.value = true
    // Only for code and shortcut hints, which read fine in the system's monospace until then.
    void import('@fontsource-variable/jetbrains-mono')
  }, AFTER_LOAD_MS)
})

const isMac = /mac/i.test(navigator.userAgent)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    // Otherwise some browsers would move focus to their own search box.
    event.preventDefault()
    capture.paletteOpen = !capture.paletteOpen
  }
})
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
    <!-- Desktop sidebar -->
    <aside
      class="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-4 md:flex"
    >
      <div class="flex items-center gap-2 px-2 pt-1 font-semibold tracking-tight">
        <span class="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
          <BrandIcon :size="16" aria-hidden="true" />
        </span>
        LinguaForge
      </div>

      <button type="button" class="lf-btn justify-between" @click="capture.openQuickAdd()">
        <span class="flex items-center gap-2">
          <Plus :size="15" aria-hidden="true" />
          {{ t('capture.add') }}
        </span>
        <kbd class="font-mono text-xs text-muted">{{ isMac ? '⌘K' : 'Ctrl K' }} +</kbd>
      </button>

      <nav :aria-label="t('nav.main')" class="flex flex-col gap-0.5" data-testid="sidebar">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.name"
          :to="item.path"
          class="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
          exact-active-class="bg-accent-soft font-medium !text-ink"
        >
          <component :is="item.icon" :size="17" aria-hidden="true" />
          {{ t(`nav.${item.label}`) }}
        </RouterLink>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-col">
      <!-- Mobile header: reaches the pages that don't fit in the tab bar -->
      <header
        class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur md:hidden"
      >
        <span class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
            <BrandIcon :size="16" aria-hidden="true" />
          </span>
          LinguaForge
        </span>
        <RouterLink
          :to="settingsItem.path"
          :aria-label="t('nav.settings')"
          class="-m-2 grid size-11 place-items-center rounded-lg text-muted"
        >
          <component :is="settingsItem.icon" :size="20" aria-hidden="true" />
        </RouterLink>
      </header>

      <!-- Reading pages stay narrow. The Library uses the full width for its wide table. -->
      <main
        class="mx-auto w-full min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-10"
        :class="!route.meta.wide && 'max-w-5xl'"
      >
        <RouterView v-slot="{ Component }">
          <Transition name="page">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Mobile Quick Add, within thumb reach above the tab bar -->
    <button
      type="button"
      :aria-label="t('capture.quickAddTitle')"
      v-if="route.name !== 'review' && route.name !== 'tutor'"
      class="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg md:hidden"
      data-testid="quick-add-fab"
      @click="capture.openQuickAdd()"
    >
      <Plus :size="24" aria-hidden="true" />
    </button>

    <template v-if="dialogsWanted">
      <CommandPalette />
      <QuickAddDialog />
      <EntryEditor />
    </template>
    <ToastList />

    <!-- Mobile tab bar -->
    <nav
      :aria-label="t('nav.main')"
      class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      data-testid="tabbar"
    >
      <RouterLink
        v-for="item in mobileTabs"
        :key="item.name"
        :to="item.path"
        class="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted"
        exact-active-class="!text-accent font-medium"
      >
        <component :is="item.icon" :size="20" aria-hidden="true" />
        {{ t(`nav.${item.label}`) }}
      </RouterLink>
    </nav>
  </div>
</template>
