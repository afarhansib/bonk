import mineflayer from 'mineflayer'
import chalk from 'chalk'
import readline from 'readline'

let currentBot = null
let globalHealthCheck = null

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.on('line', (line) => {
    if (currentBot) {
        try {
            currentBot.chat(line)
        } catch (e) {
            console.log(chalk.red('currentBot disappeared.'))
            console.log(e)
        }
    }
})

function createBot() {
    if (currentBot) {
        currentBot.removeAllListeners()
        currentBot.end()
    }
    console.log('Spawning Bonk...')
    currentBot = mineflayer.createBot({
        host: 'localhost',
        username: 'Bonk',
        auth: 'offline',
        port: 7000,
    })

    const events = [
        'physicsTick',
        'health',
        'move',
        'entityMoved',
        'entityUpdate',
        'packet',
        'time'
    ]

    events.forEach(event => {
        currentBot.on(event, () => {
            console.log(`EVENT_PING: ${event}`)
        })
    })

    currentBot.on('message', (jsonMsg) => {
        const date = new Date()
        const shortDate = date.toLocaleString('en-US', { month: 'short' }) + ' ' + date.getDate() + ','
        const time = date.toLocaleTimeString('en-US', { hour12: false })
        const timestamp = `${shortDate} ${time}`

        if (jsonMsg.text) {
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.yellow(jsonMsg.text)}`)
            return
        }

        if (jsonMsg.json.extra) {
            const username = jsonMsg.json.extra[0][""] || jsonMsg.json.extra[1].text.trim()
            const message = jsonMsg.json.extra[jsonMsg.json.extra.length - 1].text
            if (jsonMsg.json.extra.length === 3) {
                console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(username + jsonMsg.json.extra[1].text + '>')} ${chalk.white(message.slice(1))}`)
                return
            }
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(username + '>')} ${chalk.white(message.slice(1))}`)
        }
    })

    currentBot.on('login', () => {
        console.log(chalk.green.bold('Bot logged in successfully'))
    })

    currentBot.on('spawn', () => {
        console.log(chalk.green('Bot spawned in game'))
    })

    currentBot.on('error', (err) => {
        console.log(chalk.red.bold('Error: ') + chalk.red(JSON.stringify(err, null, 2)))
        process.exit(0)
    })

    currentBot.on('kicked', (reason) => {
        console.log(chalk.red.bold('Kicked: ') + chalk.red(JSON.stringify(reason, null, 2)))
        process.exit(0)
    })

    currentBot.on('end', () => {
        console.log(chalk.yellow('Disconnected.'))
        process.exit(0)
    })

    return currentBot
}

createBot()
