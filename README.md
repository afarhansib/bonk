# Bonk - Minecraft Bedrock Bot

A robust and resilient Minecraft Bedrock Edition bot built with bedrock-protocol.

## Features

- Automatic connection and reconnection handling 
- Server heartbeat monitoring 
- Event-based architecture for game interactions
- Configurable connection settings
- Built-in error handling and recovery

## Installation

```bash
git clone https://github.com/afarhansib/bonk && cd bonk && npm install && node index.js
```

## Configuration

Edit the botConfig object in index.js:

```javascript
const botConfig = {
    host: 'your-server.com', 
    port: 7004,
    username: 'Bonk',
    offline: false,
    connectTimeout: 20000,
    skipPing: true,
    profilesFolder: './profiles'
}
```

## Technical Details

- Maximum reconnection attempts: 10
- Heartbeat interval: 5 seconds
- Reconnection delay: 5 seconds (doubles when server is down)

## Events Handled

- Join
- Spawn
- Chat messages
- Disconnections
- Connection errors
- Server closures

## Dependencies

- bedrock-protocol

## Contributing

Feel free to submit issues and pull requests to improve the bot's functionality.

## Special Thanks

Huge thanks to Cody, the amazing AI assistant from Sourcegraph, for helping develop and document this project! 🚀

## License

The Unlicense (Public Domain)
