# web

Shared PWA shell for the org's apps: design tokens, base CSS, manifest, service worker and install page. Published as `@jakobmelchard/web`.

```sh
npm install
npm run build    # regenerate dist/ (commit the result)
npm run check    # typecheck, rebuild, fail if dist/ changed
npm test
```

| Path | Contents |
|---|---|
| `tokens/tokens.json` | source of all design tokens |
| `tokens/build_tokens.py` | generates `dist/tokens.*` from it |
| `dist/` | committed build output, the package contents |
