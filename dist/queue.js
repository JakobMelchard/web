// @ts-check

/**
 * @typedef {{ get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<void> }} Store
 */

const KEY = 'queue'

// IndexedDB, else localStorage. Not durable inside a Capacitor WebView: pass a Preferences store there.
const browserStore = () => {
  /** @type {Promise<IDBDatabase> | undefined} */
  let opened
  const db = () =>
    (opened ??= new Promise((ok, no) => {
      const r = indexedDB.open('web', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('kv')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    }))
  const req = (
    /** @type {IDBTransactionMode} */ mode,
    /** @type {(s: IDBObjectStore) => IDBRequest} */ f,
  ) =>
    db().then(
      (d) =>
        new Promise((ok, no) => {
          const q = f(d.transaction('kv', mode).objectStore('kv'))
          q.onsuccess = () => ok(q.result)
          q.onerror = () => no(q.error)
        }),
    )
  return {
    async get(/** @type {string} */ k) {
      try {
        return await req('readonly', (s) => s.get(k))
      } catch {
        // no IndexedDB
      }
      try {
        return JSON.parse(localStorage.getItem(k) ?? 'null')
      } catch {
        return null
      }
    },
    async set(/** @type {string} */ k, /** @type {unknown} */ v) {
      try {
        await req('readwrite', (s) => s.put(v, k))
        return
      } catch {
        // no IndexedDB
      }
      try {
        localStorage.setItem(k, JSON.stringify(v))
      } catch {
        // storage unavailable
      }
    },
  }
}

// statuses a sleeping host, its proxy or a rate limiter answer with; the op is retried later
const RETRY = new Set([408, 429, 502, 503, 504])

/** @type {Map<string, Promise<unknown>>} */
const tails = new Map()

/**
 * Run f while holding the Web Lock `name`, so tabs that share the store take turns. Without Web
 * Locks, calls in this page still take turns.
 * @template T
 * @param {string} name lock name
 * @param {() => Promise<T>} f runs while the lock is held
 * @returns {Promise<T>} what f resolves to
 */
const lock = (name, f) => {
  if (globalThis.navigator?.locks)
    return /** @type {Promise<T>} */ (navigator.locks.request(name, f))
  const p = (tails.get(name) ?? Promise.resolve()).then(f)
  tails.set(name, p.catch(() => {}))
  return p
}

/**
 * Queue writes made while offline and send them in order. Safari has no Background Sync, so this
 * runs in the page: it flushes after every push, on `online`, `visibilitychange` and `pageshow`,
 * and once at start for what a previous session left behind. Tabs sharing the store coordinate
 * through Web Locks: none overwrites another's ops and each op is sent by one tab.
 *
 * `send` returns the server's Response, or throws when the network is down. A response marked
 * `X-Offline: 1` (from the service worker) counts as down; both leave the op queued, as do 408,
 * 429, 502, 503 and 504. Any other non-ok response drops the op and calls `onDrop`; it is never
 * retried.
 * @template Op JSON-serializable
 * @param {object} o options
 * @param {(op: Op) => Promise<Response>} o.send sends one op
 * @param {(op: Op, res: Response) => void} o.onDrop reports a refused op
 * @param {Store} [o.store] defaults to IndexedDB, then localStorage
 * @param {number} [o.max] pushing into a full queue throws
 * @returns {Promise<{ push: (op: Op) => Promise<void>, flush: () => Promise<void>, size: () => number }>} ready once storage is read
 */
export const createQueue = async ({ send, onDrop, store = browserStore(), max = 500 }) => {
  /** @type {Op[]} */
  let ops = []
  // after a failed save the store is behind this tab, so the copy in memory wins until a save works
  let saved = true
  const load = async () => {
    if (saved) ops = /** @type {Op[]} */ ((await store.get(KEY)) ?? [])
    return ops
  }
  // another tab may have saved since this one last read
  const save = (/** @type {(ops: Op[]) => void} */ change) =>
    lock('web-queue', async () => {
      change(await load())
      try {
        await store.set(KEY, ops)
        saved = true
      } catch (e) {
        saved = false
        throw e
      }
    })
  /** @type {Promise<void> | undefined} */
  let running

  // one sender across tabs; only it removes ops, pushes only append, so the head stays put while it sends
  const run = () =>
    lock('web-queue-send', async () => {
      for (;;) {
        const queued = await lock('web-queue', load)
        if (!queued.length) return
        const op = queued[0]
        /** @type {Response} */
        let res
        try {
          res = await send(op)
        } catch {
          return
        }
        if (res.headers.get('X-Offline') === '1' || RETRY.has(res.status)) return
        try {
          await save((ops) => ops.shift())
        } catch {
          // the op was handled; a failed save only means it may be sent again after a reload
        }
        try {
          if (!res.ok) onDrop(op, res)
        } catch (e) {
          console.error(e)
        }
      }
    })
  // one run at a time; callers during a run wait for it, and it also sends what they pushed
  const flush = () => (running ??= run().finally(() => (running = undefined)))
  const kick = () => void flush().catch(console.error)

  await load()
  for (const t of ['online', 'visibilitychange', 'pageshow']) globalThis.addEventListener?.(t, kick)
  kick()

  return {
    async push(op) {
      await save((ops) => {
        if (ops.length >= max) throw new Error(`queue is full (${max})`)
        ops.push(op)
      })
      kick()
    },
    flush,
    size: () => ops.length,
  }
}
