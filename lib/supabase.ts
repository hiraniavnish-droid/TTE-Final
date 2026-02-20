
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzlmeodpvnrmlxgmykro.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bG1lb2Rwdm5ybWx4Z215a3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTk4MTIsImV4cCI6MjA4NTE3NTgxMn0.gV6B8uL-X84buHDDm0KVtfuOaSsI6Ul6jxMXFWThj9U';

export const supabase = createClient(supabaseUrl, supabaseKey);
