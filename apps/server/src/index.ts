import { serve } from '@hono/node-server'
import { createLocalSettings } from './ai/settings.js'
import { createApp } from './app.js'

const port = Number(process.env.API_PORT ?? 8787)
const settings = await createLocalSettings(process.env)

// Loopback only: this server holds API keys and must not be reachable from the LAN.
serve({ fetch: createApp(process.env, settings).fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}`)
})
