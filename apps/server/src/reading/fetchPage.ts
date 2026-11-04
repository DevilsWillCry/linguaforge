import { lookup } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'

export type PageErrorCode = 'invalid_url' | 'blocked_url' | 'fetch_failed' | 'not_html' | 'too_large'

export class PageError extends Error {
  constructor(readonly code: PageErrorCode) {
    super(code)
  }
}

const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5

const INTERNAL = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  INTERNAL.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  INTERNAL.addSubnet(network, prefix, 'ipv6')
}

/** Whether an address belongs to the public internet. Anything unrecognized counts as internal. */
export function isPublicAddress(address: string): boolean {
  // An IPv4 address written in IPv6 form must not slip past the IPv4 rules.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
  const value = mapped ?? address
  const family = isIP(value)
  if (family === 4) return !INTERNAL.check(value, 'ipv4')
  if (family === 6) return !INTERNAL.check(value, 'ipv6')
  return false
}

/** Only ordinary web addresses. Other ports would let a link probe services on a host. */
export function parsePageUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new PageError('invalid_url')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new PageError('invalid_url')
  if (url.username || url.password) throw new PageError('invalid_url')
  if (url.port && url.port !== '80' && url.port !== '443') throw new PageError('blocked_url')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !isPublicAddress(host)) throw new PageError('blocked_url')
  if (host === 'localhost' || host.endsWith('.localhost')) throw new PageError('blocked_url')
  return url
}

/**
 * Checks the address at the moment of connecting. Checking the name beforehand wouldn't be
 * enough, because it could resolve to a public address once and an internal one the next time.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 0)
      return
    }
    if (!addresses.length || !addresses.every(({ address }) => isPublicAddress(address))) {
      callback(Object.assign(new Error('Blocked address'), { code: 'EBLOCKEDADDRESS' }), '', 0)
      return
    }
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0]!.address, addresses[0]!.family)
  })
}

interface RawResponse {
  status: number
  location?: string
  contentType: string
  body: Buffer
}

function fetchOnce(url: URL): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        method: 'GET',
        lookup: publicOnlyLookup,
        timeout: TIMEOUT_MS,
        headers: {
          // A real browser-like Accept, and no email or personal details.
          accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8',
          'user-agent': 'LinguaForge/0.1 (personal reading tool)',
        },
      },
      (response: IncomingMessage) => {
        const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
        const status = response.statusCode ?? 0
        const location = response.headers.location
        const base = { status, contentType, ...(location ? { location } : {}) }
        if (status >= 300 && status < 400) {
          response.resume()
          resolve({ ...base, body: Buffer.alloc(0) })
          return
        }
        if (status < 200 || status >= 300) {
          response.resume()
          reject(new PageError('fetch_failed'))
          return
        }
        if (contentType && !/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
          response.destroy()
          reject(new PageError('not_html'))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            response.destroy()
            reject(new PageError('too_large'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => resolve({ ...base, body: Buffer.concat(chunks) }))
        response.on('error', () => reject(new PageError('fetch_failed')))
      },
    )
    request.on('timeout', () => request.destroy(new PageError('fetch_failed')))
    request.on('error', (error: NodeJS.ErrnoException) => {
      if (error instanceof PageError) reject(error)
      else reject(new PageError(error.code === 'EBLOCKEDADDRESS' ? 'blocked_url' : 'fetch_failed'))
    })
    request.end()
  })
}

export interface FetchedPage {
  url: string
  contentType: string
  body: Buffer
}

/** Downloads a public web page, checking every redirect the same way as the first address. */
export async function fetchPublicPage(raw: string): Promise<FetchedPage> {
  let url = parsePageUrl(raw)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchOnce(url)
    if (response.status < 300) return { url: url.href, contentType: response.contentType, body: response.body }
    if (!response.location) throw new PageError('fetch_failed')
    url = parsePageUrl(new URL(response.location, url).href)
  }
  throw new PageError('fetch_failed')
}
