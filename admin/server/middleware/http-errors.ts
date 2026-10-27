import type { H3Event } from 'h3'

export default defineEventHandler((event: H3Event) => {
  const res = event.node?.res

  if (!res) {
    return
  }

  res.once('finish', () => {
    const statusCode = res.statusCode
    if (statusCode >= 500) {
      console.error(JSON.stringify({ event: 'http_error', statusCode }))
    }
  })
})
