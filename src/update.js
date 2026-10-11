// @ts-check

/**
 * An installed app resumes the old page instead of reloading. Ask url for `{ version }` whenever
 * the page becomes visible; the first answer is the running version, a different one later
 * means a deploy happened.
 * @param {{ url: string, onUpdate: (version: string) => void }} o where to ask, and what to do when the version changed
 */
export const watchUpdates = ({ url, onUpdate }) => {
  /** @type {string | undefined} */
  let running
  const check = async () => {
    try {
      const { version } = await (await fetch(url, { cache: 'no-store' })).json()
      if (running === undefined) running = version
      else if (version && version !== running) onUpdate(version)
    } catch {
      // offline, or a host without the endpoint
    }
  }
  check()
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'visible' && check(),
  )
}
