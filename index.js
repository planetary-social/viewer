const { where,  and, type,  author, toCallback } = require('ssb-db2/operators')
var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
var S = require('pull-stream')
var toStream = require('pull-stream-to-stream')


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
            if (err) {
                console.log('errrrr', err)
                return res.send(createError.InternalServerError())
            }

            var rootId = (msg.content && msg.content.root) || id

            getThread(sbot, rootId, (err, msgs) => {
                if (err) return res.send(createError.InternalServerError())
                res.send(msgs)
            })
        })
    })

    fastify.get('/blob/:blobId', (req, res) => {
        // console.log('**got req**', req)
        var { blobId } = req.params
        var source = sbot.blobs.get(blobId)
        S(
            source,
            S.collect((err, data) => {
                console.log('done', err, data)
                res.send(Buffer.concat(data))
            })
        )
        // res.send(toStream.source(source))
    })

    fastify.get('/feed/:userName', (req, res) => {
        var { userName } = req.params

        // TODO
        // we want to find the id for the given username,
        // then get the feed for that id
        sbot.suggest.profile({ text: userName }, (err, matches) => {
            if (err) {
                console.log('OH no!', err)
                return res.send(createError.InternalServerError())
            }

            const id = matches[0].id

            sbot.db.query(
                where(
                    and(
                        type('post'),
                        author(id)
                    )
                ),
                toCallback((err, msgs) => {
                    if (err) {
                        return res.send(createError.InternalServerError())
                    }
                    // TODO -- can we reverse this in the query?
                    res.send(msgs.reverse())
                })
            )

        })
    })

    fastify.get('/default', (req, res) => {
        sbot.db.query(
            where( type('post') ),
            toCallback((err, msgs) => {
                if (err) res.send(createError.InternalServerError())
                // console.log('There are ' + msgs.length + ' posts')
                res.send(msgs.reverse())
            })
        )
    })

    return fastify
}


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
