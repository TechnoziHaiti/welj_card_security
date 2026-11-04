import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface UserRoleInfo {
  user: any | null;
  role: 'admin' | 'agent';
  isAdmin: boolean;
  isAgent: boolean;
  profile: {
    id: string;
    full_name: string;
    role: 'admin' | 'agent';
  } | null;
}

export async function getCurrentUserRole(): Promise<UserRoleInfo> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        user: null,
        role: 'agent',
        isAdmin: false,
        isAgent: true,
        profile: null,
      };
    }

    let profile: any = null;
    try {
      const adminClient = createAdminClient();
      const { data } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      profile = data;
    } catch {
      // Fallback
    }

    // Priorité de résolution du rôle :
    // 1. Table profiles (source de vérité PostgreSQL)
    // 2. app_metadata (sécurisé Supabase Auth)
    // 3. user_metadata
    // Valeur par défaut de sécurité : 'agent' (JAMAIS 'admin' par défaut !)
    const rawRole = profile?.role || user.app_metadata?.role || user.user_metadata?.role;
    const role: 'admin' | 'agent' = rawRole === 'admin' ? 'admin' : 'agent';

    return {
      user,
      role,
      isAdmin: role === 'admin',
      isAgent: role === 'agent',
      profile: profile || {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || 'Utilisateur',
        role,
      },
    };
  } catch {
    return {
      user: null,
      role: 'agent',
      isAdmin: false,
      isAgent: true,
      profile: null,
    };
  }
}
