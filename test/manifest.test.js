// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { manifest } from '../src/manifest.js'

/** @type {{ opts: Parameters<typeof manifest>[0], want: string }[]} */
const vectors = JSON.parse(readFileSync(new URL('./vectors/manifest.json', import.meta.url), 'utf8'))

test('manifest renders the vectors byte for byte', () => {
  for (const { opts, want } of vectors) assert.equal(manifest(opts), want)
})

test('manifest has the keys an installable app needs', () => {
  const { opts } = vectors[0]
  const m = JSON.parse(manifest(opts))
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons'])
    assert.ok(m[k], k)
  assert.equal(m.name, opts.name)
})
