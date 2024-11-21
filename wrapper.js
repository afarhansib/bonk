import { spawn } from 'child_process'

function startBot() {
    const bot = spawn('node', ['flayer-base.js'], {
        stdio: 'inherit'
    })

    bot.on('close', (code) => {
        console.log(`Bonk exited with code ${code}`)
        setTimeout(() => {
            startBot()
        }, 10000)
    })
}

startBot()
