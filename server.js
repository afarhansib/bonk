import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import BonkBot from './BonkBot.js';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || 'your-default-api-key';
const activeBots = new Map();
const wsTokens = new Map();

// Add WebSocket for real-time logs
const wss = new WebSocketServer({ noServer: true });

// Move CORS middleware before other middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key']
}));
// Middleware to check API key
app.use((req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Start a bot instance
app.post('/bot/start', async (req, res) => {
    const {
        botId,
        serverIp = 'localhost',
        serverPort = 19132,
        botUsername = 'Bonk',
        botOfflineMode = false
    } = req.body;

    if (!botId) {
        return res.status(400).json({ error: 'botId is required' });
    }

    // Check if bot is already initialized and running
    if (activeBots.has(botId) && activeBots.get(botId).bot !== null) {
        return res.status(400).json({ error: 'Bot already running' });
    }

    const botProfilePath = path.join(__dirname, 'profiles', botId);
    if (!fs.existsSync(botProfilePath)) {
        fs.mkdirSync(botProfilePath, { recursive: true });
    }

    try {
        // If bot entry doesn't exist, create it
        if (!activeBots.has(botId)) {
            activeBots.set(botId, { bot: null, logs: [], ws: null });
        }

        // Create custom logger for this bot
        // In the logHandler function within /bot/start endpoint
        const logHandler = (message) => {
            // Create log entry with timestamp
            const logEntry = {
                timestamp: Date.now(),
                type: 'log',
                botId,
                message
            };

            // Add to logs array, limit to 1000 entries
            const botData = activeBots.get(botId);
            botData.logs.push(logEntry);
            if (botData.logs.length > 1000) {
                botData.logs.shift(); // Remove oldest log
            }

            // Send to WebSocket if connected
            if (botData.ws) {
                botData.ws.send(JSON.stringify(logEntry));
            }
        };

        const bot = new BonkBot({
            host: serverIp,
            port: parseInt(serverPort),
            profilesFolder: botProfilePath,
            username: botUsername,
            offline: Boolean(botOfflineMode),
            logger: logHandler
        });

        // Update the bot in the activeBots map
        activeBots.get(botId).bot = bot;

        await bot.connect();
        res.json({ status: 'started', botId });
    } catch (error) {
        // Only remove the bot instance, keep the WebSocket if it exists
        if (activeBots.has(botId)) {
            activeBots.get(botId).bot = null;
        }
        res.status(500).json({ error: error.message });
    }
});

// Stop a bot instance
app.post('/bot/stop', (req, res) => {
    const { botId } = req.body;
    const { bot } = activeBots.get(botId);

    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    try {
        bot.stop();
        activeBots.delete(botId);
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
