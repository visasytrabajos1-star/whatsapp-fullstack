-- ========================================================
-- PRODUCTION SETUP FOR ALEX IO SAAS CORE
-- Execute this in your Supabase SQL Editor
-- ========================================================

-- 1. WHATSAPP SESSIONS (Internal Persistence)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL, -- Corresponds to instanceId
    key_type TEXT NOT NULL,   -- e.g., 'creds', 'app-state-sync-key'
    key_id TEXT NOT NULL,     -- e.g., 'base', 'uuid'
    value TEXT NOT NULL,      -- JSON stringified session data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, key_type, key_id)
);

-- Index for session hydration
CREATE INDEX IF NOT EXISTS idx_wa_sessions_lookup ON public.whatsapp_sessions(session_id);

-- 2. MESSAGES (Audit Log and Live Chat)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    customer_phone TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    ai_model TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tenant-based history retrieval
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON public.messages(customer_phone);

-- 3. SECURITY: Row Level Security (RLS)
-- Prevent one tenant from seeing another tenant's messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- If you are using standard auth, you can restrict by tenant_id
-- For backend-only access, the 'service_role' bypasses this.
CREATE POLICY "Tenants can only see their own messages"
    ON public.messages
    FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenantId')); -- This matches our JWT structure

-- 4. USAGE METRICS (Billing/Quotas)
CREATE TABLE IF NOT EXISTS public.tenant_usage_metrics (
    tenant_id TEXT PRIMARY KEY,
    messages_sent INTEGER DEFAULT 0,
    plan_limit INTEGER DEFAULT 500,
    tokens_consumed BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SAAS INSTANCES (High Level Bot Registry)
CREATE TABLE IF NOT EXISTS public.saas_instances (
    instance_id TEXT PRIMARY KEY,
    tenant_id TEXT,
    name TEXT,
    status TEXT,
    qr_code TEXT,
    owner_email TEXT,
    owner_lang TEXT DEFAULT 'es',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. USAGE LOGS (Granular Audit Trail)
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    feature TEXT DEFAULT 'chat',
    input_text TEXT,
    translated_text TEXT,
    from_lang TEXT,
    to_lang TEXT,
    provider_stt TEXT,
    provider_llm TEXT,
    provider_tts TEXT,
    latency_ms INTEGER,
    cost_estimated DECIMAL(12, 6),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    is_cache_hit BOOLEAN DEFAULT false,
    is_challenger BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON public.usage_logs(user_id);

-- Function to increment usage safely
CREATE OR REPLACE FUNCTION increment_tenant_usage(t_id TEXT, msg_incr INTEGER, tk_incr INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.tenant_usage_metrics (tenant_id, messages_sent, tokens_consumed, updated_at)
    VALUES (t_id, msg_incr, tk_incr, NOW())
    ON CONFLICT (tenant_id) DO UPDATE
    SET messages_sent = public.tenant_usage_metrics.messages_sent + msg_incr,
        tokens_consumed = public.tenant_usage_metrics.tokens_consumed + tk_incr,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
