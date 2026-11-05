<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** The same numbers as text, so a chart's data never depends on seeing or hovering it. */
defineProps<{ columns: string[]; rows: (string | number)[][]; caption: string }>()
const { t } = useI18n()
</script>

<template>
  <details class="mt-3 text-xs">
    <summary class="inline-flex min-h-8 cursor-pointer items-center text-muted">{{ t('stats.viewTable') }}</summary>
    <div class="mt-2 max-h-56 overflow-y-auto">
      <table class="w-full text-left tabular-nums">
        <caption class="sr-only">{{ caption }}</caption>
        <thead>
          <tr class="text-muted">
            <th v-for="column in columns" :key="column" scope="col" class="py-1 pr-3 font-medium">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index" class="border-t border-line">
            <td v-for="(cell, cellIndex) in row" :key="cellIndex" class="py-1 pr-3">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
