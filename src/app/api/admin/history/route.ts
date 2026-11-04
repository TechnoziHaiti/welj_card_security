import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const adminClient = createAdminClient();
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin' && user.user_metadata?.role !== 'admin') {
        return { authorized: false, error: 'Accès interdit. Rôle administrateur requis.' };
      }
      return { authorized: true, user, adminClient };
    }

    // Si pas de session active trouvée via cookies
    if (process.env.NODE_ENV === 'production') {
      return { authorized: false, error: 'Session non authentifiée' };
    }

    // En environnement local de développement
    return { authorized: true, user: null, adminClient };
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      return { authorized: true, user: null, adminClient };
    }
    return { authorized: false, error: err.message || 'Erreur d\'autorisation' };
  }
}

// SUPPRIMER UN LOG OU VIDER L'HISTORIQUE DE VÉRIFICATION
export async function DELETE(request: Request) {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('id');
    const clearAll = searchParams.get('all') === 'true';

    // 1. Suppression de tout l'historique
    if (clearAll) {
      const { error: delAllErr } = await check.adminClient
        .from('verification_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (delAllErr) throw delAllErr;
      return NextResponse.json({ success: true, message: 'Tout l\'historique a été vidé avec succès.' });
    }

    // 2. Suppression d'un enregistrement spécifique
    if (!logId) {
      return NextResponse.json({ error: 'ID du log de vérification requis' }, { status: 400 });
    }

    const { error: delErr } = await check.adminClient
      .from('verification_logs')
      .delete()
      .eq('id', logId);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true, message: 'Enregistrement supprimé avec succès.' });
  } catch (err: any) {
    console.error('Erreur suppression historique vérifications:', err);
    return NextResponse.json({ error: err.message || 'Erreur lors de la suppression' }, { status: 500 });
  }
}
