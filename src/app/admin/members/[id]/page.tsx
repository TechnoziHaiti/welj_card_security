import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserRole } from '@/lib/auth-helpers';
import { MemberDetailClient } from './MemberDetailClient';
import { Member, Card } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  let member: Member | null = null;
  let cards: Card[] = [];

  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    const [
      { data: memberData, error: memberError },
      { data: cardsData, error: cardsError },
    ] = await Promise.all([
      supabase.from('members').select('*').eq('id', id).single(),
      supabase.from('cards').select('*').eq('member_id', id).order('created_at', { ascending: false }),
    ]);

    if (memberError || !memberData) {
      return notFound();
    }

    member = memberData as Member;
    cards = (cardsData as Card[]) || [];
  } catch (err) {
    console.error('Erreur chargement membre:', err);
    return notFound();
  }

  const { isAdmin } = await getCurrentUserRole();

  return <MemberDetailClient initialMember={member} initialCards={cards} isAdmin={isAdmin} />;
}
