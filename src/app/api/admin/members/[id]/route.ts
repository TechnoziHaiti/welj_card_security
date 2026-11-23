import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false, error: 'Non authentifié' };
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'admin') {
    return { authorized: false, error: 'Accès réservé aux administrateurs.' };
  }

  return { authorized: true, user, adminClient };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const { id: memberId } = await params;
    const adminClient = check.adminClient;

    if (!memberId) {
      return NextResponse.json({ error: 'ID du membre requis.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. Récupérer les informations du membre avant suppression
    const { data: member } = await adminClient
      .from('members')
      .select('first_name, last_name, client_code, member_code')
      .eq('id', memberId)
      .maybeSingle();

    const memberName = member ? `${member.last_name} ${member.first_name}`.trim() : 'Membre Supprimé';
    const clientCode = member?.client_code || member?.member_code || '';

    // 2. Récupérer toutes les cartes associées au membre
    const { data: memberCards } = await adminClient
      .from('cards')
      .select('id, card_identifier, qr_token_hash')
      .eq('member_id', memberId);

    // 3. Enregistrer l'invalidation définitive dans les logs de vérification (pour les futurs scans)
    const logEntries: Array<{
      card_id: null;
      result: 'revoquee';
      token_hash_lookup: string;
      user_agent: string;
    }> = [];

    if (memberCards && memberCards.length > 0) {
      for (const card of memberCards) {
        if (card.qr_token_hash) {
          logEntries.push({
            card_id: null,
            result: 'revoquee',
            token_hash_lookup: card.qr_token_hash,
            user_agent: `DELETED_MEMBER: ${memberName} | Card: ${card.card_identifier}`,
          });
        }
        if (card.card_identifier) {
          logEntries.push({
            card_id: null,
            result: 'revoquee',
            token_hash_lookup: card.card_identifier,
            user_agent: `DELETED_MEMBER: ${memberName} | Card: ${card.card_identifier}`,
          });
        }
      }
    }

    if (clientCode) {
      logEntries.push({
        card_id: null,
        result: 'revoquee',
        token_hash_lookup: clientCode,
        user_agent: `DELETED_MEMBER: ${memberName} | ClientCode: ${clientCode}`,
      });
    }

    if (logEntries.length > 0) {
      await adminClient.from('verification_logs').insert(logEntries);
    }

    // 4. Supprimer les références circulaires entre cartes puis supprimer les cartes
    await adminClient
      .from('cards')
      .update({ renewed_from_card_id: null })
      .eq('member_id', memberId);

    await adminClient
      .from('cards')
      .delete()
      .eq('member_id', memberId);

    // 5. Suppression définitive du membre dans la table members
    const { error: deleteMemberErr } = await adminClient
      .from('members')
      .delete()
      .eq('id', memberId);

    if (deleteMemberErr) {
      console.error('Erreur suppression membre:', deleteMemberErr);
      throw new Error(`Erreur suppression membre: ${deleteMemberErr.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Membre supprimé avec succès. Toutes ses cartes ont été révoquées et invalidées.',
    });
  } catch (err: any) {
    console.error('Erreur API suppression membre:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
