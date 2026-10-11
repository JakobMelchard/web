// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { chromium } from 'playwright-core'

/** @typedef {{ queue: { push: (op: unknown) => Promise<void>, size: () => number } }} App */

const types = /** @type {Record<string, string>} */ ({
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
})

// the fixture app at /, the package's dist/ at /web/, and an endpoint that records what is saved
const serve = () => {
  /** @type {string[]} */
  const saved = []
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      saved.push(body)
      return res.end('{}')
    }
    const file = path.startsWith('/web/')
      ? new URL(`../../dist/${path.slice(5)}`, import.meta.url)
      : new URL(`./app/${path === '/' ? 'index.html' : path.slice(1)}`, import.meta.url)
    try {
      res.setHeader('content-type', types[file.pathname.split('.').pop() ?? ''] ?? 'text/plain')
      res.end(await readFile(file))
    } catch {
      res.statusCode = 404
      res.end()
    }
  })
  return new Promise((ok) =>
    server.listen(0, () =>
      ok({
        server,
        saved,
        url: `http://localhost:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`,
      }),
    ),
  )
}

test('install page, worker, offline shell and queued write', async () => {
  const { server, saved, url } =
    await /** @type {Promise<{ server: import('node:http').Server, saved: string[], url: string }>} */ (
      serve()
    )
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const ctx = await browser.newContext()
    /** @type {string[]} */
    const errors = []
    // unhandled rejections inside the worker do not reach the page console on their own
    ctx.on('serviceworker', (w) => {
      w.evaluate(() =>
        self.addEventListener('unhandledrejection', (e) => console.error('sw: ' + e.reason)),
      ).catch(() => {})
      w.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto(`${url}/web/install.html`)
    assert.equal(await page.textContent('h1'), 'Install')

    await page.goto(url)
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)

    // empty the cache, so only the worker's refresh can fill it again
    await page.evaluate(async () => {
      const c = await caches.open('fixture-1')
      for (const k of await c.keys()) await c.delete(k)
    })
    await page.reload()
    await page.waitForFunction(
      async () => (await (await caches.open('fixture-1')).keys()).length > 0,
    )

    await ctx.setOffline(true)
    await page.reload()
    assert.equal(await page.textContent('h1'), 'fixture shell')
    await page.evaluate(() =>
      /** @type {App} */ (/** @type {unknown} */ (window)).queue.push({ edit: 1 }),
    )
    assert.deepEqual(saved, [])

    await ctx.setOffline(false)
    // setOffline leaves navigator.onLine alone and fires nothing
    await page.evaluate(() => dispatchEvent(new Event('online')))
    await page.waitForFunction(
      () => /** @type {App} */ (/** @type {unknown} */ (window)).queue.size() === 0,
    )
    assert.deepEqual(saved, ['{"edit":1}'])
    assert.deepEqual(
      errors.filter((e) => !e.includes('Failed to load resource')),
      [],
    )
  } finally {
    await browser.close()
    server.close()
  }
})
