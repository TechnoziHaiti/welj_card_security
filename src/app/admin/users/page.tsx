import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  let userList: any[] = [];
  let currentUserId = '';

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    currentUserId = user?.id || '';

    const adminClient = createAdminClient();
    const [
      { data: { users }, error: authErr },
      { data: profiles, error: profErr },
    ] = await Promise.all([
      adminClient.auth.admin.listUsers(),
      adminClient.from('profiles').select('*'),
    ]);

    if (!authErr && users) {
      userList = users.map((u) => {
        const prof = profiles?.find((p) => p.id === u.id);
        return {
          id: u.id,
          email: u.email,
          full_name: prof?.full_name || u.user_metadata?.full_name || 'Utilisateur Welj',
          role: prof?.role || u.user_metadata?.role || 'agent',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        };
      });
    }
  } catch (err) {
    console.error('Erreur chargement utilisateurs:', err);
  }

  return <UsersClient initialUsers={userList} currentUserId={currentUserId} />;
}
