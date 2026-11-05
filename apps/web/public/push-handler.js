/* Loaded into the service worker. Reminders arrive here even when no tab is open. */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A push with no readable content still has to show something, as browsers require.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'LinguaForge', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      tag: 'lf-reminder',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      if (open) {
        open.navigate('/').catch(() => {})
        return open.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
