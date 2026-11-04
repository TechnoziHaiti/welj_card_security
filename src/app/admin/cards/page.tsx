import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CardsListClient } from './CardsListClient';
import { Card, Member } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    expiring?: string;
  }>;
}

export default async function CardsPage({ searchParams }: PageProps) {
  const { status, q, expiring } = await searchParams;

  let cards: (Card & { members?: Member })[] = [];

  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*, members(*)')
      .order('created_at', { ascending: false });

    if (data && !error) {
      cards = data as any;
    }
  } catch (err) {
    console.error('Erreur chargement cartes:', err);
  }

  const initialFilter = expiring === 'true' ? 'expiring' : status || 'all';

  return (
    <CardsListClient
      initialCards={cards}
      currentStatusFilter={initialFilter}
      searchQuery={q || ''}
    />
  );
}
