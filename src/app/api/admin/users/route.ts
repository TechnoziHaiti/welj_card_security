import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Vérification stricte des permissions admin
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
    .single();

  const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'admin') {
    return { authorized: false, error: 'Accès interdit. Rôle administrateur requis.' };
  }

  return { authorized: true, user, adminClient };
}

// 1. LISTER LES UTILISATEURS
export async function GET() {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const { data: { users }, error: authErr } = await check.adminClient.auth.admin.listUsers();
    if (authErr) throw authErr;

    const { data: profiles, error: profErr } = await check.adminClient
      .from('profiles')
      .select('*');

    if (profErr) throw profErr;

    // Fusion des informations Auth et Profiles
    const userList = (users || []).map((u) => {
      const prof = profiles?.find((p) => p.id === u.id);
      return {
        id: u.id,
        email: u.email,
        full_name: prof?.full_name || u.user_metadata?.full_name || 'Sans nom',
        role: prof?.role || u.app_metadata?.role || u.user_metadata?.role || 'agent',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    return NextResponse.json({ users: userList });
  } catch (err: any) {
    console.error('Erreur liste utilisateurs:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// 2. CRÉER UN NOUVEL ACCÈS UTILISATEUR
export async function POST(request: Request) {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom complet sont obligatoires.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit comporter au minimum 6 caractères.' },
        { status: 400 }
      );
    }

    const assignedRole: 'admin' | 'agent' = role === 'admin' ? 'admin' : 'agent';

    // Création du compte dans Supabase Auth avec user_metadata ET app_metadata
    const { data: authData, error: createErr } = await check.adminClient.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role: assignedRole,
      },
      app_metadata: {
        role: assignedRole,
      },
    });

    if (createErr || !authData.user) {
      throw new Error(createErr?.message || 'Erreur lors de la création Auth');
    }

    // Synchronisation atomique dans la table public.profiles
    await check.adminClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: full_name.trim(),
        role: assignedRole,
      });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name.trim(),
        role: assignedRole,
        created_at: authData.user.created_at,
      },
    });
  } catch (err: any) {
    console.error('Erreur création utilisateur:', err);
    return NextResponse.json({ error: err.message || 'Erreur création' }, { status: 500 });
  }
}

// 3. METTRE À JOUR LE RÔLE D'UN UTILISATEUR (PATCH)
export async function PATCH(request: Request) {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, role } = body;

    if (!id || !role || !['admin', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'ID et rôle valide (admin ou agent) requis.' },
        { status: 400 }
      );
    }

    // Protection : L'admin connecté ne peut pas retirer ses propres droits admin
    if (id === check.user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas retirer vos propres droits administrateur.' },
        { status: 400 }
      );
    }

    // 1. Mise à jour de la table profiles
    await check.adminClient
      .from('profiles')
      .update({ role })
      .eq('id', id);

    // 2. Mise à jour des métadonnées auth
    await check.adminClient.auth.admin.updateUserById(id, {
      user_metadata: { role },
      app_metadata: { role },
    });

    return NextResponse.json({ success: true, id, role });
  } catch (err: any) {
    console.error('Erreur mise à jour rôle:', err);
    return NextResponse.json({ error: err.message || 'Erreur mise à jour rôle' }, { status: 500 });
  }
}

// 4. SUPPRIMER UN UTILISATEUR
export async function DELETE(request: Request) {
  const check = await verifyAdmin();
  if (!check.authorized || !check.adminClient) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    // Protection contre l'auto-suppression
    if (userId === check.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' },
        { status: 400 }
      );
    }

    // 1. Suppression du profil
    await check.adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    // 2. Suppression dans Supabase Auth
    const { error: deleteErr } = await check.adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      throw deleteErr;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erreur suppression utilisateur:', err);
    return NextResponse.json({ error: err.message || 'Erreur suppression' }, { status: 500 });
  }
}
