import { spawn } from 'child_process'

function startBot() {
    let lastPing = Date.now()
    const bot = spawn('node', ['flayer-base.js'], {
        stdio: ['inherit', 'pipe', 'pipe'], // stdin inherits, stdout and stderr are piped
        env: {
            ...process.env,
            FORCE_COLOR: '1'  // This enables chalk colors
        }
    })

    bot.stdout.on('data', (data) => {
        const output = data.toString()
        if (output.includes('EVENT_PING')) {
            lastPing = Date.now()
            return
        }
        if (!output.includes('[DEP0040] DeprecationWarning: The `punycode` module is deprecated.')) {
            process.stdout.write(output)
        }
    })

    bot.stderr.on('data', (data) => {
        const output = data.toString()
        if (!output.includes('[DEP0040] DeprecationWarning: The `punycode` module is deprecated.')) {
            process.stderr.write(output)
        }
    })

    const healthCheck = setInterval(() => {
        if (Date.now() - lastPing > 30000) {
            console.log('No health ping received for 30 seconds, restarting bot...')
            clearInterval(healthCheck)
            bot.kill()
        } else {
            // console.log('Health check passed.')
        }
    }, 5000)

    bot.on('close', (code) => {
        console.log(`Bonk exited with code ${code}`)
        setTimeout(() => {
            startBot()
        }, 10000)
    })
}

startBot()
