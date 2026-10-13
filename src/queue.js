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

/**
 * Queue writes made while offline and send them in order. Safari has no Background Sync, so this
 * runs in the page: it flushes after every push, on `online`, `visibilitychange` and `pageshow`,
 * and once at start for what a previous session left behind.
 *
 * `send` returns the server's Response, or throws when the network is down. A response marked
 * `X-Offline: 1` (from the service worker) counts as down; both leave the op queued. Any other
 * non-ok response drops the op and calls `onDrop`; it is never retried.
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
  const ops = /** @type {Op[]} */ ((await store.get(KEY)) ?? [])
  /** @type {Promise<void> | undefined} */
  let running

  const run = async () => {
    while (ops.length) {
      /** @type {Response} */
      let res
      try {
        res = await send(ops[0])
      } catch {
        return
      }
      if (res.headers.get('X-Offline') === '1') return
      const op = /** @type {Op} */ (ops.shift())
      try {
        await store.set(KEY, ops)
      } catch {
        // the op was handled; a failed save only means it may be sent again after a reload
      }
      if (!res.ok) onDrop(op, res)
    }
  }
  // one run at a time; callers during a run wait for it, and it also sends what they pushed
  const flush = () => (running ??= run().finally(() => (running = undefined)))

  for (const t of ['online', 'visibilitychange', 'pageshow'])
    globalThis.addEventListener?.(t, flush)
  flush()

  return {
    async push(op) {
      if (ops.length >= max) throw new Error(`queue is full (${max})`)
      ops.push(op)
      await store.set(KEY, ops)
      flush()
    },
    flush,
    size: () => ops.length,
  }
}
