// @ts-check

/**
 * @param {string} name who to greet
 * @returns {string} the greeting
 */
export function greeting(name) {
  return `hello, ${name}`
}

if (typeof document !== 'undefined') document.body.textContent = greeting('web')
