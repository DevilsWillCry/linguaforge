<script setup lang="ts">
import { dismissToast, toasts, type Toast } from './useToasts'

function runAction(toast: Toast) {
  toast.action?.()
  dismissToast(toast.id)
}
</script>

<template>
  <!-- Stays mounted so screen readers announce toasts as they're added. -->
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-4 bottom-36 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      data-testid="toast"
      class="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border bg-raised px-4 py-2.5 text-sm shadow-lg"
      :class="toast.tone === 'error' ? 'border-danger' : 'border-line'"
    >
      <span>{{ toast.message }}</span>
      <button
        v-if="toast.action"
        type="button"
        class="min-h-8 shrink-0 font-medium text-accent underline-offset-2 hover:underline"
        @click="runAction(toast)"
      >
        {{ toast.actionLabel }}
      </button>
    </div>
  </div>
</template>
