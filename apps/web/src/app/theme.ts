import { useLocalStorage, usePreferredColorScheme } from '@vueuse/core'
import { computed, watchEffect } from 'vue'

export type ThemeMode = 'auto' | 'dark' | 'light'

// Keep this key and rule in sync with the inline script in index.html.
const mode = useLocalStorage<ThemeMode>('lf-theme', 'auto')

export function useTheme() {
  const preferred = usePreferredColorScheme()
  // Auto follows the OS. Browsers report "light" when the OS has no preference set.
  const resolved = computed(() =>
    mode.value === 'auto' ? (preferred.value === 'light' ? 'light' : 'dark') : mode.value,
  )

  watchEffect(() => {
    document.documentElement.classList.toggle('dark', resolved.value === 'dark')
  })

  return { mode, resolved }
}
