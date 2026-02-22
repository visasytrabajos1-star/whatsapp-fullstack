const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// --- CONFIGURATION ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const CACHE_TTL = 3600;

// Load Constitution
const CONSTITUTION_PATH = path.resolve(__dirname, '../CONSTITUCION_ALEXANDRA.md');
let BASE_CONSTITUTION = '';
try {
    BASE_CONSTITUTION = fs.readFileSync(CONSTITUTION_PATH, 'utf8');
} catch (e) {
    console.warn('⚠️ Constitution file not found. Using default.');
}

// Cache Key Generator
const getCacheKey = (message, botId) =>
    crypto.createHash('md5').update(`${botId}:${message}`).digest('hex');

class AlexBrain {
    constructor() {
        this.geminiKey = GEMINI_KEY;
        this.openaiKey = OPENAI_KEY;
        this.deepseekKey = DEEPSEEK_KEY;
    }

    async generateResponse(params) {
        const { message, history = [], botConfig = {}, imageBase64 = null } = params;

        // 1. CHECK CACHE (Solo para mensajes de texto, no para imágenes)
        if (!imageBase64) {
            const cacheKey = getCacheKey(message, botConfig.id || 'default');
            const cached = global.responseCache?.get(cacheKey);
            if (cached) {
                console.log('⚡ [CACHE HIT]');
                return { ...cached, fromCache: true };
            }
        }

        const startTime = Date.now();
        let responseText = null;
        let usedModel = 'none';
        let tier = 'FREE';

        const fullPrompt = this._buildPrompt(botConfig);

        // 2. FALLBACK CHAIN
        try {
            // Primary: Gemini Flash (Soporta texto e imágenes)
            responseText = await this._tryGemini(message, history, fullPrompt, imageBase64);
            if (responseText) usedModel = 'gemini-1.5-flash';
        } catch (e) {
            console.warn('⚠️ Gemini failed:', e.message);
            
            // Si es error de imagen y no hay mensaje de texto, usar safeguard directamente
            if (imageBase64 && !message) {
                responseText = 'Entiendo que me enviaste una imagen. Lamentablemente, en este momento mi capacidad de analizar imágenes está limitada. ¿Podrías describirme con palabras lo que necesitas? Así podré ayudarte mejor.';
                usedModel = 'safeguard';
            }
        }

        // Fallback 1: DeepSeek (Solo texto)
        if (!responseText && this.deepseekKey && !imageBase64) {
            try {
                responseText = await this._tryDeepSeek(message, history, fullPrompt);
                if (responseText) {
                    usedModel = 'deepseek-chat';
                    tier = 'LOW COST';
                }
            } catch (e) {
                console.warn('⚠️ DeepSeek failed:', e.message);
            }
        }

        // Fallback 2: OpenAI Mini (Solo texto)
        if (!responseText && this.openaiKey && !imageBase64) {
            try {
                responseText = await this._tryOpenAI(message, history, fullPrompt);
                if (responseText) {
                    usedModel = 'gpt-4o-mini';
                    tier = 'PAID';
                }
            } catch (e) {
                console.error('❌ All AI providers failed!');
            }
        }

        // Final Safeguard
        if (!responseText) {
            responseText = 'Entiendo que me enviaste una imagen. Lamentablemente, en este momento mi capacidad de analizar imágenes está limitada. ¿Podrías describirme con palabras lo que necesitas? Así podré ayudarte mejor.';
            usedModel = 'safeguard';
        }

        const result = {
            text: responseText,
            trace: {
                model: usedModel,
                tier,
                responseTime: Date.now() - startTime,
                fromCache: false,
                hasImage: !!imageBase64
            }
        };

        // SAVE TO CACHE
        if (!imageBase64 && responseText) {
            try {
                const cacheKey = getCacheKey(message, botConfig.id || 'default');
                global.responseCache?.set(cacheKey, result, CACHE_TTL);
            } catch (e) {
                /* ignore cache errors */
            }
        }

        return result;
    }

    _buildPrompt(config) {
        // Constitución Universal mejorada
        let prompt = `
Eres ALEX IO, un asistente virtual inteligente, profesional y amable.
Tu objetivo es ayudar al usuario de manera eficiente, clara y concisa.

REGLAS UNIVERSALES:
1. Siempre responde de forma profesional y amable.
2. Si no entiendes algo, pide clarificación.
3. No des información falsa.
4. Mantén tus respuestas cortas y directas (máximo 3 oraciones si es posible).
5. Si el usuario pregunta sobre precios, horarios o servicios, proporciona la información disponible.

PERSONALIDAD:
- Nombre: Alex
- Tono: Amigable pero profesional
- Idioma: Español (por defecto, pero puedes cambiar según el usuario)

${BASE_CONSTITUTION ? `\nCONSTITUCIÓN BASE:\n${BASE_CONSTITUTION}` : ''}
${config.constitution ? `\nREGLAS ESPECÍFICAS DEL NEGOCIO:\n${config.constitution}` : ''}
${config.system_prompt ? `\nINSTRUCCIONES DEL NEGOCIO:\n${config.system_prompt}` : ''}

Responderás siempre como "Alex de ALEX IO" si no se te indica otro nombre.
`;
        return prompt;
    }

    async _tryGemini(message, history, systemPrompt, imageBase64 = null) {
        if (!this.geminiKey) return null;

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;

        const contents = history.slice(-6).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content || h.text }]
        }));

        // Preparar contenido del mensaje actual
        const parts = [];

        // Si hay imagen, añadirla
        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64
                }
            });
        }

        // Añadir texto del mensaje
        if (message) {
            parts.push({ text: message });
        }

        contents.push({ role: 'user', parts });

        const payload = {
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        };

        try {
            const res = await axios.post(url, payload, { timeout: 15000 });
            return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            // Si es error de imagen, devolver null para usar fallback
            if (e.response?.data?.error?.message?.includes('image') || e.message?.includes('image')) {
                console.warn('⚠️ Gemini does not support images');
                return null;
            }
            throw e;
        }
    }

    async _tryDeepSeek(message, history, systemPrompt) {
        if (!this.deepseekKey) return null;

        const res = await axios.post(
            'https://api.deepseek.com/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6),
                    { role: 'user', content: message }
                ]
            },
            { headers: { Authorization: `Bearer ${this.deepseekKey}` }, timeout: 8000 }
        );

        return res.data.choices[0].message.content;
    }

    async _tryOpenAI(message, history, systemPrompt) {
        if (!this.openaiKey) return null;

        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6),
                    { role: 'user', content: message }
                ]
            },
            { headers: { Authorization: `Bearer ${this.openaiKey}` }, timeout: 10000 }
        );

        return res.data.choices[0].message.content;
    }
}

// Initialize Global Cache
const NodeCache = require('node-cache');
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 1800, checkperiod: 300 });

module.exports = new AlexBrain();
