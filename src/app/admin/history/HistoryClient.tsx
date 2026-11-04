'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  Calendar,
  Globe,
  Cpu,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTimeFr } from '@/lib/dates';
import { VerificationLog, VerificationResultType } from '@/types/database';

interface Props {
  initialLogs: VerificationLog[];
}

export function HistoryClient({ initialLogs }: Props) {
  const [logs] = useState(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    if (resultFilter !== 'all' && log.result !== resultFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const cardRef = log.cards?.card_identifier?.toLowerCase() || '';
      const memberName = log.cards?.members
        ? `${log.cards.members.first_name} ${log.cards.members.last_name}`.toLowerCase()
        : '';
      const memberCode = log.cards?.members?.member_code?.toLowerCase() || '';
      const hashLookup = log.token_hash_lookup?.toLowerCase() || '';

      return (
        cardRef.includes(q) ||
        memberName.includes(q) ||
        memberCode.includes(q) ||
        hashLookup.includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Journal des Vérifications de Sécurité
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Historique auditable de tous les scans effectués via le vérificateur public ou l&apos;application mobile.
        </p>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par carte, membre, code membre ou hash de scan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
            <Filter size={13} />
            <span>Résultat :</span>
          </div>

          {[
            { id: 'all', label: 'Tous les scans' },
            { id: 'valide', label: 'Authentiques' },
            { id: 'expiree', label: 'Expirées' },
            { id: 'revoquee', label: 'Révoquées' },
            { id: 'inconnue', label: 'Non reconnues' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setResultFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                resultFilter === tab.id
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <History size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">Aucun enregistrement d&apos;audit</p>
            <p className="text-[11px] mt-1">Les vérifications scannées apparaîtront ici en temps réel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Date et Heure</th>
                  <th className="py-3.5 px-4">Résultat</th>
                  <th className="py-3.5 px-4">Carte Vérifiée</th>
                  <th className="py-3.5 px-4">Titulaire Associé</th>
                  <th className="py-3.5 px-4">Empreinte Cryptographique</th>
                  <th className="py-3.5 px-4">Dispositif Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {formatDateTimeFr(log.verified_at)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.result} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      {log.cards ? (
                        <span className="font-mono font-bold text-slate-900 block">
                          {log.cards.card_identifier}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Token inconnu
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {log.cards?.members ? (
                        <Link
                          href={`/admin/members/${log.cards.members.id}`}
                          className="hover:text-emerald-700 transition-colors block"
                        >
                          <span className="font-semibold text-slate-800 block">
                            {log.cards.members.first_name} {log.cards.members.last_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.cards.members.member_code}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-xs truncate" title={log.token_hash_lookup}>
                      {log.token_hash_lookup.substring(0, 18)}...
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate text-[11px]" title={log.user_agent || ''}>
                      {log.user_agent ? (
                        log.user_agent.includes('Mobile') ? 'Smartphone (Agent)' : 'Poste de travail / Navigateur'
                      ) : (
                        'Inconnu'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
