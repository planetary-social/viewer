var fetch = require('node-fetch');
var test = require('tape')
const crypto = require('crypto')
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
var Server = require('../')
const caps = require('./caps.json')
var path = require('path')
var after = require('after')
const user = require('./user.json')
var { read } = require('pull-files')
var S = require('pull-stream')

const PORT = 8888
const BASE_URL = 'http://localhost:' + PORT
const DB_PATH = process.env.DB_PATH || (__dirname + '/db')
const SERVER_KEYS = ssbKeys.loadOrCreateSync(path.join(DB_PATH, 'secret'))


const sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-db2/compat')) // include all compatibility plugins
    .use(require('ssb-db2/about-self'))
    .use(require('ssb-friends'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-threads'))
    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))
    .use(require('ssb-suggest-lite'))
    .use(require('ssb-replication-scheduler'))
    .call(null, {
        path: DB_PATH,
        friends: {
            hops: 2
        },
        // the server has an identity
        keys: SERVER_KEYS
    })

var msgKey
var server
test('setup', t => {
    var next = after(2, () => t.end())

    server = Server(sbot)

    // Run the server!
    server.listen(8888, '0.0.0.0', (err, address) => {
        if (err) {
            t.fail(err)
        }
        console.log(`Server is now listening on ${address}`)
        next(null)
    })

    // del the existing msgs, then publish a new msg
    sbot.db.deleteFeed(sbot.config.keys.id, (err, _) => {
        if (err) {
            return next(err)
        }
        
        // now publish a msg
        var content = { type: 'test', text: 'woooo 1' }
        sbot.db.publish(content, (err, msg) => {
            if (err) {
                t.fail(err.toString())
                return next(err)
            }
            msgKey = msg.key
            next(null)
        })
    })

})

test('server', t => {
    fetch(BASE_URL + '/')
        .then(res => {
            res.text().then(text => {
                t.equal(text, sbot.config.keys.id,
                    "should return the server's id")
                t.end()
            })
        })
        .catch(err => {
            t.fail(err)
            t.end()
        })
})

test('get a message', t => {
    fetch(BASE_URL + '/' + encodeURIComponent(msgKey))
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    console.log('**failure text**', text)
                    t.fail(text)
                    t.end()
                })
            }
            return res.json()
        })
        .then(({ messages }) => {
            t.equal(messages.length, 1, 'should return a single message')
            t.equal(messages[0].key, msgKey,
                'should return the right message')
            t.end()
        })
        .catch(err => {
            t.fail(err)
            t.end()
        })
})

var childKey
test('get a thread', t => {
    // var newKey
    var content = { type: 'test', text: 'woooo 2', root: msgKey }

    sbot.db.publish(content, (err, res) => {
        if (err) {
            t.fail(err.toString())
            return t.end()
        }

        childKey = res.key

        // we are requesting the 'root' message here
        // how to get a thread when you are given a child message?
        fetch(BASE_URL + '/' + encodeURIComponent(msgKey))
            .then(_res => _res.json())
            .then(({ messages, full }) => {
                t.equal(full, true, 'should have the full thread')
                t.equal(messages.length, 2,
                    'should return all the messages in the thread')
                t.equal(messages[0].key, msgKey,
                    'should return messages in the right order')
                t.end()
            })
            .catch(err => {
                t.fail(err)
                t.end()
            })
    })
})

test('get a thread given a child message', t => {
    fetch(BASE_URL + '/' + encodeURIComponent(childKey))
        .then(res => res.json())
        .then(({ messages }) => {
            t.equal(messages[0].key, msgKey,
                'should send back the thread starting with the root')
            t.end()
        })
        .catch(err => {
            console.log('oh no', err)
            t.fail(err)
            t.end()
        })
})

// test('get a non-existant feed', t => {
//     fetch(BASE_URL + '/feed/' + 'foo')
//         .then(res => {
//             if (res.ok) t.fail('should return 404')
//             t.equal(res.status, 404, 'should return 404')
//             t.end()
//         })
//         .catch(err => {
//             t.fail('should get a 404 response', err)
//             t.end()
//         })
// })

test('get a feed', t => {
    // following them is necessary for the `ssb-suggest-lite` plugin
    sbot.friends.follow(user.id, null, function (err, fol) {
        if (err) return console.log('errrrr', err)

        sbot.db.publishAs(user, {
            type: 'about',
            about: user.id,
            name: 'alice'
        }, (err) => {
            if (err) return t.fail(err)

            // now post a message by them
            sbot.db.publishAs(user, {
                type: 'post',
                text: 'wooo'
            }, (err, msg) => {
                if (err) {
                    console.log('errrr', err)
                    return t.end(err)
                }

                // finally get their feed
                fetch(BASE_URL + '/feed/' + 'alice')
                    .then(res => res.ok ? res.json() : res.text())
                    .then(res => {
                        t.equal(msg.key, res[0].key,
                            'should return the users feed')
                        t.equal(res[0].value.content.text, 'wooo',
                            'should have the message content in feed')
                        t.end()
                    })
                    .catch(err => {
                        t.fail(err)
                        t.end()
                    })
            })

        })

    })

})

test('get default view', t => {
    var content = { type: 'post', text: 'woooo' }
    var key
    sbot.db.publish(content, (err, msg) => {
        key = msg.key
        console.log('msg.key', msg.key)
        if (err) {
            t.fail(err.toString())
            return t.end()
        }

        fetch(BASE_URL + '/default')
            .then(res => res.ok ? res.json() : res.text())
            .then(res => {
                t.equal(res[0].key, key,
                    'should return all messages that we know about')
                t.end()
            })
            .catch(err => {
                t.fail(err)
                t.end()
            })
    })
})

test('get a blob', t => {
    S(
        read(__dirname + '/caracal.jpg'),
        S.map(file => file.data),
        sbot.blobs.add((err, blobId) => {
            // console.log('**in here**', err, blobId)

            if (err) {
                t.fail(err)
                return t.end()
            }

            fetch(BASE_URL + '/blob/' + encodeURIComponent(blobId))
                .then(res => res.ok ? res.buffer() : res.text())
                .then(buf => {
                    t.equal(blobId, hash(buf), 'should serve the blob')
                    t.end()
                })
                .catch(err => {
                    console.log('errrr', err)
                    t.fail(err)
                    t.end()
                })
        })
    )
})

function hash (buf) {
    buf = typeof buf === 'string' ? Buffer.from(buf) : buf
    return '&' + crypto.createHash('sha256')
        .update(buf)
        .digest('base64') + '.sha256'
}

test('all done', t => {
    server.close(err => {
        if (err) {
            t.fail(err)
            return console.log('errrr', err)
        }

        sbot.close((err) => {
            if (err) {
                t.fail(err)
                console.log('aaaaa', err)
            }
            t.end()
        })
    })
})
