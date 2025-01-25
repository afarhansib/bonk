const bedrock = require('bedrock-protocol')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

const TIME_ZONE_OFFSET = 7;

// Helper function to format timestamp as HH:MM:SS with offset
function getFormattedTimestamp() {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const localHours = (utcHours + TIME_ZONE_OFFSET + 24) % 24; // Adjust for offset and wrap around if needed
    const hours = String(localHours).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Load the .lang file
const langFilePath = path.join(__dirname, 'minecraft-bedrock-us.lang'); // Replace with the correct path
const langFileContent = fs.readFileSync(langFilePath, 'utf8');

// Parse the .lang file into a key-value object
const langStrings = {};
langFileContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        langStrings[key.trim()] = value.trim();
    }
});

console.log('Loaded .lang file with', Object.keys(langStrings).length, 'entries.');

// ANSI color codes
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
};

function log(type, message) {
    const timestamp = getFormattedTimestamp();
    let coloredType;

    switch (type) {
        case 'CHAT':
            coloredType = `${colors.green}[${type}]${colors.reset}`;
            break;
        case 'EVENT':
            coloredType = `${colors.blue}[${type}]${colors.reset}`;
            break;
        case 'ERROR':
            coloredType = `${colors.red}[${type}]${colors.reset}`;
            break;
        default:
            coloredType = `[${type}]${colors.reset}`;
            break;
    }

    // Highlight join and left messages
    if (message.includes('joined the game')) {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${colors.white}[${colors.cyan}+${colors.white}]${colors.reset} ${colors.cyan}${message}${colors.reset}`);
    } else if (message.includes('left the game')) {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${colors.white}[${colors.magenta}-${colors.white}]${colors.reset} ${colors.magenta}${message}${colors.reset}`);
    } else {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${message}`);
    }
}

const botConfig = {
    // host: 'laughtale.my.id',
    // port: 7040,
    // host: 'localhost',
    // port: 3000,
    host: 'play.yotbu.my.id',
    port: 19132,
    username: 'Bonk',
    offline: false,
    connectTimeout: 20000,
    skipPing: true,
    profilesFolder: './profiles-saya',
}

class BonkBot {
    constructor() {
        this.client = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 30000;
        this.isServerDown = false;
        this.running = true;
        this.isConnected = false;
        this.isConnecting = false;

        this.currentSlot = 0;
        this.inventory = {};
    }

    async connect() {
        // console.log('Connecting to server...');
        if (this.isConnecting || this.isConnected) return;
        console.log('Continuing to connect to server...');

        while (this.running && !this.isConnected) {
            try {
                this.isConnecting = true;

                // Retry ping up to 3 times with a delay
                let pingSuccess = false;
                for (let i = 0; i < 3; i++) {
                    try {
                        await bedrock.ping({ host: botConfig.host, port: botConfig.port, timeout: 10000 }); // Increase timeout to 10 seconds
                        pingSuccess = true;
                        break;
                    } catch (error) {
                        console.error(`Ping attempt ${i + 1} failed:`, error.message);
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
                    }
                }

                if (!pingSuccess) {
                    throw new Error('All ping attempts failed');
                }

                if (this.client) {
                    this.client.removeAllListeners();
                    this.client.close();
                    this.client = null;
                }

                this.client = bedrock.createClient(botConfig);
                this.setupEventHandlers();
                this.reconnectAttempts = 0;
                this.isServerDown = false;
                break;
            } catch (error) {
                console.error('Connection error:', error);
                this.isServerDown = true;
                this.isConnecting = false;
            }
        }
    }

    sendChat(message) {
        if (!this.client || !this.client.queue) {
            console.error('Client is not connected. Cannot send chat message.');
            return;
        }
        this.client.queue('text', {
            type: 'chat',
            needs_translation: false,
            source_name: this.client.username,
            message: message,
            filtered_message: '',
            xuid: '',
            platform_chat_id: ''
        });
    }

    sendSkinPacket() {
        const skinPacket = JSON.parse(fs.readFileSync(path.join(__dirname, 'skins', 'captured_skin.json')))
        console.log(skinPacket)
        this.client.queue('player_skin', skinPacket)
    }

    setupEventHandlers() {
        console.log('Setting up event handlers...')

        let runtimeEntityId;

        this.client.on('start_game', (packet) => {
            runtimeEntityId = packet.runtime_entity_id
            console.log(`Runtime Entity ID saved: ${runtimeEntityId}`);
        });


        this.client.on('start_game', (packet) => {
            this.client.queue('serverbound_loading_screen', {
                "type": 1
            })
            this.client.queue('serverbound_loading_screen', {
                "type": 2
            })
            this.client.queue('interact', {
                "action_id": "mouse_over_entity",
                "target_entity_id": 0n,
                "position": {
                    "x": 0,
                    "y": 0,
                    "z": 0
                }
            })
            this.client.queue('set_local_player_as_initialized', {
                "runtime_entity_id": `${runtimeEntityId}`
            })
        })

        this.client.on('join', () => {
            console.log('Bonk joined the server! ' + this.reconnectAttempts)
            // this.setupGameplayEvents()
            // console.log(this.client)
            this.isConnected = true
            this.isConnecting = false
        })

        this.client.on('spawn', () => {
            console.log('Bonk spawned in the world!')
            this.reconnectAttempts = 0
        })

        this.client.on('text', (packet) => {
            // console.log(packet)
            // Helper function to remove Minecraft formatting codes
            function removeFormattingCodes(text) {
                return text.replace(/§[0-9a-fk-or]/g, '');
            }
            const params = packet?.parameters
            //console.log(`Chat message: ${packet.message} ${params ? " + params: " + JSON.stringify(params) : ''}`)
            switch (packet.type) {
                case 'json_whisper':
                    const messageObj = JSON.parse(packet.message);
                    const chatText = messageObj.rawtext[0].text;
                    log(`CHAT`, `${chatText}`);
                    break;

                case 'json':
                    try {
                        const messageObj = JSON.parse(packet.message);
                        const chatText = messageObj.rawtext[0].text;
                        const cleanText = removeFormattingCodes(chatText);
                        log(`CHAT`, `${cleanText}`);
                    } catch (error) {
                        log(`ERROR`, `Failed to parse JSON message: ${packet.message}`);
                    }
                    break;

                case 'translation':
                    // Remove formatting codes and the % prefix from the translation key
                    const translationKey = packet.message.replace(/§[0-9a-fk-or]/g, '').replace(/^%/, '');

                    // Get the translated message from the .lang file
                    let readableMessage = langStrings[translationKey] || translationKey;

                    // Resolve nested translation keys in parameters
                    const params = (packet.parameters || []).map(param => {
                        if (typeof param === 'string' && param.startsWith('%')) {
                            // Remove the % prefix and resolve the nested key
                            const nestedKey = param.replace(/^%/, '');
                            return langStrings[nestedKey] || param; // Use the resolved value or fallback to the original
                        }
                        return param; // Return the parameter as-is if it's not a translation key
                    });

                    // Replace numbered placeholders (%1$s, %2$s, etc.) and simple placeholders (%s) with parameters
                    if (params.length > 0) {
                        readableMessage = readableMessage.replace(/%(\d\$)?s/g, (match) => {
                            if (match.startsWith('%1$')) {
                                return params[0] || match; // Use the first parameter for %1$s
                            } else if (match.startsWith('%2$')) {
                                return params[1] || match; // Use the second parameter for %2$s
                            } else {
                                return params.shift() || match; // Use the next parameter for %s
                            }
                        });
                    }

                    log(`EVENT`, `${readableMessage}`);
                    break;

                case 'chat':
                    const playerName = packet.source_name;
                    const chatMessage = packet.message;
                    log(`CHAT`, `<${playerName}> ${chatMessage}`);
                    break;

                default:
                    log(`UNKNOWN`, `${JSON.stringify(packet)}`);
                    break;
            }
        })

        this.client.on('packet', (packet) => {
            // console.log(packet)
            if (packet?.data?.name === 'player_skin') {
                console.log('Received skin packet:', packet.data)
                // Store the skin packet
                const skinsDir = path.join(__dirname, 'skins')
                if (!fs.existsSync(skinsDir)) {
                    fs.mkdirSync(skinsDir)
                }
                fs.writeFileSync(
                    path.join(skinsDir, 'captured_skin.json'),
                    JSON.stringify(packet.data.params, null, 2)
                )
            }

            if (packet?.data?.name === 'inventory_slot') {
                // console.log('Inventory slot packet received:')
                // console.log(packet)
                this.currentSlot = packet.data.params.slot
                // console.log(`Current hotbar slot: ${this.currentSlot}`)
            }

            // Track inventory contents
            if (packet?.data?.name === 'inventory_content') {
                // console.log('Inventory contents:')
                // console.log(packet)
                this.inventory = packet.data.params.input
                const currentItem = this.inventory[this.currentSlot]
                // console.log(`Current item: ${currentItem ? currentItem.name : 'empty'}`)
            }
        })

        this.client.on('disconnect', (packet) => {
            if (!packet.message.includes('serverIdConflict')) {
                console.log('Bonk disconnected:', packet.message)
                this.isConnected = false
                this.isConnecting = false
            }
        })

        this.client.on('close', () => {
            console.log('Connection closed')
            this.isConnected = false
            this.isConnecting = false
        })

        this.client.on('error', (err) => {
            console.error('Error:', err)
            this.isServerDown = true
            this.isConnected = false
            this.isConnecting = false
        })
    }

    // Add this new method to get current item info
    getCurrentItem() {
        // console.log(this.inventory)
        const item = this.inventory[this.currentSlot]
        return item ? JSON.stringify(item) : 'empty'
    }

    stop() {
        this.running = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.client) {
            this.client.removeAllListeners();
            this.client.close();
            this.client = null;
        }
        console.log('Bot has been stopped.');
    }
}

const bonk = new BonkBot()
process.on('unhandledRejection', error => console.log('Unhandled rejection:', error))
process.on('uncaughtException', error => console.log('Uncaught exception:', error))

const startBot = async () => {
    while (true) {
        try {
            await bonk.connect()
            await new Promise(resolve => setTimeout(resolve, 5000))
        } catch (error) {
            console.log('Bot failed to connect, restarting...')
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.on('line', (input) => {
    if (input.startsWith('/')) {
        // Command mode
        const command = input.slice(1)
        switch (command) {
            case 'stop':
                bonk.stop()
                process.exit()
                break
            case 'setskin':
                bonk.sendSkinPacket()
                break
            case 'slot':
                console.log(`Current slot: ${bonk.currentSlot}`)
                console.log(`Current item: ${bonk.getCurrentItem()}`)
                break
            default:
                console.log('Available commands: /stop')
        }
    } else {
        // Chat mode
        bonk.sendChat(input)
    }
})

startBot()

// setInterval(() => {
//     const memoryUsage = process.memoryUsage();
//     console.log(`Memory usage: RSS=${memoryUsage.rss / 1024 / 1024} MB, HeapUsed=${memoryUsage.heapUsed / 1024 / 1024} MB`);
// }, 10000); // Log memory usage every 10 seconds