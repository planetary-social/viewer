const { where,  and, type, contact, author,
    toCallback, descending, toPullStream,
    paginate, /*batch*/ } = require('ssb-db2/operators')
var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
var S = require('pull-stream')
var toStream = require('pull-stream-to-stream')
var waterfall = require('run-waterfall')
const { cpuUsage } = require('process')

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
        // TODO -- check if we have this blob, and if not, request it
        // from the pub we're connected with
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

            console.log('**matches**', matches.length)

            // @TODO -- return a list of id's if there is more than one
            // match
            const id = matches[0] && matches[0].id

            if (!id) {
                return res.code(404).send('not found')
            }

            var source = sbot.db.query(
                where(
                    and(
                        type('post'),
                        author(id)
                    )
                ),
                descending(),
                paginate(10),
                toPullStream()
            )

            S(
                source,
                S.take(1),
                // in here, get the blobs that are regerenced by messages
                S.drain(msgs => {
                    console.log('***got msgs***', msgs.length)
                    // console.log('**msgs**', msgs)

                    res.send(msgs)

                    // now get the threads
                    // S(
                    //     S.values(msgs),

                    //     S.map((msg) => {
                    //         return sbot.threads.thread({
                    //             root: msg.key,
                    //             allowlist: ['post'],
                    //             // threads sorted from most recent to
                    //             // least recent
                    //             reverse: true, 
                    //             // at most 3 messages in each thread
                    //             threadMaxSize: 3, 
                    //         })
                    //     }),

                    //     S.flatten(),

                    //     S.map(res => {
                    //         // return either [post, post, ...]
                    //         // or post (not in array)
                    //         return res.messages.length > 1 ?
                    //             res.messages :
                    //             res.messages[0]
                    //     }),

                    //     S.collect((err, msgs) => {
                    //         if (err) {
                    //             return res.send(
                    //                 createError.InternalServerError(err))
                    //         }

                    //         res.send(msgs)
                    //     })
                    // )
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

                // get the blob for avatar image
                sbot.blobs.has(profile.image, (err, has) => {
                    if (err) {
                        console.log('errrrr', err)
                        return res.send(createError.InternalServerError(err))
                    }

                    console.log('**has image**', has)

                    if (has) return res.send(profile)

                    // we don't have the blob yet,
                    // so request it from a peer, then return a response

                    // need to iterate through the peers, requesting the blob
                    // but stop iterating when you get it
                    // var currentPeers = sbot.conn.dbPeers()	

                    // this is something added only in the planetary pub
                    // TODO -- should iterate through peers
                    // this is something IPFS would help with b/c
                    // I think they handle routing requests
                    var currentPeers = sbot.peers
                    // var currentPeers = sbot.conn.dbPeers()	

                    console.log('******current peers***********', !!currentPeers[0])

                    // maybe we need someone following us for this to work?
                    sbot.blobs.want(profile.image, (err, blobId) => {
                        console.log('**wanted**', err, blobId)
                    })

                    // just as a test
                    currentPeers[0].blobs.has(profile.image, (err, has) => {
                        if (err) {
                            res.send(createError.InternalServerError(err))
                        }
                        if (has) return res.send(profile)

                        S(
                            currentPeers[0].blobs.get(profile.image),
                            sbot.blobs.add(profile.image, (err, blobId) => {
                                if (err) {
                                    res.send(createError.InternalServerError(err))
                                    return console.log('blob errrr', err)
                                }
                                console.log('***got blob***', blobId)
                                // TODO -- could return this before the 
                                // blob has finished transferring
                                res.send(profile)
                            })
                        )
                    })

                    // find someone who has the file
                    // waterfall([
                    //     cb => cb(null, false)
                    // ].concat(currentPeers.map(peer => {
                    //     return (res, cb) => {
                    //         if (res) return cb(null, res)
                    //         peer.blobs.has(profile.image, (err, has) => {
                    //             if (err) return cb(err)
                    //             if (has) return cb(null, peer)
                    //             return cb(null, false)
                    //         })
                    //     }
                    // })), (err, peer) => {
                    //     if (err) {
                    //         return res.send(
                    //             createError.InternalServerError(err))
                    //     }

                    //     S(
                    //         peer.blobs.get(profile.image),
                    //         sbot.blobs.add(profile.image, (err, blobId) => {
                    //             if (err) {
                    //                 res.send(createError.InternalServerError(err))
                    //                 return console.log('blob errrr', err)
                    //             }
                    //             console.log('***got blob***', blobId)
                    //             // TODO -- could return this before the 
                    //             // blob has finished transferring
                    //             res.send(profile)
                    //         })
                    //     )
                    // })



                    // Promise.any(currentPeers.map(peer => {
                    //     return new Promise((resolve, reject) => {
                    //         return peer.blobs.has(profile.image, (err, has) => {
                    //             if (err) return reject(err)
                    //             if (has) return resolve(peer)
                    //         })
                    //     })
                    // }))
                    //     .then(peer => {
                    //         console.log('**got peer***', peer)
                    //         // then request the file from them
                    //         S(
                    //             peer.blobs.get(profile.image),
                    //             sbot.blobs.add(profile.image, (err, blobId) => {
                    //                 if (err) return console.log('blob errrr', err)
                    //                 console.log('***got blob***', blobId)
                    //                 // TODO -- could return this before the 
                    //                 // blob has finished transferring
                    //                 res.send(profile)
                    //             })
                    //         )
                    //     })
                })
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
