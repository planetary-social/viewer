const fastify = require('fastify')({
  logger: true
})

module.exports = function startServer (sbot, port) {
    // Declare a route
    fastify.get('/', (request, reply) => {
        reply.send({ hello: 'world' })
    })

    // Run the server!
    fastify.listen(port || 8888, '0.0.0.0', (err, address) => {
        if (err) throw err
        // Server is now listening on ${address}
    })

    return fastify
}

