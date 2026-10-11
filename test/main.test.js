// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { greeting } from '../src/main.js'

test('greeting names the target', () => {
  assert.equal(greeting('x'), 'hello, x')
})
