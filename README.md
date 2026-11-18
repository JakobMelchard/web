# web

## Purpose

- Shared PWA shell: design tokens, CSS, manifest, service worker, install page, offline write queue and update checks.
- Published as `@jakobmelchard/web`; Go servers embed the same committed assets.

## Layout

```text
tokens/        Token source and Python generator
src/           CSS, theme, manifest, service worker, queue and install UI
dist/          Committed npm assets and Go embed input
embed.go       web.FS and web.Manifest for Go servers
test/          JavaScript tests, shared vectors and browser fixtures
.github/       CI, release and npm publish workflows
```

## Usage

```sh
npm ci
npm run build
npm run check
npm run lint
npm test
npm run e2e
go test ./...
```

- Commit regenerated `dist/`. `check` rejects stale output.
- Browser tests use Chromium; `CHROMIUM_PATH` selects an installed executable.
- Import assets with `@jakobmelchard/web/<file>`; exports resolve to `dist/`.

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

## Operate

- Owner: JakobMelchard. Library only; consumer apps own deployment.
- Release-please owns versions and `CHANGELOG.md`.
- Deploy: `.github/workflows/publish.yml` stages npm publication on `v*` tags using OIDC; owner approval with 2FA makes the staged version live.
- Rollback: consumers pin a prior npm version or Go tag; no automated package rollback is defined.
- CI: `.github/workflows/ci.yml` runs shared Node, Go and hook checks; browser fixtures test PWA behavior.

## Dependencies

- Node version satisfying `package.json`, npm, Python 3, Go and Chromium for browser checks.
- TypeScript, ESLint, Prettier, Playwright Core and shared config are locked in `package-lock.json`.

## Status

- Live source: shared PWA library and npm/Go distribution. No replacement or new service is selected; publication availability is unverified.
