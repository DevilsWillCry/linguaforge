<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

defineProps<{ title: string; description?: string; wide?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <!-- A bottom sheet on phones keeps controls within thumb reach. -->
      <DialogContent
        :aria-describedby="description ? undefined : ''"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-card border border-line bg-surface shadow-2xl md:inset-x-auto md:top-[8vh] md:bottom-auto md:left-1/2 md:max-h-[84vh] md:w-full md:-translate-x-1/2 md:rounded-card"
        :class="wide ? 'md:max-w-3xl' : 'md:max-w-lg'"
      >
        <header class="flex items-start justify-between gap-4 px-5 pt-5">
          <div class="min-w-0">
            <DialogTitle class="font-semibold tracking-tight">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            :aria-label="t('common.close')"
            class="-m-2 grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised"
          >
            <X :size="18" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
