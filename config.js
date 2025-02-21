import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  // Server Configuration
  host: process.env.BONK_HOST || 'localhost',
  port: parseInt(process.env.BONK_PORT) || 19132,
  username: process.env.BONK_USERNAME || 'Bonk',
  
  // Timezone Configuration
  timeZoneOffset: parseInt(process.env.TIME_ZONE_OFFSET) || 0, // Default to UTC+0
  
  // Other Settings
  offline: process.env.BONK_OFFLINE_MODE === 'true',
  connectTimeout: parseInt(process.env.BONK_CONNECT_TIMEOUT) || 20000,
  profilesFolder: path.join(__dirname, process.env.BONK_PROFILES_FOLDER || './profiles'),
}