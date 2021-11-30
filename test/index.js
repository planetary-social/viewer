require('isomorphic-fetch');
var test = require('tape')
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
const caps = require('./caps')
var Server = require('../')
var path = require('path')

const PORT = 8888
const BASE_URL = 'http://localhost:' + PORT
const DB_PATH = process.env.DB_PATH || __dirname + '/db'

const sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-db2/compat')) // include all compatibility plugins
    .use(require('ssb-blobs'))
    .use(require('ssb-friends'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-replication-scheduler'))
    .call(null, {
        path: DB_PATH,
        friends: {
            hops: 2
        },
        // the server has an identity
        keys: ssbKeys.loadOrCreateSync(path.join(DB_PATH, 'secret'))
    })


var server
test('server', t => {
    server = Server(sbot, PORT)
    fetch(BASE_URL + '/')
        .then(res => {
            res.text().then(text => {
                t.equal(text[0], '@', 'should return the servers id')
                t.end()
            })
        })
        .catch(err => {
            t.fail(err)
            t.end()
        })
})

test('all done', t => {
    server.close()
        .then(() => {
            sbot.close((err) => {
                if (err) t.fail(err)
                t.end()
            })
        })
})
