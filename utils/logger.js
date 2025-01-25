import config from '../config.js'

// Helper function to format timestamp as HH:MM:SS with offset
function getFormattedTimestamp() {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const localHours = (utcHours + config.timeZoneOffset + 24) % 24; // Adjust for offset and wrap around if needed
    const hours = String(localHours).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// ANSI color codes
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
}

export function log(type, message) {
    const timestamp = getFormattedTimestamp()
    let coloredType

    switch (type) {
        case 'CHAT':
            coloredType = `${colors.green}[${type}]${colors.reset}`
            break
        case 'EVENT':
            coloredType = `${colors.blue}[${type}]${colors.reset}`
            break
        case 'ERROR':
            coloredType = `${colors.red}[${type}]${colors.reset}`
            break
        default:
            coloredType = `[${type}]${colors.reset}`
            break
    }

    // Highlight join and left messages
    if (message.includes('joined the game')) {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${colors.white}[${colors.cyan}+${colors.white}]${colors.reset} ${colors.cyan}${message}${colors.reset}`)
    } else if (message.includes('left the game')) {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${colors.white}[${colors.magenta}-${colors.white}]${colors.reset} ${colors.magenta}${message}${colors.reset}`)
    } else {
        console.log(`${colors.gray}${timestamp}${colors.reset} ${coloredType} ${message}`)
    }
}

export function error(message) {
    log('ERROR', message);
}