var createError = require('http-errors')
const fastify = require('fastify')({
  logger: true
})
const {and, where, type, key, toCallback} = require('ssb-db2/operators')
// var http = require('http')

module.exports = function startServer (sbot, port) {

//     var server = http.createServer(function onRequest (req, res) {

//         if (req.url.startsWith('/%')) {
//             var id = req.url.split('/')
//             id.unshift() // rm the first item from list
//             id = id.join('')

//             return sbot.db.query(
//                 where(
//                     and(
//                         type("test"), 
//                         key(id)
//                     )
//                 ),
//                 toCallback((err, msg) => {
//                     if (err) {
//                         res.writeHead(500, { 'Content-Type': 'text/plain' })
//                         return res.end('Server error')
//                     }
//                     console.log('err, res', err, msg)
//                     res.writeHead(200, { 'Content-Type': 'application/JSON' })
//                     return res.end(JSON.stringify(msg))
//                 })
//             )
//         }

//         if (req.url === '/healthz') {
//             res.writeHead(200, { 'Content-Type': 'text/plain' });
//             return res.end('Hello World!');
//         }

//         // return the server id on any request
//         res.writeHead(200, { 'Content-Type': 'text/plain' })
//         return res.end(sbot.config.keys.id)

//     })

//     server.listen(port);

//     return server
// }







    fastify.get('/', (_, res) => {
        res.send(sbot.config.keys.id)
    })

    fastify.get('/healthz', (_, res) => {
        res.send('ok')
    })

    fastify.get('/%:id', (req, res) => {
        var { id } = req.params
        id = '%' + id
        // console.log('***id***', id)
        sbot.db.query(
            where(
                key(id)
            ),
            toCallback((err, msg) => {
                if (err) {
                    console.log('errrrrrrrrr', err)
                    return res.send(createError(500))
                }
                res.send(msg)
            })
        )
    })

    // Run the server!
    fastify.listen(port || 8888, '0.0.0.0', (err, address) => {
        if (err) throw err
        console.log(`Server is now listening on ${address}`)
    })

    return fastify
}
