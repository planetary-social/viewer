const { where,  and, type, contact, author,
    toCallback, descending, toPullStream,
    batch } = require('ssb-db2/operators')
var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
var S = require('pull-stream')
var toStream = require('pull-stream-to-stream')

module.exports = function startServer (sbot) {
    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id + ' | ' + process.env.NODE_ENV)
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
                return res.send(createError.InternalServerError(err))
            }

            var rootId = (msg.content && msg.content.root) || id

            getThread(sbot, rootId, (err, msgs) => {
                if (err) return res.send(createError.InternalServerError(err))
                res.send(msgs)
            })
        })
    })

    fastify.get('/blob/:blobId', (req, res) => {
        var { blobId } = req.params
        var source = sbot.blobs.get(blobId)
        res.send(toStream.source(source))
    })

    fastify.get('/feed/:userName', (req, res) => {
        var { userName } = req.params

        sbot.suggest.profile({ text: userName }, (err, matches) => {
            if (err) {
                console.log('OH no!', err)
                return res.send(createError.InternalServerError(err))
            }

            // @TODO -- return a list of id's if there is more than one
            // match
            const id = matches[0] && matches[0].id

            if (!id) {
                return res.code(404).send('not found')
            }

            const source = sbot.db.query(
                where(
                    and(
                        type('post'),
                        author(id)
                    )
                ),
                batch(20),
                descending(),
                toPullStream()
            )

            S(
                source,

                S.map((msg) => {
                    return sbot.threads.thread({
                        root: msg.key,
                        allowlist: ['post'],
                        // threads sorted from most recent to least recent
                        reverse: true, 
                        // at most 3 messages in each thread
                        threadMaxSize: 3, 
                    })
                }),

                S.flatten(),

                S.map(res => {
                    // return either [post, post, ...] or post (not in array)
                    return res.messages.length > 1 ?
                        res.messages :
                        res.messages[0]
                }),

                S.collect((err, msgs) => {
                    if (err) {
                        return res.send(createError.InternalServerError(err))
                    }
                    // TODO -- can we reverse this in the query?
                    // need to do this if we send the stream to res
                    res.send(msgs)
                })
            )

        })
    })

    fastify.get('/tag/:tagName', (req, res) => {
        var { tagName } = req.params
        S(
            // now get the messages that match that tag
            sbot.threads.hashtagSummary({
                hashtag: '#' + tagName
            }),
            S.collect((err, msgs) => {
                console.log('in here', err, msgs.length)
                if (err) return res.send(createError.InternalServerError(err))
                res.send(msgs)
            })
        )
    })

    fastify.get('/default', (_, res) => {
        sbot.db.query(
            where( type('post') ),
            toCallback((err, msgs) => {
                if (err) res.send(createError.InternalServerError())
                res.send(msgs.reverse())
            })
        )
    })

    fastify.get('/profile/:username', (req, res) => {
        var { username } = req.params

        sbot.suggest.profile({ text: username }, (err, matches) => {
            if (err) {
                return res.send(createError.InternalServerError(err))
            }

            // TODO -- fix duplicate username usecase
            const id = matches[0] && matches[0].id
            if (!id) return res.send(createError.NotFound())

            sbot.db.onDrain('aboutSelf', () => {
                const profile = sbot.db.getIndex('aboutSelf').getProfile(id)
                res.send(profile)
            })
        })
    })

    fastify.get('/counts/:username', (req, res) => {
        var { username } = req.params

        sbot.suggest.profile({ text: username }, (err, matches) => {
            if (err) {
                return res.send(createError.InternalServerError(err))
            }

            // TODO -- fix this part
            // should return a list of user IDs or something if
            // there is more than 1 match
            const id = matches[0] && matches[0].id
            if (!id) return res.send(createError.NotFound())

            Promise.all([
                new Promise((resolve, reject) => {
                    // then query for thier posts so we can count them
                    sbot.db.query(
                        where(
                            and(
                                type('post'),
                                author(id)
                            ),
                        ),
                        toCallback((err, res) => {
                            if (err) return reject(err)
                            resolve(res.length)
                        })
                    )
                }),

                // get the following count
                new Promise((resolve, reject) => {
                    sbot.friends.hops({
                        start: id,
                        max: 1
                    }, (err, following) => {
                        if (err) return reject(err)
                        folArr = Object.keys(following).filter(id => {
                            return following[id] === 1
                        })
                        resolve(folArr.length)
                    })
                }),

                // get the follower count
                new Promise((resolve, reject) => {
                    sbot.db.query(
                        where(
                            contact(id)
                        ),
                        toCallback((err, msgs) => {
                            if (err) return reject(err)
            
                            var followers = msgs.reduce(function (acc, msg) {
                                var author = msg.value.author
                                // duplicate, do nothing
                                if (acc.indexOf(author) > -1) return acc  
                                // if they are following us,
                                // add them to the list
                                if (msg.value.content.following) {  
                                    acc.push(author)
                                }
                                return acc
                            }, [])
            
                            resolve(followers.length)
                        })
                    )
                })
            ])
                .then(([posts, following, followers]) => {
                    res.send({ username, id, posts, following, followers })
                })
                .catch(err => {
                    res.send(createError.InternalServerError(err))
                })
        })

    })

    return fastify
}


function getThread(sbot, rootId, cb) {
    S(
        sbot.threads.thread({
            root: rootId,
            // @TODO
            allowlist: ['test', 'post'],
            reverse: true, // threads sorted from most recent to least recent
            threadMaxSize: 3, // at most 3 messages in each thread
        }),
        S.collect((err, [thread]) => {
            if (err) return cb(err)
            cb(null, thread)
        })
    )
}
