const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');
const express = require('express');
const router = express.Router();
const alexBrain = require('./alexBrain');
const supabaseClient = require('./supabaseClient');

// Session Management (In-Memory Fallback)
const activeSessions = new Map();
const clientConfigs = new Map();
const sessionStatus = new Map(); // Track: connecting, qr_ready, online, disconnected
const sessionQRs = new Map();    // Store last QR code
const sessionsDir = './sessions';

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// DB Persistence Helper
async function persistStatus(instanceId, status, qr = null) {
    sessionStatus.set(instanceId, status);
    if (qr) sessionQRs.set(instanceId, qr);

    const config = clientConfigs.get(instanceId) || {};
    await supabaseClient.upsertStatus(instanceId, config.companyName || 'Bot', status, qr);
}

// --- HANDLER: QR MODE (Baileys) ---
async function handleQRMessage(sock, msg, instanceId) {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

    // Detectar tipo de mensaje
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;
    const hasImage = !!(msg.message.imageMessage || msg.message.image || msg.message.videoMessage);

    // Si es solo imagen/video sin texto, responder que no se puede procesar
    if (hasImage && !text) {
        const remoteJid = msg.key.remoteJid;
        try {
            await sock.sendMessage(remoteJid, { text: "¡Hola! Soy Alex. Lamentablemente, en este momento no puedo ver imágenes ni videos. ¿Podrías describirme con palabras lo que necesitas? Así podré ayudarte mejor 😊" });
        } catch (e) {
            console.error('Error sending message:', e.message);
        }
        return;
    }

    if (!text) return;

    const config = clientConfigs.get(instanceId) || { companyName: 'ALEX IO' };
    const remoteJid = msg.key.remoteJid;

    try {
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        // Generate AI Response
        const result = await alexBrain.generateResponse({
            message: text,
            history: [],
            botConfig: {
                bot_name: config.companyName,
                system_prompt: config.customPrompt || 'Eres ALEX IO, asistente virtual inteligente.'
            }
        });

        if (result.text) {
            await sock.sendMessage(remoteJid, { text: result.text });
            console.log(`📤 [${config.companyName}] Respondido con ${result.trace.model}`);
        }
    } catch (err) {
        console.error('❌ Error handling message:', err.message);
    }
}

// --- CONNECT FUNCTION ---
async function connectToWhatsApp(instanceId, config, res = null) {
    const sessionPath = `${sessionsDir}/${instanceId}`;
    clientConfigs.set(instanceId, config);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['ALEX IO', 'Chrome', '120.0.04'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    activeSessions.set(instanceId, sock);
    persistStatus(instanceId, 'connecting');

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            persistStatus(instanceId, 'qr_ready', qr);
            if (res && !res.headersSent) {
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) res.json({ success: true, qr_code: url, instance_id: instanceId, status: 'qr_ready' });
                });
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            persistStatus(instanceId, statusCode === DisconnectReason.loggedOut ? 'disconnected' : 'connecting');
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(instanceId, config, null), 5000);
        } else if (connection === 'open') {
            persistStatus(instanceId, 'online');
            sessionQRs.delete(instanceId);
            console.log(`✅ ${config.companyName} ONLINE!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) await handleQRMessage(sock, msg, instanceId);
    });

    return sock;
}

// --- ENDPOINTS ---

// Connect WhatsApp (QR)
router.post('/connect', async (req, res) => {
    const { companyName, customPrompt } = req.body;
    const instanceId = `alex_${Date.now()}`;

    try {
        // Start connection process in background (do not pass res)
        connectToWhatsApp(instanceId, { companyName, customPrompt }, null);

        // Return immediately so frontend can start polling
        res.json({
            success: true,
            message: 'Iniciando conexión...',
            instance_id: instanceId,
            status: 'connecting'
        });
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Get Session Status (Polling Endpoint)
router.get('/status/:instanceId', async (req, res) => {
    const { instanceId } = req.params;
    let status = sessionStatus.get(instanceId);
    let qr = sessionQRs.get(instanceId);

    // Recovery: Check DB if memory is empty (e.g., after server restart)
    if (!status) {
        const data = await supabaseClient.getStatus(instanceId);
        if (data) {
            status = data.status;
            qr = data.qr_code;
            // Partially restore to memory for faster future access
            sessionStatus.set(instanceId, status);
            if (qr) sessionQRs.set(instanceId, qr);
        }
    }

    status = status || 'not_found';

    if (qr) {
        QRCode.toDataURL(qr, (err, url) => {
            res.json({ status, qr_code: url, instance_id: instanceId });
        });
    } else {
        res.json({ status, instance_id: instanceId });
    }
});

// Disconnect
router.post('/disconnect', (req, res) => {
    const { instanceId } = req.body;
    if (activeSessions.has(instanceId)) {
        activeSessions.get(instanceId).logout();
        activeSessions.delete(instanceId);
        clientConfigs.delete(instanceId);
        try { fs.rmSync(`./sessions/${instanceId}`, { recursive: true, force: true }); } catch (e) { }
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

// Webhook for Cloud API (360Dialog / Meta)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object) {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (messages && messages[0]) {
            const msg = messages[0];
            const from = msg.from;
            const text = msg.text?.body;

            if (text) {
                const result = await alexBrain.generateResponse({
                    message: text,
                    botConfig: { bot_name: 'ALEX IO SaaS', system_prompt: 'Eres ALEX IO.' }
                });

                // Here you would send the message back via 360Dialog/Meta API
                console.log(`📩 [Cloud] ${from}: ${text} -> ${result.text.substring(0, 30)}...`);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Status
router.get('/status', (req, res) => {
    res.json({
        active_sessions: activeSessions.size,
        uptime: process.uptime(),
        cache_stats: global.responseCache?.getStats()
    });
});

module.exports = router;
