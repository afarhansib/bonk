import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function loadLangFile() {
    const langFilePath = path.join(__dirname, '../texts/mcbe-1.21.50-us.lang')
    const content = fs.readFileSync(langFilePath, 'utf8')
    const langStrings = content.split('\n').reduce((acc, line) => {
        const [key, value] = line.split('=')
        if (key && value) acc[key.trim()] = value.trim()
        return acc
    }, {})

    console.log('Loaded .lang file with', Object.keys(langStrings).length, 'entries.')
    
    return langStrings
}
