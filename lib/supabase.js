'use strict';

const { createClient } = require('@supabase/supabase-js');

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
    throw new Error(`Supabase config missing env: ${missing.join(', ')}`);
  }

  supabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

module.exports = { supabase: getSupabaseClient };