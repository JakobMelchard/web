// Classic script for importScripts(), not a module. The app's own /sw.js sets
//   self.WEB_SW = { cache, shell, network: { timeoutMs }, offlinePage }
// first. shell is the list of URLs to precache and keep fresh; offlinePage is one of them.
// register.js puts the shell version in ?v=, which names the cache, so a new version gets a
// new cache and the old ones are deleted on activate.
;(() => {
  /**
   * @typedef {{ request: Request, waitUntil: (p: Promise<unknown>) => void, respondWith: (r: Promise<Response>) => void }} Ev
   * @typedef {{ cache: string, shell: string[], network: { timeoutMs: number }, offlinePage: string }} Config
   * @typedef {{ WEB_SW: Config, location: Location, skipWaiting: () => Promise<void>, clients: { claim: () => Promise<void> }, addEventListener: (type: string, f: (e: Ev) => void) => void }} Sw
   */
  // ServiceWorkerGlobalScope, typed by hand: the webworker lib clashes with dom in one tsconfig
  const sw = /** @type {Sw} */ (/** @type {unknown} */ (self))
  const { cache, shell, network, offlinePage } = sw.WEB_SW
  const name = `${cache}-${new URL(sw.location.href).searchParams.get('v')}`
  const shellUrls = new Set(shell.map((u) => new URL(u, sw.location.href).href))

  sw.addEventListener('install', (e) => {
    e.waitUntil(
      caches
        .open(name)
        // past the HTTP cache, which would precache the previous deploy
        .then((c) => c.addAll(shell.map((u) => new Request(u, { cache: 'reload' }))))
        .then(() => sw.skipWaiting()),
    )
  })

  sw.addEventListener('activate', (e) => {
    e.waitUntil(
      caches
        .keys()
        .then((ks) =>
          Promise.all(
            ks.filter((k) => k.startsWith(`${cache}-`) && k !== name).map((k) => caches.delete(k)),
          ),
        )
        .then(() => sw.clients.claim()),
    )
  })

  sw.addEventListener('fetch', (e) => {
    const req = e.request
    if (req.method !== 'GET' || new URL(req.url).origin !== sw.location.origin) return
    e.respondWith(
      // a host that is down or asleep keeps a connection pending for a long time
      fetch(req, { signal: AbortSignal.timeout(network.timeoutMs) })
        .then((res) => {
          // clone before the page reads the body
          const copy = res.ok && shellUrls.has(req.url) ? res.clone() : null
          if (copy) e.waitUntil(caches.open(name).then((c) => c.put(req, copy)))
          return res
        })
        .catch(async () => {
          const c = await caches.open(name)
          // marks answers that are not live, so the page can queue its writes
          const hit =
            (await c.match(req)) ??
            (req.mode === 'navigate' ? await c.match(offlinePage) : undefined)
          const headers = new Headers(hit?.headers)
          headers.set('X-Offline', '1')
          return hit
            ? new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers })
            : new Response(null, { status: 503, headers })
        }),
    )
  })
})()
