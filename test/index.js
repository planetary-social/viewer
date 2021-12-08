require('isomorphic-fetch');
var test = require('tape')
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
var Server = require('../')
const caps = require('./caps.json')
var path = require('path')
var after = require('after')
// var parallel = require('run-parallel')
// var ssc = require('@nichoth/ssc')
// const validate = require('ssb-validate');
// var S = require('pull-stream')
// const pullAsync = require('pull-async');

const PORT = 8888
const BASE_URL = 'http://localhost:' + PORT
const DB_PATH = process.env.DB_PATH || (__dirname + '/db')
const SERVER_KEYS = ssbKeys.loadOrCreateSync(path.join(DB_PATH, 'secret'))

console.log('keys', SERVER_KEYS)
console.log('db path', DB_PATH)

const sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-db2/about-self'))
    .use(require('ssb-db2/compat')) // include all compatibility plugins
    .use(require('ssb-friends'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-threads'))
    .use(require('ssb-blobs'))
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
            console.log('ccccccc', err)
            t.fail(err)
        }
        console.log(`Server is now listening on ${address}`)
        next(null)
    })

    // del the existing msgs, then publish a new msg
    sbot.db.deleteFeed(sbot.config.keys.id, (err, _) => {
        if (err) {
            console.log('aaaaaa', err)
            return next(err)
        }
        
        var content = { type: 'test', text: 'woooo 1' }
        sbot.db.publish(content, (err, res) => {
            if (err) {
                console.log('bbbbbb', err)
                t.fail(err.toString())
                return next(err)
            }
            msgKey = res.key
            console.log('**msg key**', msgKey)
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
    console.log('encoded key****', encodeURIComponent(msgKey))

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
            // console.log('thread res', JSON.stringify(messages, null, 2))
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

test('get a feed', t => {
    fetch(BASE_URL + '/feed/' + encodeURIComponent(sbot.config.keys.id))
        .then(res => {
            if (!res.ok) {
                t.fail()
                return res.text()
            }
            return res.json()
        })
        .then(res => {
            t.equal(res[0].value.author, sbot.config.keys.id,
                'should return the right feed')
            t.end()
        })
        .catch(err => {
            t.fail(err)
            t.end()
        })
})

test('all done', t => {
    server.close(err => {
        if (err) t.fail(err)

        sbot.close((err) => {
            if (err) t.fail(err)
            t.end()
        })
    })
})
