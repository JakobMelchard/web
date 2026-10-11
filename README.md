# web

Shared PWA shell: tokens, base CSS, manifest, service worker, install page

Scaffolded from [JakobMelchard/template](https://github.com/JakobMelchard/template) (`js`).
Templated files (CI caller, `.pre-commit-config.yaml`, devcontainer, org configs) come back through
`copier update`; Renovate opens those updates as PRs.

```sh
brew install prek && prek install    # hooks pinned in .pre-commit-config.yaml
npm install
npm run typecheck
npm test
```
