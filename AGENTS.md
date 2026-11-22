# web

Shared PWA shell (`@jakobmelchard/web`) and Go `embed.go` module. Zero runtime dependencies; vanilla ES modules in `src/` with strict JSDoc types checked by `tsc` and `eslint`.

## Layout and build

- Edit `tokens/tokens.json` or `src/*`, never `dist/` directly.
- `npm run build` runs `python3 tokens/build_tokens.py && cp src/* dist/`; commit updated `dist/` files.
- `embed.go` embeds `dist/` (`web.FS`) and mirrors `src/manifest.js` (`web.Manifest`); `embed_test.go` checks `src/`-to-`dist/` parity and `test/vectors/manifest.json` against Go.

## Checks

- `npm run check`: runs `tsc`, `prettier --check .`, `npm run build`, and verifies `dist/` has no uncommitted drift.
- `npm test` (unit), `npm run lint` (eslint), `npm run e2e` (Playwright), and `go test ./...`.
