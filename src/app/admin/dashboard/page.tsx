import React from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ArrowUpRight,
  UserPlus,
  ShieldCheck,
  History,
  QrCode,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateFr, formatDateTimeFr, isExpiringSoon } from '@/lib/dates';
import { Card, Member, VerificationLog } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
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
        const isExpired = new Date(c.expires_at) < now;
        if (c.status === 'revoquee') {
          revokedCards++;
        } else if (c.status === 'expiree' || isExpired) {
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
    console.error('Erreur chargement dashboard:', err);
  }

  const statCards = [
    {
      title: 'Total Membres',
      value: totalMembers,
      icon: Users,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      href: '/admin/members',
    },
    {
      title: 'Total Cartes',
      value: totalCards,
      icon: CreditCard,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      href: '/admin/cards',
    },
    {
      title: 'Cartes Actives',
      value: activeCards,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      href: '/admin/cards?status=active',
    },
    {
      title: 'Cartes Expirées',
      value: expiredCards,
      icon: Clock,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      href: '/admin/cards?status=expiree',
    },
    {
      title: 'Cartes Révoquées',
      value: revokedCards,
      icon: ShieldAlert,
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      href: '/admin/cards?status=revoquee',
    },
    {
      title: 'Expirant sous 30 j.',
      value: expiringSoonCards,
      icon: AlertTriangle,
      color: 'text-orange-700 bg-orange-50 border-orange-200',
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
          <p className="text-xs text-slate-500 mt-1">
            Supervision globale des adhésions, validité des cartes et sécurité Welj.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <UserPlus size={15} />
            <span>Nouveau Membre</span>
          </Link>

          <Link
            href="/verify"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors border border-slate-300 shadow-sm"
          >
            <QrCode size={15} className="text-emerald-700" />
            <span>Vérificateur QR</span>
          </Link>
        </div>
      </div>

      {/* Cartes Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl border ${stat.color}`}>
                  <Icon size={18} />
                </div>
                <ArrowUpRight
                  size={14}
                  className="text-slate-300 group-hover:text-emerald-700 transition-colors"
                />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">
                  {stat.value}
                </span>
                <span className="text-[11px] font-medium text-slate-500 block mt-1">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-700" />
              <h2 className="text-base font-bold text-slate-900">
                Dernières Cartes Émises
              </h2>
            </div>
            <Link
              href="/admin/cards"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              Voir toutes &rarr;
            </Link>
          </div>

          {recentCards.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucune carte enregistrée pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentCards.map((card) => (
                <div
                  key={card.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      {card.members ? `${card.members.first_name} ${card.members.last_name}` : 'Titulaire inconnu'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {card.card_identifier} &bull; Code {card.members?.member_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={card.status} size="sm" />
                    <span className="text-[11px] text-slate-400">
                      {formatDateFr(card.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dernières Opérations de Vérification */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-emerald-700" />
              <h2 className="text-base font-bold text-slate-900">
                Journal des Vérifications
              </h2>
            </div>
            <Link
              href="/admin/history"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              Tout l&apos;historique &rarr;
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucun scan enregistré pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {log.cards?.members
                        ? `${log.cards.members.first_name} ${log.cards.members.last_name}`
                        : 'Token Inconnu / Non indexé'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
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
