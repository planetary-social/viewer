var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
const {and, where, type, key, toCallback} = require('ssb-db2/operators')

module.exports = function startServer (sbot, port) {
    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id)
    })

    fastify.get('/healthz', (_, res) => {
        res.send('ok')
    })

    fastify.get('/%:id', (req, res) => {
        var { id } = req.params
        id = '%' + id
        // console.log('***id***', id)
        sbot.db.query(
            where(
                key(id)
            ),
            toCallback((err, msg) => {
                if (err) {
                    console.log('errrrrrrrrr', err)
                    return res.send(createError(500))
                }
                res.send(msg)
            })
        )
    })

    // Run the server!
    fastify.listen(port || 8888, '0.0.0.0', (err, address) => {
        if (err) throw err
        console.log(`Server is now listening on ${address}`)
    })

    return fastify
}
