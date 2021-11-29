const fastify = require('fastify')({
  logger: true
})

module.exports = function startServer () {
    // Declare a route
    fastify.get('/', (request, reply) => {
        reply.send({ hello: 'world' })
    })

    // Run the server!
    fastify.listen(8888, '0.0.0.0', (err, address) => {
        if (err) throw err
        // Server is now listening on ${address}
    })

    return fastify
}

