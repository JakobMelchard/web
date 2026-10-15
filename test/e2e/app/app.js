import { register } from '@jakobmelchard/web/register.js'
import { createQueue } from '@jakobmelchard/web/queue.js'

register({ version: '1' })
const queue = await createQueue({
  send: (op) => fetch('/api/save', { method: 'POST', body: JSON.stringify(op) }),
  onDrop: (op) => console.error('dropped', op),
})
Object.assign(window, { queue })
