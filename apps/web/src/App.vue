<script setup lang="ts">
import { useTheme } from './app/theme'
import { useReminderStore } from './features/reminders/reminderStore'
import AppShell from './shared/layout/AppShell.vue'

useTheme()
useReminderStore().resume()
</script>

<template>
  <AppShell />
</template>
