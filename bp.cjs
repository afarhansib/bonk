const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  // host: 'laughtale.my.id',
  // port: 7004,
  host: 'localhost',
  port: 19132,
  username: 'Bonk',
  offline: false,
  connectTimeout: 20000,
  skipPing: true,
  profilesFolder: './profiles',
})

let runtimeEntityId;

client.on('start_game', (packet) => {
  runtimeEntityId = packet.runtime_entity_id
  console.log(`Runtime Entity ID saved: ${runtimeEntityId}`);
});


client.on('start_game', (packet) => {
  client.queue('serverbound_loading_screen', {
    "type": 1
  })
  client.queue('serverbound_loading_screen', {
    "type": 2
  })
  client.queue('interact', {
    "action_id": "mouse_over_entity",
    "target_entity_id": 0n,
    "position": {
      "x": 0,
      "y": 0,
      "z": 0
    }
  })
  client.queue('set_local_player_as_initialized', {
    "runtime_entity_id": `${runtimeEntityId}`
  })
})

client.on('text', (packet) => { // Listen for chat messages from the server and echo them back.
  if (packet.source_name != client.username) {
    client.queue('text', {
      type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '', filtered_message: '',
      message: `${packet.source_name} said: ${packet.message} on ${new Date().toLocaleString()}`
    })
  }
})