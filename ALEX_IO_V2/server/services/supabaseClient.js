const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('⚠️ Supabase credentials missing. Persistence disabled.');
}

const supabaseService = {
    client: supabase,

    async getStatus(instanceId) {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('saas_instances')
                .select('*')
                .eq('instance_id', instanceId)
                .single();
            if (error) return null;
            return data;
        } catch (e) {
            console.error('Error fetching status from Supabase:', e.message);
            return null;
        }
    },

    async upsertStatus(instanceId, companyName, status, qrCode = null) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('saas_instances')
                .upsert({
                    instance_id: instanceId,
                    company_name: companyName,
                    status: status,
                    qr_code: qrCode,
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
        } catch (e) {
            console.error('Error upserting status to Supabase:', e.message);
        }
    },

    async deleteSession(instanceId) {
        if (!supabase) return;
        try {
            await supabase
                .from('saas_instances')
                .delete()
                .eq('instance_id', instanceId);
        } catch (e) {
            console.error('Error deleting status from Supabase:', e.message);
        }
    }
};

module.exports = supabaseService;
