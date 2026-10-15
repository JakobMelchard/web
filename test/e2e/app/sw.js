// The app's own worker: configure the shared one, then load it.
const sw = /** @type {{ WEB_SW: object, importScripts: (url: string) => void }} */ (
  /** @type {unknown} */ (self)
)
sw.WEB_SW = {
  cache: 'fixture',
  shell: ['/', '/app.js', '/web/tokens.css', '/web/base.css', '/web/register.js', '/web/queue.js'],
  network: { timeoutMs: 2000 },
  offlinePage: '/',
}
sw.importScripts('/web/sw.js')
