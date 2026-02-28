const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const OpenAI = require('openai');
const NodeCache = require('node-cache');
const crypto = require('crypto');

// --- CONSTANTS ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Global Response Cache
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 1800, checkperiod: 300 });

// AI Clients
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// Log available providers on startup
const mask = (key) => key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING';
console.log(`🧠 AI Brain (Cascade Optimized):`);
console.log(`   - Gemini Key: ${mask(GEMINI_KEY)}`);
console.log(`   - OpenAI Key: ${mask(OPENAI_KEY)}`);
console.log(`   - DeepSeek Key: ${mask(DEEPSEEK_KEY)}`);

/**
 * ARQUITECTURA "CASCADE" PROBADA:
 * 1. Gemini Flash (Primario - Gratis/Barato)
 * 2. GPT-4o-mini (Fallback - Pago)
 * 3. DeepSeek / Otros (Opcional)
 * 4. Respuesta Estática (Salvaguarda)
 * 
 * VOZ: Siempre OpenAI TTS-1 si hay key disponible.
 */
async function generateResponse({ message, history = [], botConfig = {} }) {
    const botName = botConfig.bot_name || 'ALEX IO';
    const systemPrompt = botConfig.system_prompt || 'Eres ALEX IO, asistente virtual inteligente.';

    // 1. Check Cache
    const cacheKey = crypto.createHash('md5').update(`${botName}:${message}`).digest('hex');
    let cached = global.responseCache.get(cacheKey);

    if (cached) {
        console.log(`🎯 [${botName}] Cache hit`);
        // Regenerar audio si falta en el cache
        if (!cached.audioBuffer && openai && cached.text && cached.trace?.model !== 'safeguard') {
            try {
                const opusAudio = await openai.audio.speech.create({
                    model: 'tts-1',
                    voice: 'nova',
                    input: cached.text.slice(0, 4000),
                    response_format: 'opus'
                });
                cached.audioBuffer = Buffer.from(await opusAudio.arrayBuffer());
                cached.audioMime = 'audio/ogg; codecs=opus';
                global.responseCache.set(cacheKey, cached);
            } catch (err) {
                console.warn('⚠️ Error generando audio para cache:', err.message);
            }
        }
        return { ...cached, fromCache: true };
    }

    let responseText = '';
    let usedModel = '';

    // ═══════════════════════════════════════════════
    // 2. TEXTO — PRIORIDAD 1: GEMINI FLASH (GRATIS)
    // ═══════════════════════════════════════════════
    if (genAI) {
        const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
        for (const modelName of geminiModels) {
            try {
                console.log(`🚀 [${botName}] Consultando titular: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const chat = model.startChat({
                    history: history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text }] })),
                });
                const result = await chat.sendMessage([{ text: `${systemPrompt}\n\nUsuario: ${message}` }]);
                responseText = result.response.text();
                usedModel = modelName;
                break;
            } catch (err) {
                console.warn(`⚠️ Gemini ${modelName} falló:`, err.message);
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 3. TEXTO — PRIORIDAD 2: GPT-4o-mini (FALLBACK)
    // ═══════════════════════════════════════════════
    if (!responseText && openai) {
        try {
            console.log(`🚀 [${botName}] Activando Fallback: GPT-4o-mini...`);
            const gptRes = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                    { role: 'user', content: message }
                ],
                temperature: 0.7
            });
            responseText = gptRes.choices[0].message.content;
            usedModel = 'gpt-4o-mini';
        } catch (err) {
            console.warn('⚠️ OpenAI Fallback Error:', err.message);
        }
    }

    // 4. Fallback extra: DeepSeek
    if (!responseText && DEEPSEEK_KEY) {
        try {
            console.log(`🚀 [${botName}] Fallback extra: DeepSeek...`);
            const dsRes = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }]
            }, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 10000 });
            responseText = dsRes.data.choices[0].message.content;
            usedModel = 'deepseek-chat';
        } catch (err) {
            console.warn('⚠️ DeepSeek Fallback Error:', err.message);
        }
    }

    // 5. Salvaguarda Estática
    if (!responseText) {
        responseText = '¡Hola! Estoy experimentando una alta demanda. ¿Podrías repetirme eso en un momento?';
        usedModel = 'safeguard';
    }

    const result = {
        text: responseText,
        trace: { model: usedModel, timestamp: new Date().toISOString() }
    };

    // ═══════════════════════════════════════════════
    // 6. VOZ — SIEMPRE OpenAI TTS-1
    // ═══════════════════════════════════════════════
    if (openai && responseText && usedModel !== 'safeguard') {
        try {
            console.log(`🎙️ [${botName}] Generando audio PTT...`);
            const opusAudio = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: responseText.slice(0, 4000),
                response_format: 'opus'
            });
            result.audioBuffer = Buffer.from(await opusAudio.arrayBuffer());
            result.audioMime = 'audio/ogg; codecs=opus';
            console.log(`✅ Audio generado (${result.audioBuffer.length} bytes)`);
        } catch (err) {
            console.error('❌ Error TTS:', err.message);
        }
    }

    // Save to Cache
    global.responseCache.set(cacheKey, result);

    return result;
}

module.exports = { generateResponse };
