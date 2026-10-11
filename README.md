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
| `src/` | base CSS, theme follower, manifest template and renderer |
| `dist/` | committed build output: the npm package and the Go embed |
| `embed.go` | `web.FS` and `web.Manifest` for Go servers |
| `test/vectors/` | manifest cases run by both the JS and the Go test |
