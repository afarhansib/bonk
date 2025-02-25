import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import BonkBot from './BonkBot.js';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { colors, getFormattedTimestamp } from './utils/logger.js';
import { Tunnel } from "cloudflared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read configuration from .profiles/index.json
const configPath = path.join(__dirname, '.profiles', 'index.json');
let botsConfig = [];

function loadBotsConfig() {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        botsConfig = JSON.parse(configContent);
        return botsConfig;
    } catch (error) {
        console.error('Error loading bots config:', error);
        return [];
    }
}

// Watch for changes in the config file
fs.watch(configPath, (eventType) => {
    if (eventType === 'change') {
        console.log('Config file changed, reloading bots...');
        const newConfig = loadBotsConfig();
        
        // Stop disabled bots
        for (const [botId, botData] of activeBots.entries()) {
            const botConfig = newConfig.find(c => c.botId === botId);
            if (!botConfig || botConfig.disabled) {
                console.log(`Stopping bot ${botId}`);
                botData.bot?.stop();
                const { ws, ...botDataRest } = activeBots.get(botId);
                activeBots.set(botId, { bot: null, logs: [], ws });
            }
        }

        // Start new or enabled bots
        for (const config of newConfig) {
            if (!config.disabled && (!activeBots.has(config.botId) || activeBots.get(config.botId)?.bot === null)) {
                startBotFromConfig(config);
            }
        }
    }
});

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || 'your-default-api-key';
const activeBots = new Map();
const wsTokens = new Map();

// Add WebSocket for real-time logs
const wss = new WebSocketServer({ noServer: true });

// Move CORS middleware before other middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:8001'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Middleware to check API key
app.use((req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Start a bot instance from config
async function startBotFromConfig(config) {
    const botId = config.botId;
    const botProfilePath = path.join(__dirname, 'xbox-profiles', botId);
    
    if (!fs.existsSync(botProfilePath)) {
        fs.mkdirSync(botProfilePath, { recursive: true });
    }

    // Create custom logger for this bot
    const logHandler = (message) => {
        const logEntry = {
            timestamp: Date.now(),
            type: 'log',
            botId,
            message
        };

        const botData = activeBots.get(botId);
        if (botData) {
            botData.logs.push(logEntry);
            if (botData.logs.length > 1000) {
                botData.logs.shift();
            }

            if (botData.ws) {
                botData.ws.send(JSON.stringify(logEntry));
            }
        }
        if (process.env.SHOW_LOGS === 'true') {
            const timestamp = getFormattedTimestamp()
            console.log(`${colors.gray}${timestamp}${colors.reset} [${botId}] ${message}`)
        }
    };

    const bot = new BonkBot({
        host: config.serverIp,
        port: config.serverPort,
        profilesFolder: botProfilePath,
        username: config.botUsername,
        offline: Boolean(config.botOfflineMode),
        logger: logHandler
    });

    // Initialize bot data structure
    if (!activeBots.has(botId)) {
        activeBots.set(botId, { bot: null, logs: [], ws: null });
    }

    const botData = activeBots.get(botId);
    botData.bot = bot;

    // Start reconnection loop
    while (true) {
        try {
            await bot.connect();
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            logHandler(`Bot failed to connect, restarting in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Start a bot instance through API
app.post('/bot/start', async (req, res) => {
    const botId = req.body.data.bot_id
    const serverIp = req.body.data.server_ip
    const serverPort = req.body.data.server_port
    const botUsername = req.body.data.bot_username
    const botOfflineMode = req.body.data.bot_offline_mode

    if (!botId) {
        return res.status(400).json({ error: 'botId is required' });
    }

    // Check if bot is already initialized and running
    if (activeBots.has(botId) && activeBots.get(botId).bot !== null) {
        return res.status(400).json({ error: 'Bot already running' });
    }

    try {
        // Add new bot to config file or update existing bot
        const config = loadBotsConfig();
        const existingConfig = config.find(c => c.botId === botId);
        
        if (existingConfig) {
            // Update existing bot details
            existingConfig.serverIp = serverIp;
            existingConfig.serverPort = serverPort;
            existingConfig.botUsername = botUsername;
            existingConfig.botOfflineMode = botOfflineMode;
            existingConfig.disabled = false; // Set disabled to false when starting
        } else {
            // Add new bot to config
            config.push({
                botId,
                serverIp,
                serverPort,
                botUsername,
                botOfflineMode,
                disabled: false // Set disabled to false when starting
            });
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

        // Bot will be started by the file watcher
        res.json({ status: 'Bot configuration added or updated' });
    } catch (error) {
        console.error('Error starting bot:', error);
        res.status(500).json({ error: 'Failed to start bot' });
    }
});

// Stop a bot instance
app.post('/bot/stop', (req, res) => {
    const { botId } = req.body;
    console.log('Current active bots:', Array.from(activeBots.keys())); // Log active bot IDs
    const { bot } = activeBots.get(botId);

    // Update the config to set disabled to true
    const config = loadBotsConfig();
    const existingConfig = config.find(c => c.botId === botId);
    if (existingConfig) {
        existingConfig.disabled = true; // Set disabled to true when stopping
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    }

    if (!bot) {
        // return res.status(404).json({ error: 'Bot not found' });
        return res.json({ status: 'already stopped', botId });
    }

    try {
        bot.stop();
        const { ws, ...botDataRest } = activeBots.get(botId);
        activeBots.set(botId, { ...botDataRest, bot: null, ws });

        res.json({ status: 'stopped', botId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get bot status
app.get('/bot/status', (req, res) => {
    const { botId } = req.query;
    try {
        const { bot } = activeBots.get(botId);
        res.json({
            wsStatus: activeBots.get(botId)?.ws ? 'connected' : 'disconnected',
            status: bot.isConnected ? 'connected' : 'connecting',
            botId
        });
    } catch (error) {
        res.status(404).json({ error: 'Bot not found' });
    }
});

// Send chat message
app.post('/bot/chat', (req, res) => {
    const { botId, message } = req.body;
    const { bot } = activeBots.get(botId);

    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    try {
        bot.sendChat(message);
        res.json({ status: 'sent', botId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/bot/logs/token', (req, res) => {
    const { botId } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    wsTokens.set(token, { botId, timestamp: Date.now() });
    res.json({ token });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Bonk API server running on port ${PORT}`);
    
    // Start all enabled bots from config
    const configs = loadBotsConfig();
    for (const config of configs) {
        if (!config.disabled) {
            startBotFromConfig(config).catch(err => {
                console.error(`Failed to start bot ${config.botId}:`, err);
            });
        }
    }
});

// Update the upgrade handler
server.on('upgrade', (request, socket, head) => {
    const { pathname, searchParams } = new URL(request.url, 'http://localhost');

    if (pathname === '/bot/logs') {
        const token = searchParams.get('token');
        const tokenData = wsTokens.get(token);

        // Check token validity (expire after 5 minutes)
        if (!tokenData || (Date.now() - tokenData.timestamp > 300000)) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        const { botId } = tokenData;
        wsTokens.delete(token); // One-time use token

        wss.handleUpgrade(request, socket, head, (ws) => {
            // Create bot entry if it doesn't exist
            if (!activeBots.has(botId)) {
                activeBots.set(botId, { bot: null, logs: [], ws: null });
            }

            // Set the WebSocket connection
            activeBots.get(botId).ws = ws;
            ws.send(JSON.stringify({ type: 'connected', botId }));

            // Send historical logs
            const botData = activeBots.get(botId);
            if (botData.logs.length > 0) {
                ws.send(JSON.stringify({
                    type: 'history',
                    logs: botData.logs
                }));
            }

            ws.on('close', () => {
                if (activeBots.has(botId)) {
                    activeBots.get(botId).ws = null;
                }
            });
        });
    } else {
        socket.destroy();
    }
});

async function startTunnel() {
    const tunnel = Tunnel.withToken(process.env.CFTOKEN);
    
    // // show the url
    // const url = new Promise((resolve) => tunnel.once("url", resolve));
    // console.log("LINK:", await url);
    
    // // wait for connection to be established
    // const conn = new Promise((resolve) => tunnel.once("connected", resolve));
    // console.log("CONN:", await conn);
    
    // // stop the tunnel after 15 seconds
    // setTimeout(tunnel.stop, 15_000);
    
    // tunnel.on("exit", (code) => {
    //     console.log("tunnel process exited with code", code);
    // });
}

startTunnel();