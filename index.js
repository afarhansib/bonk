process.env.NODE_NO_WARNINGS = '1'

import 'dotenv/config'
import BonkBot from './BonkBot.js'
import readline from 'readline'

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