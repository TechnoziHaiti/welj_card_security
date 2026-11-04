import React from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CreditCard,
  ChevronRight,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateFr } from '@/lib/dates';
import { Member, Card } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    account_type?: string;
  }>;
}

export default async function MembersListPage({ searchParams }: PageProps) {
  const { q, status, account_type } = await searchParams;

  let members: (Member & { cards?: Card[] })[] = [];

  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    let query = supabase
      .from('members')
      .select('*, cards(*)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (account_type) {
      query = query.eq('account_type', account_type);
    }

    const { data, error } = await query;
    if (data && !error) {
      members = data as any;
    }
  } catch (err) {
    console.error('Erreur chargement membres:', err);
  }

  // Filtrage local pour la recherche plein texte (nom, prénom, code)
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    members = members.filter(
      (m) =>
        m.first_name.toLowerCase().includes(term) ||
        m.last_name.toLowerCase().includes(term) ||
        m.member_code.toLowerCase().includes(term)
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Gestion des Membres
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enregistrement, consultation et gestion du statut des membres Welj.
          </p>
        </div>

        <Link
          href="/admin/members/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <UserPlus size={15} />
          <span>Ajouter un Membre</span>
        </Link>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <form method="GET" className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q || ''}
              placeholder="Rechercher par nom, prénom ou code membre (ex: 20260001)..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter size={14} />
            <span>Filtres :</span>
          </div>

          <Link
            href="/admin/members"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !status && !account_type
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous
          </Link>
          <Link
            href="/admin/members?status=actif"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === 'actif'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Actifs
          </Link>
          <Link
            href="/admin/members?status=inactif"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === 'inactif'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Inactifs
          </Link>
        </div>
      </div>

      {/* Tableau des Membres */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {members.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Users size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Aucun membre trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {q ? 'Aucun membre ne correspond à votre recherche.' : 'Commencez par ajouter votre premier membre Welj.'}
            </p>
            <div className="mt-4">
              <Link
                href="/admin/members/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <UserPlus size={14} />
                <span>Nouveau Membre</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Code Membre</th>
                  <th className="py-3.5 px-4">Nom et Prénom</th>
                  <th className="py-3.5 px-4">Type de Compte</th>
                  <th className="py-3.5 px-4">Statut Membre</th>
                  <th className="py-3.5 px-4">Carte Associée</th>
                  <th className="py-3.5 px-4">Date d&apos;Adhésion</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {members.map((member) => {
                  const activeCard = member.cards?.find((c) => c.status === 'active');
                  const hasCards = member.cards && member.cards.length > 0;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        {member.member_code}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {member.last_name} {member.first_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {member.account_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={member.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        {activeCard ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
                            <CreditCard size={13} />
                            {activeCard.card_identifier}
                          </span>
                        ) : hasCards ? (
                          <span className="text-[11px] text-amber-600 font-medium">
                            Carte expirée / révoquée
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Aucune carte
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDateFr(member.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-semibold transition-colors text-[11px]"
                        >
                          <span>Gérer</span>
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
