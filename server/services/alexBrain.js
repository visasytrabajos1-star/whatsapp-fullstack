const axios = require('axios');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const personas = require('../config/personas');
const ragService = require('./ragService');

// Circuit Breaker for expired keys
const deadKeys = new Set();
const KEY_COOLDOWN_MS = 3600000; // 1 hour

// Global Response Cache
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 1800, checkperiod: 300 });

const mask = (key) => key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING';
console.log(`🧠 [V3 FREE] Inicializando Cerebro Solo-Gemini`);

/**
 * ARCHITECTURE: Cascade / Circuit Breaker
 * 1. Gemini (Primario) -> 2. OpenAI (Secondary) -> 3. Safeguard (Static)
 * ALWAY TTS at the end.
 */
async function generateResponse({ message, history = [], botConfig = {}, isAudio = false }) {
    const botName = botConfig.bot_name || 'ALEX IO';
    const personaKey = botConfig.persona || 'ALEX_MIGRATION';
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = botConfig.system_prompt || currentPersona.systemPrompt;

    // --- RAG: Knowledge Injection ---
    if (botConfig.tenantId && botConfig.instanceId) {
        const knowledgeChunk = await ragService.queryKnowledgeBase(botConfig.tenantId, botConfig.instanceId, message);
        if (knowledgeChunk) {
            console.log(`📚 [${botName}] Inyectando Knowledge Base en System Prompt...`);
            systemPrompt += `\n\n--- INFORMACIÓN DE BASE DE CONOCIMIENTOS ---\nUsa la siguiente información para responder a la consulta si es relevante:\n${knowledgeChunk}\n------------------------------------------`;
        }
    }

    // AI Limiters: Extraction and Application
    const maxWords = botConfig.maxWords || 50;
    const maxMessages = botConfig.maxMessages || 10;

    const userMessageCount = history.filter(h => h.role === 'user').length;
    if (userMessageCount >= maxMessages) {
        console.log(`⏸️ [${botName}] Límite de mensajes alcanzado (${userMessageCount}/${maxMessages}). Silenciando IA.`);
        return {
            text: "He alcanzado el límite de interacción automática. Un asesor humano continuará con tu atención en breve.",
            trace: { model: 'limiter_pause', timestamp: new Date().toISOString() },
            botPaused: true
        };
    }

    // Force conciseness
    systemPrompt += `\n\nREGLA ESTRICTA: Tu respuesta DEBE tener como MÁXIMO ${maxWords} palabras. Sé muy conciso y directo.`;

    const cacheKey = crypto.createHash('md5').update(`v2:${botName}:${message}`).digest('hex');
    let cached = global.responseCache.get(cacheKey);

    if (cached) {
        console.log(`🎯 [${botName}] Cache hit`);
        return { ...cached, fromCache: true };
    }

    let responseText = '';
    let usedModel = '';
    const normalizedUserMsg = String(message || "").trim();

    // --- POLICY ENGINE (Deterministic Security) ---
    const policyViolations = [];
    const lowerMsg = normalizedUserMsg.toLowerCase();

    // 1. Detect insults/toxicity (Basic dictionary)
    const insultRegex = /\b(estupido|idiota|imbecil|put|mierda|cabron|pendejo|tarado|imbécil|estúpido)\b/i;
    if (insultRegex.test(lowerMsg)) {
        policyViolations.push("TOXICITY_DETECTED");
    }

    // 2. Detect explicit PII (e.g. Credit Cards)
    const ccRegex = /\b(?:\d[ -]*?){13,16}\b/; // Basic CC pattern
    if (ccRegex.test(normalizedUserMsg)) {
        policyViolations.push("PII_CREDIT_CARD_DETECTED");
    }

    if (policyViolations.length > 0) {
        console.warn(`🛑 [${botName}] Policy Engine bloqueó el mensaje. Motivos:`, policyViolations);
        return {
            text: "Por políticas de seguridad corporativa, no puedo procesar tu mensaje. Por favor, evita usar lenguaje ofensivo o compartir datos financieros.",
            trace: { model: 'policy_engine', timestamp: new Date().toISOString() },
            botPaused: false
        };
    }
    // ----------------------------------------------

    // 1. GEMINI (AXIOS implementation for stability)
    const effectiveGeminiKey = botConfig.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!effectiveGeminiKey) {
        return {
            text: "El administrador del bot aún no ha configurado su clave de API de Gemini. Por favor, comunícale que debe agregarla en el panel de configuración.",
            trace: { model: 'api_key_missing', timestamp: new Date().toISOString() },
            botPaused: true
        };
    }

    if (effectiveGeminiKey && effectiveGeminiKey.length > 20 && !deadKeys.has('GEMINI')) {
        // Try multiple Gemini versions/models
        const gems = [
            { v: 'v1beta', m: 'gemini-2.0-flash' },
            { v: 'v1beta', m: 'gemini-2.0-flash-lite' },
            { v: 'v1beta', m: 'gemini-2.5-flash' }
        ];

        for (const g of gems) {
            try {
                console.log(`🚀 [${botName}] Consultando ${g.m} (${g.v})...`);
                const url = `https://generativelanguage.googleapis.com/${g.v}/models/${g.m}:generateContent?key=${GEMINI_KEY}`;

                const contents = [];
                (history || []).slice(-6).forEach(h => {
                    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text || "" }] });
                });
                contents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });

                const payload = {
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };
                if (g.v === 'v1beta') payload.system_instruction = { parts: [{ text: systemPrompt }] };

                const res = await axios.post(url, payload, { timeout: 6000 });
                if (res.data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    responseText = res.data.candidates[0].content.parts[0].text;
                    usedModel = g.m;
                    break;
                }
            } catch (err) {
                const errorMsg = err.response?.data?.error?.message || err.message;
                const statusCode = err.response?.status;
                console.warn(`⚠️ [${botName}] ${g.m} falló (${statusCode}):`, errorMsg);

                // If quota exceeded (429) or model not found (404), try next model in list
                if (statusCode === 429 && errorMsg.includes('quota')) {
                    continue;
                }

                if (statusCode === 400 && (errorMsg.includes('expired') || errorMsg.includes('API key'))) {
                    console.error(`🛑 [${botName}] Gemini API Key EXPIRED. Disabling for 1 hour.`);
                    deadKeys.add('GEMINI');
                    setTimeout(() => deadKeys.delete('GEMINI'), KEY_COOLDOWN_MS);
                    break;
                }
            }
        }
    }

    // 3. SAFEGUARD (If Gemini completely fails)
    if (!responseText) {
        responseText = '¡Hola! Soy ALEX. Estoy experimentando una alta demanda en mis sistemas de IA, pero no te preocupes, sigo aquí. ¿En qué puedo ayudarte mientras recupero mi conexión total?';
        usedModel = 'safeguard';
    }

    const result = {
        text: responseText,
        trace: { model: usedModel, timestamp: new Date().toISOString() },
        botPaused: false
    };

    // 4. VOZ
    // (Disabled for Free V3 version because it removes premium features)
    // result.audioBuffer = null;

    global.responseCache.set(cacheKey, result);
    return result;
}

/**
 * Función en segundo plano para analizar si la conversación actual forma a un prospecto (Lead)
 * y extraer su temperatura y datos para el CRM.
 */
async function extractLeadInfo({ history = [], systemPrompt, botConfig = {} }) {
    const effectiveGeminiKey = botConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!effectiveGeminiKey || history.length < 2) return null;

    try {
        console.log(`🤖 [LeadExtractor] Analizando conversación de ${history.length} mensajes...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

        const contents = [];
        // Analizar últimos 8 mensajes para contexto
        history.slice(-8).forEach(h => {
            contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text || "" }] });
        });

        const analysisPrompt = `
Analiza la conversación anterior. 
El System Prompt del Bot actuante era: "${systemPrompt || ''}"

Extrae la información del usuario en un objeto JSON estricto con esta estructura EXACTA (sin markdown adicional):
{
    "isLead": boolean (true si el usuario mostró interés, pidió info, precios, agendar, o dio sus datos),
    "name": string (nombre del usuario si lo dio, o "desconocido"),
    "email": string (correo si lo dio, o null),
    "temperature": string ("COLD" si solo saluda/curiosea, "WARM" si pregunta detalles/precios, "HOT" si quiere comprar/agendar o da sus datos),
    "summary": string (resumen de 1-2 líneas de lo que quiere el usuario o de la interacción)
}
`;
        contents.push({ role: 'user', parts: [{ text: analysisPrompt }] });

        const payload = {
            contents,
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        const res = await axios.post(url, payload, { timeout: 8000 });
        if (res.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let parsed = JSON.parse(res.data.candidates[0].content.parts[0].text);

            // 5. LEAD SCHEMA GUARD (Disabled for V3 Free)
            return parsed;
        }
    } catch (err) {
        console.warn(`⚠️ [LeadExtractor] Falló la extracción:`, err.response?.data?.error?.message || err.message);
    }
    return null;
}

/**
 * Traduce mensajes entrantes si no están en español.
 * Fast path: Gemini Flash
 */
async function translateIncomingMessage(text, targetLang = 'es', botConfig = {}) {
    const effectiveGeminiKey = botConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!text || text.length < 2 || !effectiveGeminiKey) return { original: text, translated: null, model: null };

    // Quick heuristic: if it contains typical Spanish words, ignore translation to save cost/latency
    const lower = text.toLowerCase();
    if (lower.match(/^(hola|gracias|precio|costo|info|buen|dia|tarde|noche|si|no)$/)) {
        return { original: text, translated: null, model: 'skipped' };
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveGeminiKey}`;
        const prompt = `Analiza el texto. Si ya está en idioma ISO '${targetLang}', devuelve exacto el mismo texto. Si está en OTRO idioma, tradúcelo de forma natural a '${targetLang}'. Devuelve SOLO la traducción o el texto original, sin explicaciones, comillas ni prefijos. Texto: "${text}"`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
        };

        const res = await axios.post(url, payload, { timeout: 3500 });
        if (res.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let translated = res.data.candidates[0].content.parts[0].text.trim();
            // Clean up possible weird outputs
            translated = translated.replace(/^['"](.*)['"]$/, '$1').trim();

            if (translated.toLowerCase() === text.toLowerCase()) {
                return { original: text, translated: null, model: 'gemini-flash' };
            }
            return { original: text, translated, model: 'gemini-flash' };
        }
    } catch (err) {
        console.warn(`⚠️ [Translator] Falló traducción de entrada:`, err.message);
    }
    return { original: text, translated: null, model: 'error' };
}

/**
 * STT Transcription (Disabled for Free V3)
 */
async function transcribeAudio(audioBuffer) {
    return { text: "El plan gratuito no incluye transcripción de notas de voz. Por favor responde mediante texto libre." };
}

// --- SHADOW COMPLIANCE AUDITOR (Disabled for V3) ---
async function runComplianceAudit({ messageContent, aiResponse, systemPrompt, tenantId, instanceId, messageId, supabase }) {
    // Free tier does not use Anthropic risk auditing.
    return;
}

module.exports = { generateResponse, extractLeadInfo, transcribeAudio, translateIncomingMessage, runComplianceAudit };

