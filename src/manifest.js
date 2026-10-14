// @ts-check
import { readFileSync } from 'node:fs'

const template = readFileSync(new URL('./manifest.json', import.meta.url), 'utf8')

/** @typedef {'name' | 'short_name' | 'description' | 'start_url' | 'scope'} Key */

/**
 * Fill manifest.json. Icons are resolved against the manifest URL, so serve icon-192.png,
 * icon-512.png and icon-maskable.png next to it. A missing key becomes "".
 * @param {Record<Key, string>} o values for every slot in the template
 * @returns {string} the manifest JSON
 */
export const manifest = (o) =>
  template.replace(/"\{(\w+)\}"/g, (_, /** @type {Key} */ k) =>
    // Go's encoding/json escapes U+2028 and U+2029; match it byte for byte.
    JSON.stringify(o[k] ?? '').replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`))
