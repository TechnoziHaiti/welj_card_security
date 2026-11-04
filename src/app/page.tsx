import { redirect } from 'next/navigation';

export default function HomePage() {
  // Ouvre directement sur l'onglet Scanner de cartes pour que les agents
  // puissent travailler immédiatement sans chercher dans les menus.
  redirect('/verify');
}
