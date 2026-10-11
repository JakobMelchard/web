# web

Shared PWA shell for the org's apps: design tokens, base CSS, manifest, service worker and install page. Published as `@jakobmelchard/web`.

```sh
npm install
npm run build    # regenerate dist/ (commit the result)
npm run check    # typecheck, rebuild, fail if dist/ changed
npm test
npm run e2e    # Chromium; set CHROMIUM_PATH to use an installed one
go test ./...
```

| Path | Contents |
|---|---|
| `tokens/tokens.json` | source of all design tokens |
| `tokens/build_tokens.py` | generates `dist/tokens.*` from it |
| `src/` | base CSS, theme follower, manifest template, service worker, register, update check, write queue, install page |
| `dist/` | committed build output: the npm package and the Go embed |
| `embed.go` | `web.FS` and `web.Manifest` for Go servers |
| `test/vectors/` | manifest cases run by both the JS and the Go test |

## Service worker

The app serves its own `/sw.js` with the config and imports the shared worker, then registers it with the shell version.

```js
// /sw.js
self.WEB_SW = {
  cache: 'app',
  shell: ['/', '/static/app.js', '/static/style.css'],
  network: { timeoutMs: 4000 },
  offlinePage: '/',
}
importScripts('/web/sw.js')
```

```js
import { register } from '@jakobmelchard/web/register.js'
import { watchUpdates } from '@jakobmelchard/web/update.js'

register({ version: shellVersion })
watchUpdates({ url: '/version', onUpdate: () => showReloadNotice() })
```

`shell` entries are precached and refreshed from the network; `offlinePage` must be one of them. Responses served without the network carry `X-Offline: 1`.

## Offline writes

Writes made without a network are kept and sent in order. The queue runs in the page and flushes after each push, on `online`, `visibilitychange` and `pageshow`, and at start.

```js
import { createQueue } from '@jakobmelchard/web/queue.js'

const queue = await createQueue({
  send: (op) => fetch('/api/save', { method: 'POST', body: JSON.stringify(op) }),
  onDrop: (op, res) => reportRefused(op, res.status),
})
await queue.push({ id: 1 })
```

`send` throws when the network is down; that and an `X-Offline: 1` response keep the op queued. Any other failed response drops the op and calls `onDrop`. Storage is IndexedDB, then localStorage; pass `store: { get, set }` to use something else, such as Capacitor Preferences.
