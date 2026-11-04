import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
  actionLabel?: string
  action?: () => void
}

export const toasts = ref<Toast[]>([])
let nextId = 1

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

export function notify(message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
  const id = nextId++
  toasts.value = [...toasts.value, { id, message, tone: 'info', ...options }]
  // Toasts with an action like Undo stay longer, so there's time to use it.
  setTimeout(() => dismissToast(id), options.action ? 8000 : 4000)
}
