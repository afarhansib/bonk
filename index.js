const bedrock = require('bedrock-protocol')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

const botConfig = {
    host: 'laughtale.my.id',
    port: 7004,
    // host: 'localhost',
    // port: 3000,
    username: 'Bonk',
    offline: false,
    connectTimeout: 20000,
    skipPing: true,
    profilesFolder: './profiles',
}

class BonkBot {
    constructor() {
        this.client = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 10
        this.reconnectDelay = 5000
        this.isServerDown = false
        this.running = true
        this.isConnected = false
        this.isConnecting = false
        this.heartbeatInterval = null

        this.currentSlot = 0
        this.inventory = {}
    }

    async connect() {
        if (this.isConnecting || this.isConnected) return

        while (this.running && !this.isConnected) {
            try {
                this.isConnecting = true
                await bedrock.ping({ host: botConfig.host, port: botConfig.port })
                // console.log('first client check, ', this.client)
                if (this.client) {
                    this.client.removeAllListeners()
                    this.client = null
                }
                this.client = bedrock.createClient(botConfig)
                // console.log('second client check, ', this.client)
                this.setupEventHandlers()
                this.setupHeartbeat()
                this.reconnectAttempts = 0
                this.isServerDown = false
                break
            } catch (error) {
                console.error('Connection error:', error)
                this.isServerDown = true
                this.isConnecting = false
                await this.handleReconnect()
            }
        }
    }

    setupHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
        }

        this.heartbeatInterval = setInterval(async () => {
            // Only proceed with ping check if we're not already confirmed connected
            if (!this.isConnected || !this.client) {
                try {
                    await bedrock.ping({ host: botConfig.host, port: botConfig.port })
                } catch (error) {
                    console.log('Server heartbeat failed, initiating reconnect...')
                    this.isConnected = false
                    this.isServerDown = true
                    if (this.client) {
                        this.client.removeAllListeners()
                        this.client = null
                    }
                    this.handleReconnect()
                }
            }
        }, 5000)
    }

    sendChat(message) {
        this.client.queue('text', {
            type: 'chat',
            needs_translation: false,
            source_name: this.client.username,
            message: message,
            filtered_message: '',
            xuid: '',
            platform_chat_id: ''
        })
    }

    sendSkinPacket() {
        const skinPacket = JSON.parse(fs.readFileSync(path.join(__dirname, 'skins', 'captured_skin.json')))
        console.log(skinPacket)
        this.client.queue('player_skin', skinPacket)
    }

    setupEventHandlers() {
        console.log('Setting up event handlers...')

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
            const params = packet?.parameters
            console.log(`Chat message: ${packet.message} ${params ? " + params: " + JSON.stringify(params) : ''}`)
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
                this.handleReconnect()
            }
        })

        this.client.on('close', () => {
            console.log('Connection closed')
            this.isConnected = false
            this.isConnecting = false
            this.handleReconnect()
        })

        this.client.on('error', (err) => {
            console.error('Error:', err)
            this.isServerDown = true
            this.isConnected = false
            this.isConnecting = false
            this.handleReconnect()
        })
    }

    // Add this new method to get current item info
    getCurrentItem() {
        // console.log(this.inventory)
        const item = this.inventory[this.currentSlot]
        return item ? JSON.stringify(item) : 'empty'
    }

    async handleReconnect() {
        if (this.isConnecting) return

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

            const delay = this.isServerDown ? this.reconnectDelay * 2 : this.reconnectDelay

            await new Promise(resolve => setTimeout(resolve, delay))

            if (this.client) {
                // this.client.removeAllListeners()
                this.client = null
            }
            await this.connect()
        } else {
            console.log('Max reconnection attempts reached. Resetting counter and continuing...')
            this.reconnectAttempts = 0
            await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * 2))
            await this.connect()
        }
    }

    stop() {
        this.running = false
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
        }
        if (this.client) {
            this.client.close()
        }
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
            console.log('Bot crashed, restarting...')
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
