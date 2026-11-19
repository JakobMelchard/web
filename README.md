# web

Shared PWA shell for small apps: design tokens, base CSS, manifest, service worker with
a queued write path, install page and update checks. Published as `@jakobmelchard/web`;
Go servers embed the same committed assets.

```text
tokens/ ──▶ dist/tokens.css ──▶ app CSS
src/sw.js ──▶ cache shell + offline page
src/queue.js ──▶ write queue ──▶ Web Locks ──▶ your send()
```

## Install

```sh
npm i @jakobmelchard/web
```

Import assets as `@jakobmelchard/web/<file>`; exports resolve to `dist/`.

## Usage

```js
// Application /sw.js; serve this package's sw.js at /web/sw.js.
self.WEB_SW = {
  cache: 'app',
  shell: ['/', '/static/app.js', '/static/style.css'],
  network: { timeoutMs: 4000 },
  offlinePage: '/',
}
importScripts('/web/sw.js')
```

- `offlinePage` must be in `shell`; offline responses carry `X-Offline: 1`.
- `register.js` exports `register({ version })`; `update.js` exports `watchUpdates({ url, onUpdate })`.
- `queue.js` exports `createQueue({ send, onDrop })`, returning a queue with `push(op)`.
- Network errors, offline responses and HTTP 408/429/502/503/504 retain queued operations; other failures drop them and call `onDrop`.
- Tabs coordinate with Web Locks. Optional `store: { get, set }` replaces IndexedDB/localStorage.

## Go

`embed.go` exposes `web.FS` and `web.Manifest` for Go servers.

## Development

```sh
npm ci
npm run build
npm run check
npm run lint
npm test
npm run e2e
go test ./...
```

Commit regenerated `dist/`; `check` rejects stale output. Browser tests use Chromium and
`CHROMIUM_PATH` selects an installed executable.

## Layout

```text
tokens/        token source and Python generator
src/           CSS, theme, manifest, service worker, queue and install UI
dist/          committed npm assets and Go embed input
embed.go       web.FS and web.Manifest for Go servers
test/          JavaScript tests, shared vectors and browser fixtures
```

## License

See [LICENSE](LICENSE).
