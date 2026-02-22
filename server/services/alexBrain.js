const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');

// --- CONFIGURATION ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const CACHE_TTL = 3600; // 1 hour

// Load Constitution
const CONSTITUTION_PATH = path.resolve(__dirname, '../../CONSTITUCION_ALEXANDRA.md');
let BASE_CONSTITUTION = "";
try {
    BASE_CONSTITUTION = fs.readFileSync(CONSTITUTION_PATH, 'utf8');
} catch (e) {
    console.warn("⚠️ Constitution file not found. Using default.");
    BASE_CONSTITUTION = "Eres ALEX IO, un asistente virtual inteligente.";
}

// Supabase Setup
let supabase = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
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
        const {
            message,
            history = [],
            botConfig = {},
            conversationId,
            messageType = 'text',
            imageBase64 = null
        } = params;

        // 1. CHECK CACHE (SaaS Efficiency)
        if (!imageBase64 && message) {
            const cacheKey = getCacheKey(message, botConfig.id || 'default');
            const cached = global.responseCache?.get(cacheKey);
            if (cached) {
                console.log('⚡ [CACHE HIT]');
                return { ...cached, fromCache: true };
            }
        }

        const startTime = Date.now();
        let responseText = null;
        let usedModel = "none";
        let tier = "FREE";
        let tokensUsed = 0;

        const fullPrompt = this._buildPrompt(botConfig);

        // 2. FALLBACK CHAIN (Gemini -> DeepSeek -> OpenAI)

        // --- GEMINI FLASH (PRIMARY/FREE) ---
        try {
            const geminiResult = await this._tryGemini(message, history, fullPrompt, imageBase64);
            if (geminiResult) {
                responseText = geminiResult;
                usedModel = "gemini-1.5-flash";
            }
        } catch (e) {
            console.warn("⚠️ Gemini failed, trying fallbacks...");
        }

        // --- DEEPSEEK (SECONDARY/LOW COST) ---
        if (!responseText && this.deepseekKey && !imageBase64) {
            try {
                const dsResult = await this._tryDeepSeek(message, history, fullPrompt);
                if (dsResult) {
                    responseText = dsResult;
                    usedModel = "deepseek-chat";
                    tier = "LOW COST";
                }
            } catch (e) {
                console.warn("⚠️ DeepSeek failed...");
            }
        }

        // --- OPENAI (TERTIARY/PAID) ---
        if (!responseText && this.openaiKey && !imageBase64) {
            try {
                const openaiResult = await this._tryOpenAI(message, history, fullPrompt);
                if (openaiResult) {
                    responseText = openaiResult.text;
                    usedModel = "gpt-4o-mini";
                    tier = "PAID";
                    tokensUsed = openaiResult.tokens;
                }
            } catch (e) {
                console.error("❌ OpenAI failed...");
            }
        }

        // Final Safeguard
        if (!responseText) {
            responseText = "Entiendo. Estoy procesando tu consulta con mis módulos de respaldo. Por favor, intenta de nuevo en un momento.";
            usedModel = "safeguard";
        }

        const responseTime = Date.now() - startTime;
        const result = {
            text: responseText,
            trace: {
                model: usedModel,
                tier,
                responseTime,
                fromCache: false,
                tokens: tokensUsed,
                hasImage: !!imageBase64
            }
        };

        // 3. SAVE TO CACHE
        if (!imageBase64 && responseText && usedModel !== "safeguard") {
            const cacheKey = getCacheKey(message, botConfig.id || 'default');
            global.responseCache?.set(cacheKey, result, CACHE_TTL);
        }

        // 4. LOG TO DATABASE
        if (conversationId && supabase) {
            await this._logToDatabase(conversationId, responseText, result.trace, messageType);
        }

        return result;
    }

    _buildPrompt(config) {
        let prompt = `Eres ALEX IO, un asesor inteligente y profesional.\n`;
        prompt += `${BASE_CONSTITUTION}\n\n`;

        if (config.constitution) prompt += `📜 LEYES CLIENTE: ${config.constitution}\n`;
        if (config.system_prompt) prompt += `👤 PERSONA: ${config.system_prompt}\n`;
        if (config.id === 'alex_migration') prompt += `\n${MIGRATION_SYSTEM_PROMPT_V1}\n`;

        prompt += `\nResponde siempre de forma amable pero profesional. Máximo 3 oraciones sugeridas.`;
        return prompt;
    }

    async _tryGemini(message, history, systemPrompt, imageBase64 = null) {
        if (!this.geminiKey) return null;
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;

        const contents = history.slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(h.content || h.text || "") }]
        }));

        const parts = [];
        if (imageBase64) parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
        if (message) parts.push({ text: message });

        contents.push({ role: "user", parts });

        const payload = {
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        };

        const res = await axios.post(url, payload, { timeout: 12000 });
        return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    async _tryDeepSeek(message, history, systemPrompt) {
        if (!this.deepseekKey) return null;
        const res = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                { role: "user", content: message }
            ]
        }, { headers: { 'Authorization': `Bearer ${this.deepseekKey}` }, timeout: 10000 });
        return res.data.choices[0].message.content;
    }

    async _tryOpenAI(message, history, systemPrompt) {
        if (!this.openaiKey) return null;
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                { role: "user", content: message }
            ]
        }, { headers: { 'Authorization': `Bearer ${this.openaiKey}` }, timeout: 12000 });
        return {
            text: res.data.choices[0].message.content,
            tokens: res.data.usage?.total_tokens || 0
        };
    }

    async _logToDatabase(conversationId, text, trace, messageType) {
        try {
            await supabase.from('messages').insert({
                conversation_id: conversationId,
                direction: 'outbound',
                content: text,
                message_type: messageType,
                is_ai_generated: true,
                ai_model: trace.model,
                ai_tokens_used: trace.tokens,
                processing_time_ms: trace.responseTime,
                status: 'sent'
            });
        } catch (err) {
            console.error("❌ DB Log Fail:", err.message);
        }
    }
}

module.exports = new AlexBrain();
