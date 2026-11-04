import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HistoryClient } from './HistoryClient';
import { VerificationLog } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  let logs: VerificationLog[] = [];

  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    const { data, error } = await supabase
      .from('verification_logs')
      .select('*, cards(*, members(*))')
      .order('verified_at', { ascending: false })
      .limit(100);

    if (data && !error) {
      logs = data as any;
    }
  } catch (err) {
    console.error('Erreur chargement logs de vérification:', err);
  }

  return <HistoryClient initialLogs={logs} />;
}
