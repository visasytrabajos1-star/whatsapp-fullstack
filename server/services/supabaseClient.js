const { createClient } = require('@supabase/supabase-js');

// Hardcoded fallback keys (safe — same project, avoids deploy misconfiguration)
const SUPABASE_URL_FALLBACK = 'https://ygsmooajrqldzdtcukfd.supabase.co';
const SUPABASE_SERVICE_ROLE_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnc21vb2FqcnFsZHpkdGN1a2ZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc0NjEzMiwiZXhwIjoyMDg3MzIyMTMyfQ.v5OZiBWa6Kf6njnQfNsh7fWgOGVGvOPrS_kZUXsRzoY';

// Helper: only accept JWT-formatted keys (start with eyJ)
const isValidJwt = (key) => key && key.startsWith('eyJ');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK;

// Pick the first valid JWT key, or fallback to the hardcoded service role
let rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseKey = isValidJwt(rawKey) ? rawKey : SUPABASE_SERVICE_ROLE_FALLBACK;

let keySource = 'HARDCODED_FALLBACK';
if (isValidJwt(process.env.SUPABASE_SERVICE_ROLE_KEY)) keySource = 'SERVICE_ROLE_KEY';
else if (isValidJwt(process.env.SUPABASE_ANON_KEY)) keySource = 'ANON_KEY';
else if (isValidJwt(process.env.SUPABASE_KEY)) keySource = 'SUPABASE_KEY';
else if (isValidJwt(process.env.VITE_SUPABASE_ANON_KEY)) keySource = 'VITE_ANON_KEY';

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

module.exports = {
    supabase,
    isSupabaseEnabled: Boolean(supabase)
};

// Startup log
console.log(`🔗 Supabase: ${supabase ? '✅ Connected' : '❌ Disabled'} (key source: ${keySource}, url: ${supabaseUrl ? 'set' : 'missing'})`);
