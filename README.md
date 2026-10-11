# web

Shared PWA shell for the org's apps: design tokens, base CSS, manifest, service worker and install page. Published as `@jakobmelchard/web`.

```sh
npm install
npm run build    # regenerate dist/ (commit the result)
npm run check    # typecheck, rebuild, fail if dist/ changed
npm test
go test ./...
```

| Path | Contents |
|---|---|
| `tokens/tokens.json` | source of all design tokens |
| `tokens/build_tokens.py` | generates `dist/tokens.*` from it |
| `src/` | base CSS, theme follower, manifest template, service worker, register, update check, install page |
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
