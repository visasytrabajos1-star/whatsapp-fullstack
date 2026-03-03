require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const alexBrain = require('../services/alexBrain');

describe('AlexBrain: Unified Cognitive Orchestrator', () => {
    const mockConfig = {
        bot_name: 'ALEX IO Test',
        system_prompt: 'Eres un bot de pruebas.'
    };

    const params = {
        message: 'Hola, ¿quién eres?',
        botConfig: mockConfig,
        isAudio: false
    };

    test('Testing Text Response basic logic', async () => {
        const result = await alexBrain.generateResponse(params);
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.trace).toBeDefined();
    }, 30000);

    test('Testing Fallback Logic (Simulating Gemini failure)', async () => {
        // We use a mock or environment variable manipulation if possible
        // For now, just ensure it returns something even if keys are missing
        const result = await alexBrain.generateResponse(params);
        expect(typeof result.text).toBe('string');
    }, 30000);
});
