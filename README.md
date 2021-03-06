# planetary viewer

## deprecation

This is deprecated, and is now included in the [pub](https://github.com/planetary-social/planetary-pub) repo.

----------------------------------------------------

A server-side component

This serves data via http from a given sbot

This is used by the [planetary pub](https://github.com/planetary-social/planetary-pub)


## install
```
npm install -S @planetary-ssb/viewer
```

## use
This exports a function that creates server. It should be used as a dependency of another module. The returned server is an instance of [fastify](https://www.fastify.io/).

```js
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
var Viewer = require('@planetary-ssb/viewer')
const caps = require('./caps.json')

var sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    // ...
    .call(null, {
        path: __dirname + '/my-db',
        // the server has an identity
        keys: ssbKeys.loadOrCreateSync(__dirname + '/secret'))
    })
    
// (sbot)
// `sbot` is required
var viewer = Viewer(sbot)

// viewer is an instance of `fastify`
// (port, ip, cb)
viewer.listen(8888, '0.0.0.0', (err, address) => {
    if (err) t.fail(err)
    console.log(`Server is now listening on ${address}`)
    next(null)

    // sometime in the future...
    viewer.close(err => console.log('server closed', err))
})
```
