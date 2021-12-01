# planetary viewer

Http viewer of ssb data

## install
```
npm install -S @planetary-ssb/viewer
```

## use
This exports a function that starts a server. It should be used as a dependency of another module.

```js
const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
var viewer = require('@planetary-ssb/viewer')
const caps = require('./caps.json')

var sbot = SecretStack({ caps })
    .use(require('ssb-db2'))
    // ...
    .call(null, {
        path: __dirname + '/my-db',
        // the server has an identity
        keys: ssbKeys.loadOrCreateSync(__dirname + '/secret'))
    })
    

// (sbot, port)
var server = viewer(sbot, 8888)  // now http server is started

// sometime in the future...
server.close(err => console.log('server closed', err))
```

