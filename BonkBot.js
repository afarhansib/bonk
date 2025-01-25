import 'dotenv/config'

import bedrock from 'bedrock-protocol'
import fs from 'fs'
import path from 'path'
import config from './config.js'
import { log } from './utils/logger.js'
import { loadLangFile } from './utils/langLoader.js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default class BonkBot {
    constructor() {
        this.client = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 30000;
        this.isServerDown = false;
        this.running = true;
        this.isConnected = false;
        this.isConnecting = false;

        this.langStrings = loadLangFile()

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
                // console.log(JSON.stringify(config, null, 2))
                // Retry ping up to 3 times with a delay
                let pingSuccess = false;
                for (let i = 0; i < 3; i++) {
                    try {
                        await bedrock.ping({ host: config.host, port: config.port, timeout: 10000 }); // Increase timeout to 10 seconds
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

                this.client = bedrock.createClient({
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    offline: config.offline,
                    profilesFolder: config.profilesFolder
                })
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
            // console.log(`Runtime Entity ID saved: ${runtimeEntityId}`);
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
                    let readableMessage = this.langStrings[translationKey] || translationKey;

                    // Resolve nested translation keys in parameters
                    const params = (packet.parameters || []).map(param => {
                        if (typeof param === 'string' && param.startsWith('%')) {
                            // Remove the % prefix and resolve the nested key
                            const nestedKey = param.replace(/^%/, '');
                            return this.langStrings[nestedKey] || param; // Use the resolved value or fallback to the original
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
                const skinsDir = path.join(__dirname, 'skins');
                if (!fs.existsSync(skinsDir)) {
                    fs.mkdirSync(skinsDir);
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // e.g., 2023-10-05T12-34-56-789Z
                const skinFilePath = path.join(skinsDir, `captured_skin_${timestamp}.json`);

                fs.writeFileSync(
                    skinFilePath,
                    JSON.stringify(packet.data.params, null, 2)
                );
                console.log('Skin saved:', skinFilePath);
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