// const { where, and, type, author, toCallback } = require('ssb-db2/operators')
var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
var S = require('pull-stream')

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

        console.log('*****id*****', id)

        sbot.db.get(id, (err, msg) => {
            if (err) {
                console.log('errrrr', err)
                return res.send(createError.InternalServerError())
            }

            var rootId = (msg.content && msg.content.root) || id

            getThread(sbot, rootId, (err, msgs) => {
                if (err) res.send(createError.InternalServerError())
                res.send(msgs)
            })
        })
    })

    // fastify.post('/feed', (req, res) => {
    //     var { feedId } = req.body
    //     sbot.db.query(
    //         where(
    //             and(
    //                 type('test'),
    //                 author(feedId)
    //             )
    //         ),
    //         toCallback((err, msgs) => {
    //             if (err) return res.send(createError.InternalServerError())
    //             console.log('There are ' + msgs.length +
    //                 ' messages of type "post" from ' + feedId)
    //             res.send(msgs)
    //         })
    //     )
    // })

    // fastify.get('/feed/:feedId', (req, res) => {
    //     var { feedId } = req.params
    //     feedId = decodeURIComponent(feedId)

    //     console.log('*feed id*', feedId)

    //     sbot.db.query(
    //         where(
    //             and(
    //                 type('test'),
    //                 author(feedId)
    //             )
    //         ),
    //         toCallback((err, msgs) => {
    //             if (err) return res.send(createError.InternalServerError())
    //             console.log('There are ' + msgs.length +
    //                 ' messages of type "post" from ' + feedId)
    //             res.send(msgs)
    //         })
    //     )

    // })

    return fastify
}

