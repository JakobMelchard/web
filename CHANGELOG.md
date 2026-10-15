# Changelog

## [0.1.2](https://github.com/JakobMelchard/web/compare/v0.1.1...v0.1.2) (2026-10-14)


### Bug Fixes

* **manifest:** match Go escaping of U+2028/U+2029 and treat missing keys as empty ([#34](https://github.com/JakobMelchard/web/issues/34)) ([cc8f15b](https://github.com/JakobMelchard/web/commit/cc8f15b659196cae527bb0cc3f69416d0c66cc69))

## [0.1.1](https://github.com/JakobMelchard/web/compare/v0.1.0...v0.1.1) (2026-10-14)


### Features

* generate Kotlin Compose tokens ([#13](https://github.com/JakobMelchard/web/issues/13)) ([8177e6c](https://github.com/JakobMelchard/web/commit/8177e6c28de64d5f612f533b04d8976af8570f45))


### Bug Fixes

* **queue:** retry gateway errors and share the queue across tabs ([#31](https://github.com/JakobMelchard/web/issues/31)) ([d6eb99a](https://github.com/JakobMelchard/web/commit/d6eb99aa8fe1ff7bc142843ee98a6a880aaceab4)), closes [#30](https://github.com/JakobMelchard/web/issues/30)
* **queue:** survive a store that fails to save ([#21](https://github.com/JakobMelchard/web/issues/21)) ([7687acf](https://github.com/JakobMelchard/web/commit/7687acff0eb3fca2305e5bbd06b84a48ceb2a219))
* **sw:** time out only the wait for headers ([#22](https://github.com/JakobMelchard/web/issues/22)) ([3e1ac00](https://github.com/JakobMelchard/web/commit/3e1ac00c024366c463a2e4608db8b115f2c564f0))

## 0.1.0 (2026-10-11)


### Features

* base css, theme follower, manifest and Go embed ([#3](https://github.com/JakobMelchard/web/issues/3)) ([cc1f416](https://github.com/JakobMelchard/web/commit/cc1f4161f440d92beb78918d5c142ba0f6ee30ae))
* generate design tokens into dist ([#8](https://github.com/JakobMelchard/web/issues/8)) ([34704ce](https://github.com/JakobMelchard/web/commit/34704ced0ecbd4be7a0826099b5c491a8be4f866))
* offline write queue and an end-to-end check ([#6](https://github.com/JakobMelchard/web/issues/6)) ([6bb3af6](https://github.com/JakobMelchard/web/commit/6bb3af65c3985d9f5de8f775089f0cd3f4dba023))
* service worker, register, update check and install page ([#4](https://github.com/JakobMelchard/web/issues/4)) ([832ac0a](https://github.com/JakobMelchard/web/commit/832ac0a2129d3d7558a4f9863ee69e75f622e580))


### Miscellaneous Chores

* first release is 0.1.0 ([df5b6f8](https://github.com/JakobMelchard/web/commit/df5b6f8d1c3459156c7fc6f2581b652eea19869a))
