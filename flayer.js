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
    currentBot.chat(line)
  }
})

function createBot() {
  if (currentBot) {
    currentBot.removeAllListeners()
    currentBot.end()
  }

  if (globalHealthCheck) {
    clearInterval(globalHealthCheck)
  }

  currentBot = mineflayer.createBot({
    host: 'localhost',
    username: 'Bonk',
    auth: 'offline',
    port: 7000,
  })

  let pingSuccess = true

  globalHealthCheck = setInterval(() => {
    if (pingSuccess) {
      pingSuccess = false
      currentBot.chat('/ping')

      setTimeout(() => {
        if (!pingSuccess) {
          console.log(chalk.yellow('Server not responding to pings. Forcing reconnect...'))
          clearInterval(globalHealthCheck)
          currentBot.end()
        }
      }, 5000)
    }
  }, 60000)

  currentBot.once('end', () => {
    clearInterval(globalHealthCheck)
  })

  currentBot.on('message', (jsonMsg) => {
    pingSuccess = true

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
  })

  currentBot.on('kicked', (reason) => {
    console.log(chalk.red.bold('Kicked: ') + chalk.red(JSON.stringify(reason, null, 2)))
    console.log(chalk.yellow('Reconnecting in 5 seconds...'))
    setTimeout(createBot, 5000)
  })

  currentBot.on('end', () => {
    console.log(chalk.yellow('Disconnected. Reconnecting in 5 seconds...'))
    setTimeout(createBot, 5000)
  })

  return currentBot
}

// Start the bot
createBot()
