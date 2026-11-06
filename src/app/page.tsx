import { redirect } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/auth-helpers';

export default async function HomePage() {
  const { user, role } = await getCurrentUserRole();

  if (!user) {
    redirect('/login');
  }

  // Règle métier :
  // - Administrateur -> Tableau de bord (/admin/dashboard)
  // - Agent de Contrôle -> Scanner de cartes (/verify)
  if (role === 'admin') {
    redirect('/admin/dashboard');
  } else {
    redirect('/verify');
  }
}
