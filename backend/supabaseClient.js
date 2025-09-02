const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
