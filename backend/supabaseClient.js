const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gegycwfuvdppjgwhovar.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZ3ljd2Z1dmRwcGpnd2hvdmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjcxMTIsImV4cCI6MjA3NTU0MzExMn0.HazDFT8MUZJph8j8sUxxiP2NYZvQaVaam1uH0y0Ieo0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };