import mineflayer from 'mineflayer'
import chalk from 'chalk'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const bot = mineflayer.createBot({
  host: 'localhost',
  username: 'Bonk',
  auth: 'offline',
  port: 7000,
})

rl.on('line', (line) => {
  bot.chat(line)
})

bot.on('message', (jsonMsg) => {
  // console.log(jsonMsg)
  if (jsonMsg.text) {
    console.log(chalk.yellow(jsonMsg.text))
    return
  }

  if (jsonMsg.json.extra) {
    const username = jsonMsg.json.extra[0][""] || jsonMsg.json.extra[1].text.trim()
    const message = jsonMsg.json.extra[jsonMsg.json.extra.length - 1].text
    if (jsonMsg.json.extra.length === 3) {
      // console.log('yotbuafk')
      console.log(chalk.cyan(username + jsonMsg.json.extra[1].text + '>') + chalk.white(message.slice(1)))
      return
    }
    console.log(chalk.cyan(username + '>') + chalk.white(message.slice(1)))
  }
})

bot.on('login', () => {
  console.log(chalk.green.bold('Bot logged in successfully'))
})

bot.on('spawn', () => {
  console.log(chalk.green('Bot spawned in game'))
})

bot.on('error', (err) => {
  console.log(chalk.red.bold('Error: ') + chalk.red(err))
})

bot.on('kicked', (reason) => {
  console.log(chalk.red.bold('Kicked: ') + chalk.red(reason))
})