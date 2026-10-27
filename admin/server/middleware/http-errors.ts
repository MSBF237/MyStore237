export default defineEventHandler((event) => {
  event.node.res.once('finish', () => {
    const statusCode = event.node.res.statusCode
    if (statusCode >= 500) {
      console.error(JSON.stringify({ event: 'http_error', statusCode }))
    }
  })
})
