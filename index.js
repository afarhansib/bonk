const bedrock = require('bedrock-protocol')

const botConfig = {
    host: 'laughtale.my.id',
    port: 7004,
    // host: 'localhost',
    // port: 3000,
    username: 'Bonk',
    offline: false,
    connectTimeout: 20000,
    skipPing: true,
    profilesFolder: './profiles'
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
    }

    async connect() {
        if (this.isConnecting || this.isConnected) return

        while (this.running && !this.isConnected) {
            try {
                this.isConnecting = true
                await bedrock.ping({ host: botConfig.host, port: botConfig.port })
                console.log('first client check, ', this.client)
                if (this.client) {
                    this.client.removeAllListeners()
                    this.client = null
                }
                this.client = bedrock.createClient(botConfig)
                console.log('second client check, ', this.client)
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

    // setupEventHandlers() {
    //     this.client.on('session', () => {
    //         this.setupGameplayEvents()
    //     })
    // }

    setupEventHandlers() {
        console.log('Setting up event handlers...')

        this.client.on('join', () => {
            console.log('Bonk joined the server! ' + this.reconnectAttempts)
            // this.setupGameplayEvents()
            console.log(this.client)
            this.isConnected = true
            this.isConnecting = false
        })

        this.client.on('spawn', () => {
            console.log('Bonk spawned in the world!')
            this.reconnectAttempts = 0
        })

        this.client.on('text', (packet) => {
            const params = packet?.parameters
            console.log(`Chat message: ${packet.message} ${params ? " + params: " + JSON.stringify(params) : ''}`)
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

startBot()
