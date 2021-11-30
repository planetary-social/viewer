const fastify = require('fastify')({
  logger: true
})

module.exports = function startServer (sbot, port) {
    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id)
    })

    fastify.get('/healthz', (_, res) => {
        res.send('ok')
    })

    // fastify.post('/follow-me', (req, res) => {
    //     var { body } = req
    //     console.log('body', body)
    //     reply.send('hello')
    // })

    // Run the server!
    fastify.listen(port || 8888, '0.0.0.0', (err, address) => {
        if (err) throw err
        console.log(`Server is now listening on ${address}`)
    })

    return fastify
}
