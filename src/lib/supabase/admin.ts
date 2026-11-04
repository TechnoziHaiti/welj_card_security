import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec privilèges administrateur (Service Role).
 * STRICTEMENT SERVEUR : Ne jamais importer dans un composant client ("use client").
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
