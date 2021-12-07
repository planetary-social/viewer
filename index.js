var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
// const {and, where, type, key, toCallback} = require('ssb-db2/operators')
var S = require('pull-stream')
// var toStream = require('pull-stream-to-stream')

function getThread(sbot, rootId, cb) {
    S(
        sbot.threads.thread({
            root: rootId,
            // @TODO
            allowlist: ['test'],
            reverse: true, // threads sorted from most recent to least recent
            threadMaxSize: 3, // at most 3 messages in each thread
        }),
        S.collect((err, [thread]) => {
            if (err) return cb(err)
            cb(null, thread)
        })
    )
}

module.exports = function startServer (sbot) {
    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id)
    })

    fastify.get('/%:id', (req, res) => {
        var { id } = req.params
        id = '%' + id
        id = decodeURIComponent(id)

        // get the message in question
        // so we can look for the `root` property and
        // see if there is a thread for this

        sbot.db.get(id, (err, msg) => {
            if (err) return res.send(createError.InternalServerError())

            var rootId = msg.content.root || id

            getThread(sbot, rootId, (err, msgs) => {
                if (err) res.send(createError.InternalServerError())
                res.send(msgs)
            })
        })

        // S(
        //     sbot.threads.thread({
        //         root: rootId,
        //         allowlist: ['test'],
        //         reverse: true, // threads sorted from most recent to least recent
        //         threadMaxSize: 3, // at most 3 messages in each thread
        //     }),
        //     S.collect((err, [thread]) => {
        //         if (err) return console.log('rrrrrrr', err)
        //         res.send(thread)
        //     })
        // )
    })

    return fastify
}
