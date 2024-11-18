const bedrock = require('bedrock-protocol')
const server = bedrock.createServer({
  host: '0.0.0.0',   // the host to bind to, use '0.0.0.0' to bind all hosts
  port: 19132,       // optional, port to bind to, default 19132
  offline: true,    // default false. verify connections with XBL
  motd: {
    motd: 'Funtime Server', // Top level message shown in server list
    levelName: 'Wonderland' // Sub-level header
  }
})

// The 'connect' event is emitted after a new client has started a connection with the server and is handshaking.
// Its one paramater is the ServerPlayer class instance which handles this players' session from here on out.
server.on('connect', (client) => {
    // 'join' is emitted after the client has authenticated & connection is now encrypted.
    client.on('join', () => {
      // Then we can continue with the server spawning sequence. See examples/serverTest.js for an example  spawn sequence.
      // ...
      // Here's an example of sending a "text" packet, https://prismarinejs.github.io/minecraft-data/?v=bedrock_1.19.60&d=protocol#packet_text
      client.queue('text', { type: 'system', message: client.profile.name + ' just joined the server!' })
    })
  })