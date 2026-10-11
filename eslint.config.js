import globals from 'globals'
import base from '@jakobmelchard/config/eslint'

export default [
  ...base,
  // src/ runs in the browser; test/ on Node.
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
]
