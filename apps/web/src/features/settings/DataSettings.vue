<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { backupProblem, createBackup, deleteEverything, restoreBackup, type Backup } from '@/data/backup'
import { datedFileName, downloadFile } from '@/shared/download'
import AppModal from '@/shared/ui/AppModal.vue'
import { notify } from '@/shared/ui/useToasts'

const { t } = useI18n()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const pendingBackup = shallowRef<Backup | null>(null)
const deleteOpen = ref(false)
const deleteText = ref('')

const restoreOpen = computed({
  get: () => pendingBackup.value !== null,
  set: (value) => {
    if (!value) pendingBackup.value = null
  },
})

const restoreDetails = computed(() => ({
  n: pendingBackup.value?.tables.entries?.length ?? 0,
  date: pendingBackup.value ? new Date(pendingBackup.value.exportedAt).toLocaleDateString() : '',
}))

function fail(error: unknown) {
  console.error(error)
  notify(t('errors.save'), { tone: 'error' })
}

async function exportAll() {
  try {
    const name = datedFileName('backup', 'json')
    downloadFile(name, JSON.stringify(await createBackup(), null, 2), 'application/json')
    notify(t('export.done', { name }))
  } catch (error) {
    fail(error)
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Clearing it lets the same file be chosen again after cancelling.
  input.value = ''
  if (!file) return
  try {
    const data: unknown = JSON.parse(await file.text())
    const problem = backupProblem(data)
    if (problem) {
      notify(t(`settings.data.problems.${problem}`), { tone: 'error' })
      return
    }
    pendingBackup.value = data as Backup
  } catch (error) {
    console.error(error)
    notify(t('settings.data.problems.notBackup'), { tone: 'error' })
  }
}

async function confirmRestore() {
  if (!pendingBackup.value) return
  try {
    await restoreBackup(pendingBackup.value)
    notify(t('settings.data.restored'))
    pendingBackup.value = null
  } catch (error) {
    fail(error)
  }
}

const canDelete = computed(() => deleteText.value.trim() === t('settings.data.deleteWord'))

function openDelete() {
  deleteText.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!canDelete.value) return
  try {
    await deleteEverything()
    notify(t('settings.data.deleted'))
    deleteOpen.value = false
  } catch (error) {
    fail(error)
  }
}
</script>

<template>
  <section class="rounded-card border border-line bg-surface p-5">
    <h2 class="font-semibold">{{ t('settings.data.title') }}</h2>
    <p class="mt-1 text-sm text-muted">{{ t('settings.data.description') }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" class="lf-btn" data-testid="backup-export" @click="exportAll">
        {{ t('settings.data.export') }}
      </button>
      <button type="button" class="lf-btn" @click="fileInput?.click()">{{ t('settings.data.restore') }}</button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="hidden"
        data-testid="backup-file"
        @change="onFile"
      />
      <button type="button" class="lf-btn lf-btn-danger" @click="openDelete">{{ t('settings.data.delete') }}</button>
    </div>

    <AppModal
      v-model:open="restoreOpen"
      :title="t('settings.data.restoreTitle')"
      :description="t('settings.data.restoreBody', restoreDetails)"
    >
      <div class="flex justify-end gap-2">
        <button type="button" class="lf-btn" @click="restoreOpen = false">{{ t('settings.data.cancel') }}</button>
        <button type="button" class="lf-btn lf-btn-danger" @click="confirmRestore">
          {{ t('settings.data.restoreConfirm') }}
        </button>
      </div>
    </AppModal>

    <AppModal
      v-model:open="deleteOpen"
      :title="t('settings.data.deleteTitle')"
      :description="t('settings.data.deleteBody', { word: t('settings.data.deleteWord') })"
    >
      <form class="flex flex-col gap-3" @submit.prevent="confirmDelete">
        <input
          v-model="deleteText"
          type="text"
          autocomplete="off"
          class="lf-input"
          :aria-label="t('settings.data.deleteWord')"
          data-testid="delete-confirm-input"
        />
        <div class="flex justify-end gap-2">
          <button type="button" class="lf-btn" @click="deleteOpen = false">{{ t('settings.data.cancel') }}</button>
          <button type="submit" class="lf-btn lf-btn-danger" :disabled="!canDelete">
            {{ t('settings.data.deleteConfirm') }}
          </button>
        </div>
      </form>
    </AppModal>
  </section>
</template>
