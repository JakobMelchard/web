// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { createQueue } from '../src/queue.js'

const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis))

// run f with stand-ins for browser globals
const stub = async (
  /** @type {Record<string, unknown>} */ globals,
  /** @type {() => Promise<void>} */ f,
) => {
  const old = Object.fromEntries(
    Object.keys(globals).map((k) => [k, Object.getOwnPropertyDescriptor(g, k)]),
  )
  for (const [k, value] of Object.entries(globals))
    Object.defineProperty(g, k, { value, configurable: true, writable: true })
  try {
    await f()
  } finally {
    for (const [k, d] of Object.entries(old)) d ? Object.defineProperty(g, k, d) : delete g[k]
  }
}

const ok = () => new Response('{}')
const memory = () => {
  const m = new Map()
  return {
    m,
    get: async (/** @type {string} */ k) => m.get(k),
    set: async (/** @type {string} */ k, /** @type {unknown} */ v) =>
      void m.set(k, structuredClone(v)),
  }
}
// a send that answers with `reply` and records the ops that were accepted
const sender = (/** @type {() => Response | Error} */ reply = ok) => {
  /** @type {number[]} */
  const sent = []
  let busy = false
  return {
    sent,
    send: async (/** @type {number} */ op) => {
      assert.equal(busy, false, 'sends overlap')
      busy = true
      await new Promise((r) => setTimeout(r))
      busy = false
      const r = reply()
      if (r instanceof Error) throw r
      if (r.ok) sent.push(op)
      return r
    },
  }
}
const drops = () => {
  /** @type {[number, number][]} */
  const dropped = []
  return {
    dropped,
    onDrop: (/** @type {number} */ op, /** @type {Response} */ res) =>
      dropped.push([op, res.status]),
  }
}

test('ops are sent in the order they were pushed', async () => {
  const { sent, send } = sender()
  const q = await createQueue({ send, onDrop: drops().onDrop, store: memory() })
  await Promise.all([1, 2, 3].map((n) => q.push(n)))
  await q.flush()
  assert.deepEqual(sent, [1, 2, 3])
  assert.equal(q.size(), 0)
})

test('a queue survives a reload and is sent at start', async () => {
  await stub({ indexedDB: new IDBFactory() }, async () => {
    const down = sender(() => new TypeError('offline'))
    const first = await createQueue({ send: down.send, onDrop: drops().onDrop })
    await first.push(1)
    await first.push(2)
    assert.equal(first.size(), 2)

    const up = sender()
    const second = await createQueue({ send: up.send, onDrop: drops().onDrop })
    assert.equal(second.size(), 2)
    await second.flush()
    assert.deepEqual(up.sent, [1, 2])
  })
})

test('without IndexedDB it uses localStorage', async () => {
  const m = new Map()
  const localStorage = {
    getItem: (/** @type {string} */ k) => m.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, v),
  }
  await stub({ indexedDB: undefined, localStorage }, async () => {
    const down = sender(() => new TypeError('offline'))
    await (await createQueue({ send: down.send, onDrop: drops().onDrop })).push(7)
    assert.equal(m.get('queue'), '[7]')
    const again = await createQueue({ send: down.send, onDrop: drops().onDrop })
    assert.equal(again.size(), 1)
  })
})

test('an injected store replaces both', async () => {
  const store = memory()
  const down = sender(() => new TypeError('offline'))
  const q = await createQueue({ send: down.send, onDrop: drops().onDrop, store })
  await q.push(5)
  assert.deepEqual(store.m.get('queue'), [5])
})

test('a refused op is dropped and reported, the ones behind it still go', async () => {
  const replies = [new Response('stale', { status: 409 }), ok()]
  const { sent, send } = sender(() => /** @type {Response} */ (replies.shift()))
  const { dropped, onDrop } = drops()
  const q = await createQueue({ send, onDrop, store: memory() })
  await q.push(1)
  await q.push(2)
  await q.flush()
  assert.deepEqual(dropped, [[1, 409]])
  assert.deepEqual(sent, [2])
  assert.equal(q.size(), 0)
})

test('a network error or an X-Offline answer leaves the op queued', async () => {
  const replies = [
    new TypeError('offline'),
    new Response(null, { status: 503, headers: { 'X-Offline': '1' } }),
    ok(),
  ]
  const { sent, send } = sender(() => /** @type {Response} */ (replies.shift()))
  const { dropped, onDrop } = drops()
  const q = await createQueue({ send, onDrop, store: memory() })
  await q.push(1)
  await q.flush()
  assert.equal(q.size(), 1)
  await q.flush()
  assert.equal(q.size(), 1)
  await q.flush()
  assert.deepEqual(sent, [1])
  assert.deepEqual(dropped, [])
})

test('a gateway, timeout or rate limit answer leaves the op queued', async () => {
  const replies = [502, 503, 504, 408, 429].map((status) => new Response(null, { status }))
  const { sent, send } = sender(() => replies.shift() ?? ok())
  const { dropped, onDrop } = drops()
  const q = await createQueue({ send, onDrop, store: memory() })
  await q.push(1)
  for (let i = 0; i < 5; i++) {
    await q.flush()
    assert.equal(q.size(), 1)
  }
  await q.flush()
  assert.deepEqual(sent, [1])
  assert.deepEqual(dropped, [])
})

test('an onDrop that throws does not stop the flush', async () => {
  const replies = [new Response('stale', { status: 409 }), ok()]
  const { sent, send } = sender(() => /** @type {Response} */ (replies.shift()))
  const q = await createQueue({
    send,
    onDrop: () => {
      throw new Error('caller bug')
    },
    store: memory(),
  })
  const error = console.error
  console.error = () => {}
  try {
    await q.push(1)
    await q.push(2)
    await q.flush()
  } finally {
    console.error = error
  }
  assert.deepEqual(sent, [2])
  assert.equal(q.size(), 0)
})

// a Web Locks stand-in: requests for one name run one at a time
const locks = () => {
  /** @type {Map<string, Promise<unknown>>} */
  const tail = new Map()
  return {
    request: (/** @type {string} */ name, /** @type {() => Promise<unknown>} */ f) => {
      const p = (tail.get(name) ?? Promise.resolve()).then(f)
      tail.set(name, p.catch(() => {}))
      return p
    },
  }
}

test('two tabs pushing to one store keep both ops', async () => {
  await stub({ navigator: { locks: locks() } }, async () => {
    const store = memory()
    const down = sender(() => new TypeError('offline'))
    const a = await createQueue({ send: down.send, onDrop: drops().onDrop, store })
    const b = await createQueue({ send: down.send, onDrop: drops().onDrop, store })
    await Promise.all([a.push(1), b.push(2)])
    assert.deepEqual(store.m.get('queue'), [1, 2])
  })
})

test('two tabs flushing one store send each op once', async () => {
  await stub({ navigator: { locks: locks() } }, async () => {
    const store = memory()
    await store.set('queue', [1, 2])
    /** @type {number[]} */
    const sent = []
    const send = async (/** @type {number} */ op) => {
      await new Promise((r) => setTimeout(r))
      sent.push(op)
      return ok()
    }
    const a = await createQueue({ send, onDrop: drops().onDrop, store })
    const b = await createQueue({ send, onDrop: drops().onDrop, store })
    await Promise.all([a.flush(), b.flush()])
    assert.deepEqual(sent, [1, 2])
    assert.deepEqual(store.m.get('queue'), [])
  })
})

test('a sent op is never sent again', async () => {
  const { sent, send } = sender()
  const q = await createQueue({ send, onDrop: drops().onDrop, store: memory() })
  await q.push(1)
  await q.flush()
  await q.flush()
  assert.deepEqual(sent, [1])
})

test('a store that fails to save does not break the flush or skip onDrop', async () => {
  const replies = [ok(), new Response('stale', { status: 409 })]
  const { sent, send } = sender(() => /** @type {Response} */ (replies.shift()))
  const { dropped, onDrop } = drops()
  const store = { get: async () => [1, 2], set: async () => Promise.reject(new Error('full')) }
  const q = await createQueue({ send, onDrop, store })
  await q.flush()
  assert.deepEqual(sent, [1])
  assert.deepEqual(dropped, [[2, 409]])
  assert.equal(q.size(), 0)
})

test('pushing into a full queue throws', async () => {
  const down = sender(() => new TypeError('offline'))
  const q = await createQueue({ send: down.send, onDrop: drops().onDrop, store: memory(), max: 2 })
  await q.push(1)
  await q.push(2)
  await assert.rejects(q.push(3), /full/)
  assert.equal(q.size(), 2)
})

test('online, visibilitychange and pageshow flush', async () => {
  /** @type {Record<string, () => void>} */
  const on = {}
  await stub(
    { addEventListener: (/** @type {string} */ t, /** @type {() => void} */ f) => (on[t] = f) },
    async () => {
      let up = false
      const { sent, send } = sender(() => (up ? ok() : new TypeError('offline')))
      const q = await createQueue({ send, onDrop: drops().onDrop, store: memory() })
      for (const [i, t] of ['online', 'visibilitychange', 'pageshow'].entries()) {
        up = false
        await q.push(i)
        await q.flush()
        assert.equal(sent.includes(i), false)
        up = true
        await /** @type {unknown} */ (on[t]())
        await new Promise((r) => setTimeout(r, 10))
        assert.equal(sent.includes(i), true, t)
      }
    },
  )
})
