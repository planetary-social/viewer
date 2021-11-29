# planetary viewer

Http viewer of ssb data

This exports a function that starts a server. It should be used as a dependency of another module.

```js
var sbot = SecretStack({ caps })
    .use(require('ssb-db2')
    // ...

var viewer = require('@planetary-ssb/viewer')

// (sbot, port)
var server = viewer(sbot, 8888)  // now http server is started
```

