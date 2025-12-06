// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL nav iestatīts .env.local failā');
}

if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY nav iestatīts .env.local failā');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
