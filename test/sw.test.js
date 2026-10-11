// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const src = readFileSync(new URL('../src/sw.js', import.meta.url), 'utf8')
const base = 'https://app.test/'
const config = {
  cache: 'app',
  shell: ['/', '/app.js'],
  network: { timeoutMs: 20 },
  offlinePage: '/',
}

/** @typedef {Record<string, Record<string, Response>>} Stored caches by name, then url */
/** @typedef {{ url: string, cache: string }} Added */
/** @typedef {{ request: { method: string, mode: string, url: string }, waitUntil?: (p: Promise<unknown>) => void, respondWith?: (p: Promise<Response>) => void }} Ev */
/** @typedef {{ signal: AbortSignal }} Init */

// Run sw.js as importScripts would, against stand-ins for the worker globals.
// fetch defaults to a network that is down; stored seeds the caches.
const boot = (
  /** @type {{ fetch?: (r: unknown, init: Init) => Promise<Response>, stored?: Stored }} */ o = {},
) => {
  const { fetch = async () => Promise.reject(new TypeError('offline')), stored = {} } = o
  /** @type {Record<string, (e: Partial<Ev>) => void>} */
  const on = {}
  const log = { skipped: false, claimed: false, added: /** @type {Added[]} */ ([]) }
  const store = (/** @type {string} */ n) => (stored[n] ??= {})
  runInNewContext(src, {
    self: {
      WEB_SW: config,
      location: new URL('sw.js?v=2', base),
      addEventListener: (/** @type {string} */ t, /** @type {(e: Partial<Ev>) => void} */ f) =>
        (on[t] = f),
      skipWaiting: async () => (log.skipped = true),
      clients: { claim: async () => (log.claimed = true) },
    },
    caches: {
      open: async (/** @type {string} */ n) => ({
        addAll: async (/** @type {Added[]} */ rs) => log.added.push(...rs),
        put: async (/** @type {{ url: string }} */ r, /** @type {Response} */ res) =>
          (store(n)[r.url] = res),
        match: async (/** @type {string | { url: string }} */ r) =>
          store(n)[new URL(typeof r === 'string' ? r : r.url, base).href],
      }),
      keys: async () => Object.keys(stored),
      delete: async (/** @type {string} */ n) => delete stored[n],
    },
    Request: class {
      constructor(/** @type {string} */ u, /** @type {{ cache: string }} */ init) {
        this.url = new URL(u, base).href
        this.cache = init.cache
      }
    },
    fetch,
    URL,
    Response,
    Headers,
    AbortSignal,
  })
  const lifecycle = async (/** @type {string} */ type) => {
    /** @type {Promise<unknown>} */
    let p = Promise.resolve()
    on[type]({ waitUntil: (x) => (p = x) })
    await p
  }
  // one request through the fetch handler; undefined when the worker left it alone
  const get = async (
    /** @type {string} */ path,
    /** @type {{ method?: string, mode?: string }} */ { method = 'GET', mode = 'no-cors' } = {},
  ) => {
    /** @type {Promise<unknown>[]} */
    const waits = []
    /** @type {Promise<Response> | undefined} */
    let answer
    on.fetch({
      request: { method, mode, url: new URL(path, base).href },
      respondWith: (p) => (answer = p),
      waitUntil: (p) => waits.push(p),
    })
    const res = await answer
    await Promise.all(waits)
    return /** @type {Response} */ (res)
  }
  return { log, stored, lifecycle, get }
}

const ok = (/** @type {string} */ body) => new Response(body)

test('install precaches the shell past the HTTP cache, then takes over', async () => {
  const { log, lifecycle } = boot()
  await lifecycle('install')
  assert.deepEqual(
    log.added.map((r) => [r.url, r.cache]),
    [
      ['https://app.test/', 'reload'],
      ['https://app.test/app.js', 'reload'],
    ],
  )
  assert.ok(log.skipped)
})

test('activate deletes the caches of other versions and nothing else', async () => {
  const { stored, log, lifecycle } = boot({ stored: { 'app-1': {}, 'app-2': {}, 'other-1': {} } })
  await lifecycle('activate')
  assert.deepEqual(Object.keys(stored), ['app-2', 'other-1'])
  assert.ok(log.claimed)
})

test('online: the network answers and a shell file is stored', async () => {
  const { get, stored } = boot({ fetch: async () => ok('live') })
  assert.equal(await (await get('app.js')).text(), 'live')
  assert.ok(stored['app-2']['https://app.test/app.js'])
})

test('online: a file outside the shell is not stored', async () => {
  const { get, stored } = boot({ fetch: async () => ok('live') })
  await get('api/items')
  assert.deepEqual(stored['app-2'] ?? {}, {})
})

test('offline: a stored file is served and marked', async () => {
  const { get } = boot({ stored: { 'app-2': { 'https://app.test/app.js': ok('stored') } } })
  const res = await get('app.js')
  assert.equal(await res.text(), 'stored')
  assert.equal(res.headers.get('X-Offline'), '1')
})

test('offline: a page load falls back to the offline page', async () => {
  const { get } = boot({ stored: { 'app-2': { 'https://app.test/': ok('shell') } } })
  assert.equal(await (await get('some/page', { mode: 'navigate' })).text(), 'shell')
})

test('offline: anything else that is not stored fails, marked', async () => {
  const res = await boot().get('api/items')
  assert.equal(res.status, 503)
  assert.equal(res.headers.get('X-Offline'), '1')
})

test('a network that hangs falls back to the stored file after the timeout', async () => {
  // AbortSignal.timeout does not keep the process alive, so a hung fetch would end the run
  const alive = setTimeout(() => {}, 5000)
  const hang = (/** @type {unknown} */ _, /** @type {Init} */ { signal }) =>
    new Promise((_, no) => signal.addEventListener('abort', () => no(signal.reason)))
  const { get } = boot({
    fetch: /** @type {() => Promise<Response>} */ (hang),
    stored: { 'app-2': { 'https://app.test/app.js': ok('stored') } },
  })
  assert.equal(await (await get('app.js')).text(), 'stored')
  clearTimeout(alive)
})

test('other methods and other origins are left alone', async () => {
  const { get } = boot({ fetch: async () => ok('live') })
  assert.equal(await get('app.js', { method: 'POST' }), undefined)
  assert.equal(await get('https://cdn.test/x.js'), undefined)
})
