// @ts-check

/**
 * Register /sw.js for the whole origin. The version goes into the script URL, so a new value is
 * a new worker with fresh caches. Does nothing outside a secure context.
 * @param {{ version: string }} o the shell version the server rendered into the page
 * @returns {Promise<ServiceWorkerRegistration> | undefined} the registration
 */
export const register = ({ version }) =>
  navigator.serviceWorker?.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: '/' })
