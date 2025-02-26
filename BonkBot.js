import 'dotenv/config'

import bedrock from 'bedrock-protocol'
import fs from 'fs'
import path from 'path'
import config from './config.js'
import { log } from './utils/logger.js'
import { loadLangFile } from './utils/langLoader.js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const langStrings = loadLangFile()

const onlinePlayers = new Map()

export default class BonkBot {
    constructor(options = null) {
        this.client = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 30000;
        this.isServerDown = false;
        this.running = true;
        this.isConnected = false;
        this.isConnecting = false;

        // Use provided options or fall back to config
        this.config = options || config;

        // Check if using custom logger or default console.log
        this.isCustomLogger = options?.logger && options.logger !== console.log;
        this.logger = options?.logger || console.log;

        this.currentSlot = 0;
        this.inventory = {};
    }

    async connect() {
        // console.log('Connecting to server...');
        if (this.isConnecting || this.isConnected) return;
        this.logger('Continuing to connect to server...');

        while (this.running && !this.isConnected) {
            try {
                this.isConnecting = true;
                // console.log(JSON.stringify(config, null, 2))
                // Retry ping up to 3 times with a delay
                let pingSuccess = false;
                for (let i = 0; i < 3; i++) {
                    try {
                        await bedrock.ping({
                            host: this.config.host,
                            port: this.config.port,
                            timeout: 10000
                        }); // Increase timeout to 10 seconds
                        pingSuccess = true;
                        break;
                    } catch (error) {
                        this.logger(`Ping attempt ${i + 1} failed:`, error.message);
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
                    host: this.config.host,
                    port: this.config.port,
                    username: this.config.username,
                    offline: this.config.offline,
                    profilesFolder: this.config.profilesFolder,
                    conLog: (...args) => {
                        const message = args.join(' ');
                        if (this.isCustomLogger) {
                            this.logger(`AUTH: ${message}`);
                        } else {
                            log('AUTH', message);
                        }
                    },
                    onMsaCode: (code) => {
                        if (this.isCustomLogger) {
                            this.logger(`AUTH: ${code?.message}`);
                        } else {
                            log('AUTH', code?.message);
                        }
                    },
                })
                this.setupEventHandlers();
                this.reconnectAttempts = 0;
                this.isServerDown = false;
                break;
            } catch (error) {
                this.logger('Connection error:', error);
                this.isServerDown = true;
                this.isConnecting = false;
            }
        }
    }

    sendChat(message) {
        if (!this.client || !this.client.queue) {
            this.logger('Client is not connected. Cannot send chat message.');
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
        this.logger(skinPacket)
        this.client.queue('player_skin', skinPacket)
    }

    setupEventHandlers() {
        this.logger('Setting up event handlers...')

        let runtimeEntityId;

        this.client.on('start_game', (packet) => {
            runtimeEntityId = packet.runtime_entity_id
            // this.logger(`Runtime Entity ID saved: ${runtimeEntityId}`);
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
            this.logger('Bonk joined the server! ' + this.reconnectAttempts)
            // this.setupGameplayEvents()
            // this.logger(this.client)
            this.isConnected = true
            this.isConnecting = false
        })

        this.client.on('spawn', () => {
            this.logger('Bonk spawned in the world!')
            this.reconnectAttempts = 0
        })

        this.client.on('text', (packet) => {
            // this.logger(packet)
            // Helper function to remove Minecraft formatting codes
            function removeFormattingCodes(text) {
                return text.replace(/§[0-9a-fk-or]/g, '');
            }
            const params = packet?.parameters
            //this.logger(`Chat message: ${packet.message} ${params ? " + params: " + JSON.stringify(params) : ''}`)
            switch (packet.type) {
                case 'json_whisper':
                    const messageObj = JSON.parse(packet.message);
                    const chatText = messageObj.rawtext[0].text;
                    if (this.isCustomLogger) {
                        this.logger(`CHAT: ${chatText}`);
                    } else {
                        log(`CHAT`, `${chatText}`);
                    }
                    break;

                case 'json':
                    try {
                        const messageObj = JSON.parse(packet.message);
                        const chatText = messageObj.rawtext[0].text;
                        const cleanText = removeFormattingCodes(chatText);
                        if (this.isCustomLogger) {
                            this.logger(`CHAT: ${cleanText}`);
                        } else {
                            log(`CHAT`, `${cleanText}`);
                        }
                    } catch (error) {
                        if (this.isCustomLogger) {
                            this.logger(`ERROR: Failed to parse JSON message: ${packet.message}`);
                        } else {
                            log(`ERROR`, `Failed to parse JSON message: ${packet.message}`);
                        }
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

                    if (this.isCustomLogger) {
                        this.logger(`EVENT: ${readableMessage}`);
                    } else {
                        log(`EVENT`, `${readableMessage}`);
                    }
                    break;

                case 'chat':
                    const playerName = packet.source_name;
                    const chatMessage = packet.message;
                    if (this.isCustomLogger) {
                        this.logger(`CHAT: <${playerName}> ${chatMessage}`);
                    } else {
                        const cleanText = removeFormattingCodes(chatText);
                        log(`CHAT`, `${cleanText}`);
                    }
                    break;

                default:
                    if (this.isCustomLogger) {
                        this.logger(`UNKNOWN: ${JSON.stringify(packet)}`);
                    } else {
                        log(`UNKNOWN`, `${JSON.stringify(packet)}`);
                    }
                    break;
            }
        })

        this.client.on('packet', (packet) => {
            const logFilePath = path.join(__dirname, 'packet_log.txt');
            const packetName = packet?.data?.name;
            // if (!['level_chunk', 'move_player', 'current_structure_feature'].includes(packetName)) {
            //     this.logger(packet?.data);
            // }
            function safeStringify(obj) {
                return JSON.stringify(obj, (key, value) => {
                    // Check if the value is a BigInt
                    if (typeof value === 'bigint') {
                        return value.toString(); // Convert BigInt to string
                    }
                    return value; // Return the value as is
                }, 2); // Pretty print with 2 spaces
            }
            // if (['player_list', 'start_game'].includes(packetName)) {
            //     // this.logger(packet?.data);
            //     if (this.isCustomLogger) {
            //         this.logger(`PACKET: ${safeStringify(packet?.data)}`);
            //     } else {
            //         log(`PACKET`, `${safeStringify(packet?.data)}`);
            //     }
            // }
            if (packetName === 'start_game') {
                // console.log(packet?.data)
                const position = packet?.data?.params?.player_position;
                const dimension = packet?.data?.params?.dimension;
                if (position) {
                    const { x, y, z } = position; // Destructure the coordinates
                    const logMessage = `Bonk's position - X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)} (${dimension})`; // Format the message

                    if (this.isCustomLogger) {
                        this.logger('EVENT:' + logMessage);
                    } else {
                        log(`EVENT`, logMessage);
                    }
                }
            }

            if (packet?.data?.name === 'player_list') {
                const records = packet?.data?.params?.records?.records;

                records.forEach(record => {
                    const playerName = record.username; // Get the username
                    const playerUUID = record.uuid; // Get the UUID

                    switch (packet?.data?.params?.records?.type) {
                        case 'add':
                            onlinePlayers.set(playerUUID, playerName); // Store the UUID and username
                            break;
                        case 'remove':
                            onlinePlayers.delete(playerUUID); // Remove the player by UUID
                            break;
                    }
                });

                const playerCount = onlinePlayers.size; // Count the number of players
                const playerList = Array.from(onlinePlayers.values()).join(', '); // Create a comma-separated list of usernames

                const logMessage = `Total players online: ${playerCount} | Players: ${playerList}`;

                if (this.isCustomLogger) {
                    this.logger(`EVENT: ${logMessage}`);
                } else {
                    log(`EVENT`, `${logMessage}`);
                }
            }

            // Append the packet name to the log file
            // fs.appendFile(logFilePath, `${new Date().toISOString()}: ${packetName}\n`, (err) => {
            //     if (err) {
            //         console.error('Error writing to log file:', err);
            //     }
            // });
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
                this.logger('Skin saved:', skinFilePath);
            }

            if (packet?.data?.name === 'inventory_slot') {
                // this.logger('Inventory slot packet received:')
                // this.logger(packet)
                this.currentSlot = packet.data.params.slot
                // this.logger(`Current hotbar slot: ${this.currentSlot}`)
            }

            // Track inventory contents
            if (packet?.data?.name === 'inventory_content') {
                // this.logger('Inventory contents:')
                // this.logger(packet)
                this.inventory = packet.data.params.input
                const currentItem = this.inventory[this.currentSlot]
                // this.logger(`Current item: ${currentItem ? currentItem.name : 'empty'}`)
            }
        })

        this.client.on('disconnect', (packet) => {
            if (!packet.message.includes('serverIdConflict')) {
                this.logger('Bonk disconnected:', packet.message)
                this.isConnected = false
                this.isConnecting = false
            }
        })

        this.client.on('close', () => {
            this.logger('Connection closed')
            this.isConnected = false
            this.isConnecting = false
        })

        this.client.on('error', (err) => {
            this.logger('Error:', err)
            this.isServerDown = true
            this.isConnected = false
            this.isConnecting = false
        })
    }

    // Add this new method to get current item info
    getCurrentItem() {
        // this.logger(this.inventory)
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
        this.logger('Bot has been stopped.');
    }
}