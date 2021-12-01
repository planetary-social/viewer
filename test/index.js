require('isomorphic-fetch');
var test = require('tape')
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
var Server = require('../')
const caps = require('./caps.json')
var path = require('path')
var after = require('after')

const PORT = 8888
const BASE_URL = 'http://localhost:' + PORT
const DB_PATH = process.env.DB_PATH || (__dirname + '/db')

const sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-db2/compat')) // include all compatibility plugins
    .use(require('ssb-friends'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-threads'))
    .use(require('ssb-blobs'))
    .use(require('ssb-replication-scheduler'))
    .call(null, {
        path: DB_PATH,
        friends: {
            hops: 2
        },
        // the server has an identity
        keys: ssbKeys.loadOrCreateSync(path.join(DB_PATH, 'secret'))
    })

var msgKey
var server
test('setup', t => {
    var next = after(2, () => t.end())

    Server(sbot, PORT, (err, _server) => {
        if (err) {
            t.fail(err.toString())
            return next(err)
        }
        server = _server
        next(null)
    })

    var content = { type: 'test', text: 'woooo' }
    sbot.db.publish(content, (err, res) => {
        if (err) {
            t.fail(err.toString())
            return next(err)
        }
        msgKey = res.key
        next(null)
    })
})

test('server', t => {
    fetch(BASE_URL + '/')
        .then(res => {
            res.text().then(text => {
                t.equal(text[0], '@', "should return the server's id")
                t.end()
            })
        })
        .catch(err => {
            t.fail(err)
            t.end()
        })
})

test('get a message', t => {
    fetch(BASE_URL + '/' + msgKey)
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    t.fail(text)
                    t.end()
                })
            }

            res.json().then(json => {
                t.equal(json[0].key, msgKey,
                    'should return the right message')
                t.end()
            })
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
