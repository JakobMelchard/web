self.WEB_SW = {
  cache: 'fixture',
  shell: ['/', '/web/tokens.css', '/web/base.css', '/web/register.js', '/web/queue.js'],
  network: { timeoutMs: 2000 },
  offlinePage: '/',
}
importScripts('/web/sw.js')
