import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://hfijfwmcigiteubbysgo.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmaWpmd21jaWdpdGV1YmJ5c2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzYxMDAsImV4cCI6MjA3MjQxMjEwMH0.cDDTHb883jAMFIGFvXRltmGpuNy0Dfxg_ARquAL7KWE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
