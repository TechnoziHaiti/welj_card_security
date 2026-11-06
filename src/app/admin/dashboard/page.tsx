import React from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  QrCode,
  History,
  AlertTriangle,
  UserPlus,
  ArrowUpRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserRole } from '@/lib/auth-helpers';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateFr, formatDateTimeFr, isExpiringSoon, getEffectiveCardStatus } from '@/lib/dates';
import { Card, Member, VerificationLog } from '@/types/database';

export const dynamic = 'force-dynamic';

function SolidUsersIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="currentColor" />
      <circle cx="9" cy="7" r="4" fill="currentColor" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function SolidCreditCardIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" />
      <rect x="2" y="8.5" width="20" height="2.5" fill="#ffffff" />
      <rect x="5" y="14" width="4" height="2" rx="0.5" fill="#ffffff" />
    </svg>
  );
}

function SolidCheckCircleIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <polyline points="8.5 12 11 14.5 16 9.5" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SolidClockIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <polyline points="12 6.5 12 12 15.5 14" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SolidShieldAlertIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="currentColor" />
      <line x1="12" y1="8" x2="12" y2="12.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.3" fill="#ffffff" />
    </svg>
  );
}

function SolidAlertTriangleIcon({ size = 22, className = 'text-slate-800' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" fill="currentColor" />
      <line x1="12" y1="9" x2="12" y2="13.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.3" fill="#ffffff" />
    </svg>
  );
}

export default async function AdminDashboardPage() {
  const { isAdmin } = await getCurrentUserRole();
  let totalMembers = 0;
  let totalCards = 0;
  let activeCards = 0;
  let expiredCards = 0;
  let revokedCards = 0;
  let expiringSoonCards = 0;
  let recentLogs: VerificationLog[] = [];
  let recentCards: (Card & { members?: Member })[] = [];

  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    // Récupération des statistiques
    const [
      { count: membersCount },
      { data: allCards },
      { data: logsData },
    ] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*, members(*)').order('created_at', { ascending: false }),
      supabase.from('verification_logs').select('*, cards(*, members(*))').order('verified_at', { ascending: false }).limit(6),
    ]);

    totalMembers = membersCount || 0;

    if (allCards) {
      totalCards = allCards.length;
      recentCards = allCards.slice(0, 5) as any;

      const now = new Date();
      allCards.forEach((c) => {
        if (c.status === 'revoquee') {
          revokedCards++;
        } else if (c.status === 'expiree' || new Date(c.expires_at) < now) {
          expiredCards++;
        } else if (c.status === 'active') {
          activeCards++;
          if (isExpiringSoon(c.expires_at, 30)) {
            expiringSoonCards++;
          }
        }
      });
    }

    if (logsData) {
      recentLogs = logsData as any;
    }
  } catch (err) {
    console.error('Erreur chargement statistiques dashboard:', err);
  }

  const statCards = [
    {
      title: 'Total Membres',
      value: totalMembers,
      icon: SolidUsersIcon,
      href: '/admin/members',
    },
    {
      title: 'Total Cartes',
      value: totalCards,
      icon: SolidCreditCardIcon,
      href: '/admin/cards',
    },
    {
      title: 'Cartes Actives',
      value: activeCards,
      icon: SolidCheckCircleIcon,
      href: '/admin/cards?status=active',
    },
    {
      title: 'Cartes Expirées',
      value: expiredCards,
      icon: SolidClockIcon,
      href: '/admin/cards?status=expiree',
    },
    {
      title: 'Cartes Révoquées',
      value: revokedCards,
      icon: SolidShieldAlertIcon,
      href: '/admin/cards?status=revoquee',
    },
    {
      title: 'Expirant sous 30 j.',
      value: expiringSoonCards,
      icon: SolidAlertTriangleIcon,
      href: '/admin/cards?expiring=true',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header avec Actions Rapides */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Supervision globale des adhésions, validité des cartes et sécurité Welj.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin/members/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-xs transition-colors shadow-sm"
            >
              <UserPlus size={15} />
              <span>Nouveau Membre</span>
            </Link>
          )}

          <Link
            href="/verify"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-slate-800 font-semibold text-xs transition-colors border border-stone-300 shadow-sm"
          >
            <QrCode size={15} className="text-emerald-600" />
            <span>Vérificateur QR</span>
          </Link>
        </div>
      </div>

      {/* Cartes Statistiques sur fond blanc et bordure douce */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="bg-white p-4 rounded-2xl border border-stone-300/80 shadow-sm hover:shadow-md hover:border-stone-400 transition-all group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={22} className="text-slate-800" />
                <ArrowUpRight
                  size={14}
                  className="text-stone-400 group-hover:text-emerald-600 transition-colors"
                />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">
                  {stat.value}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 block mt-1">
                  {stat.title}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Grid: Dernières Cartes et Dernières Vérifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dernières Cartes Émises */}
        <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Dernières Cartes Émises
              </h2>
            </div>
            <Link
              href="/admin/cards"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Voir toutes &rarr;
            </Link>
          </div>

          {recentCards.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Aucune carte enregistrée pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {recentCards.map((card) => (
                <div
                  key={card.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {card.members ? `${card.members.first_name} ${card.members.last_name}` : 'Titulaire inconnu'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {card.card_identifier} &bull; Compte {card.members?.account_type || 'Standard'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={getEffectiveCardStatus(card)} size="sm" />
                    <span className="text-[11px] text-slate-500">
                      {formatDateFr(card.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dernières Opérations de Vérification */}
        <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Journal des Vérifications
              </h2>
            </div>
            <Link
              href="/admin/history"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Tout l&apos;historique &rarr;
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Aucun scan enregistré pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate flex items-center gap-2">
                      <span>
                        {log.cards?.members
                          ? `${log.cards.members.first_name} ${log.cards.members.last_name}`
                          : 'Token Inconnu / Non indexé'}
                      </span>
                      {log.cards?.members?.account_type && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-slate-700 border border-stone-200">
                          {log.cards.members.account_type}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {formatDateTimeFr(log.verified_at)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={log.result} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
