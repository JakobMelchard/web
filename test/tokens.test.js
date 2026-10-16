// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outs = ['tokens.css', 'tokens-dark.css', 'tokens.swift', 'tokens.kt', 'tokens.json']
const read = (/** @type {string} */ f) =>
  readFileSync(new URL(`../dist/${f}`, import.meta.url), 'utf8')

test('generator reproduces the committed token files', () => {
  const before = outs.map(read)
  execFileSync('python3', [fileURLToPath(new URL('../tokens/build_tokens.py', import.meta.url))])
  assert.deepEqual(outs.map(read), before)
})

test('tokens-dark.css has no light block', () => {
  assert.doesNotMatch(read('tokens-dark.css'), /data-theme='light'/)
})

test('package ships the generated files', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' })
  const paths = JSON.parse(out)[0].files.map((/** @type {{ path: string }} */ f) => f.path)
  for (const f of outs) assert.ok(paths.includes(`dist/${f}`), f)
})
