var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
const {and, where, type, key, toCallback} = require('ssb-db2/operators')
var S = require('pull-stream')
var toStream = require('pull-stream-to-stream')


module.exports = function startServer (sbot, port, cb) {
    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id)
    })

    fastify.get('/healthz', (_, res) => {
        res.send('ok')
    })

    fastify.get('/%:id', (req, res) => {
        var { id } = req.params
        id = '%' + id
        id = decodeURIComponent(id)

        S(
            sbot.threads.thread({
                root: id,
                allowlist: ['test'],
                reverse: true, // threads sorted from most recent to least recent
                threadMaxSize: 3, // at most 3 messages in each thread
            }),
            S.collect(thread => {
                // if thread is null, get the message and return it
                if (thread === null) {
                    return sbot.db.query(
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
                }

                res.send(thread)
            })
        )

    })

    // Run the server!
    fastify.listen(port || 8888, '0.0.0.0', (err, address) => {
        if (err) return cb(err)
        console.log(`Server is now listening on ${address}`)
        cb(null, fastify)
    })
}
