// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from '../src/register.js'
import { watchUpdates } from '../src/update.js'

const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis))

// run f with a stand-in for one of the browser globals
const stub = async (
  /** @type {string} */ key,
  /** @type {unknown} */ value,
  /** @type {() => Promise<void> | void} */ f,
) => {
  const old = Object.getOwnPropertyDescriptor(g, key)
  Object.defineProperty(g, key, { value, configurable: true, writable: true })
  try {
    await f()
  } finally {
    if (old) Object.defineProperty(g, key, old)
    else delete g[key]
  }
}

test('register puts the version in the script URL, at scope /', async () => {
  /** @type {unknown[]} */
  const calls = []
  const serviceWorker = { register: (/** @type {unknown[]} */ ...a) => calls.push(a) }
  await stub('navigator', { serviceWorker }, () => void register({ version: 'a b' }))
  assert.deepEqual(calls, [['/sw.js?v=a%20b', { scope: '/' }]])
})

test('register does nothing without service workers', async () => {
  await stub('navigator', {}, () => assert.equal(register({ version: '1' }), undefined))
})

// foreground the page and let the check finish
const foreground = async (/** @type {EventTarget} */ doc) => {
  doc.dispatchEvent(new Event('visibilitychange'))
  await new Promise((r) => setTimeout(r))
}

// watch a page whose deployed version is read from `served`; returns what onUpdate got
const watch = async (
  /** @type {{ version: string }} */ served,
  /** @type {(doc: EventTarget) => Promise<void>} */ f,
) => {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  /** @type {string[]} */
  const updates = []
  await stub('document', doc, () =>
    stub(
      'fetch',
      async () => ({ json: async () => served }),
      async () => {
        watchUpdates({ url: 'version', onUpdate: (v) => updates.push(v) })
        await new Promise((r) => setTimeout(r))
        await f(doc)
      },
    ),
  )
  return updates
}

test('no notice while the deployed version is the running one', async () => {
  const updates = await watch({ version: '1' }, foreground)
  assert.deepEqual(updates, [])
})

test('a notice when the deployed version differs', async () => {
  const served = { version: '1' }
  const updates = await watch(served, async (doc) => {
    served.version = '2'
    await foreground(doc)
  })
  assert.deepEqual(updates, ['2'])
})

test('a failing check is silent', async () => {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  /** @type {string[]} */
  const updates = []
  await stub('document', doc, () =>
    stub(
      'fetch',
      async () => Promise.reject(new TypeError('offline')),
      async () => {
        watchUpdates({ url: 'version', onUpdate: (v) => updates.push(v) })
        await foreground(doc)
      },
    ),
  )
  assert.deepEqual(updates, [])
})
