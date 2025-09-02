const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://hfijfwmcigiteubbysgo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmaWpmd21jaWdpdGV1YmJ5c2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzYxMDAsImV4cCI6MjA3MjQxMjEwMH0.cDDTHb883jAMFIGFvXRltmGpuNy0Dfxg_ARquAL7KWE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
