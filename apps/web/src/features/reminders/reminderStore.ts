import { useLocalStorage } from '@vueuse/core'
import { liveQuery, type Subscription } from 'dexie'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { i18n } from '@/app/i18n'
import { statsRepository } from '@/data/repositories'
import { dayKey, outputDays } from '@/domain/analytics'
import { notify } from '@/shared/ui/useToasts'

const { t } = i18n.global
const JSON_HEADERS = { 'content-type': 'application/json' }
const WORKER_WAIT_MS = 8000

/** The browser wants the key as raw bytes, and servers hand it out as base64url. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('No service worker')), WORKER_WAIT_MS)
  })
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export const useReminderStore = defineStore('reminders', () => {
  /** Remembered here so a normal visit can check it without asking the server. */
  const enabled = useLocalStorage('lf-reminders-on', false)
  const time = useLocalStorage('lf-reminder-time', '19:00')
  /** The last day already reported, so each day is only sent once. */
  const reportedDay = useLocalStorage('lf-reminder-reported-day', '')
  const busy = ref(false)
  const blocked = ref(false)
  let watching: Subscription | null = null

  const supported = computed(() => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)

  function outputToday() {
    return reportedDay.value === dayKey(new Date()) ? { outputDay: reportedDay.value } : {}
  }

  async function savePlan(subscription: PushSubscription) {
    const { endpoint, keys } = subscription.toJSON()
    const response = await fetch('/api/reminders', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        subscription: { endpoint, keys },
        time: time.value,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        title: 'LinguaForge',
        body: t('settings.reminders.message'),
        ...outputToday(),
      }),
    })
    if (!response.ok) throw new Error(`Saving the reminder failed: ${response.status}`)
  }

  /** Tells the server once today has real output, because then the reminder isn't needed. */
  function watchOutput() {
    if (watching) return
    watching = liveQuery(async () => {
      const { logs, conversations, sessions } = await statsRepository.outputFacts()
      return outputDays(logs, conversations, sessions).has(dayKey(new Date()))
    }).subscribe({
      next: (done) => {
        const today = dayKey(new Date())
        if (!done || reportedDay.value === today) return
        reportedDay.value = today
        void fetch('/api/reminders/progress', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ outputDay: today }) }).catch(() => {
          // Not worth bothering anyone: the worst case is one reminder too many.
        })
      },
      error: (error) => console.error(error),
    })
  }

  function stopWatching() {
    watching?.unsubscribe()
    watching = null
  }

  async function load() {
    try {
      const response = await fetch('/api/reminders')
      if (!response.ok) return
      const state = (await response.json()) as { enabled: boolean; time: string | null }
      // The server can remember a browser whose data was cleared since, which gets nothing.
      const registration = state.enabled ? await serviceWorker().catch(() => null) : null
      enabled.value = state.enabled && Boolean(await registration?.pushManager.getSubscription())
      if (state.time) time.value = state.time
      if (enabled.value) watchOutput()
    } catch {
      // The server isn't running. Reminders can't work without it, and Settings says so.
    }
  }

  async function enable() {
    if (busy.value) return
    busy.value = true
    blocked.value = false
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        blocked.value = true
        return
      }
      const key = (await (await fetch('/api/reminders')).json()) as { publicKey: string }
      const registration = await serviceWorker()
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.publicKey) }))
      await savePlan(subscription)
      enabled.value = true
      watchOutput()
    } catch (error) {
      console.error(error)
      notify(t('settings.reminders.failed'), { tone: 'error' })
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    if (busy.value) return
    busy.value = true
    try {
      const registration = await serviceWorker().catch(() => null)
      await (await registration?.pushManager.getSubscription())?.unsubscribe()
      await fetch('/api/reminders', { method: 'DELETE', headers: JSON_HEADERS })
      enabled.value = false
      stopWatching()
    } catch (error) {
      console.error(error)
      notify(t('settings.reminders.failed'), { tone: 'error' })
    } finally {
      busy.value = false
    }
  }

  async function setTime(next: string) {
    time.value = next
    if (!enabled.value) return
    try {
      const subscription = await (await serviceWorker()).pushManager.getSubscription()
      if (subscription) await savePlan(subscription)
    } catch (error) {
      console.error(error)
      notify(t('settings.reminders.failed'), { tone: 'error' })
    }
  }

  async function sendTest() {
    const response = await fetch('/api/reminders/test', { method: 'POST', headers: JSON_HEADERS, body: '{}' }).catch(() => null)
    notify(t(response?.ok ? 'settings.reminders.testSent' : 'settings.reminders.failed'), { tone: response?.ok ? 'info' : 'error' })
  }

  /** On each visit, so output counts wherever it happens. Skipped for anyone without reminders. */
  function resume() {
    if (enabled.value) void load()
  }

  return { enabled, time, busy, blocked, supported, load, resume, enable, disable, setTime, sendTest }
})
