// Shows the install button once the browser offers a native install prompt.

/** @typedef {Event & { prompt: () => Promise<void> }} BeforeInstallPromptEvent */

const button = /** @type {HTMLButtonElement} */ (document.getElementById('install'))
/** @type {BeforeInstallPromptEvent | undefined} */
let offer
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  offer = /** @type {BeforeInstallPromptEvent} */ (e)
  button.classList.remove('hidden')
})
button.onclick = () => offer?.prompt()
