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
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  User,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTimeFr } from '@/lib/dates';
import { VerificationLog } from '@/types/database';

interface Props {
  initialLogs: VerificationLog[];
  isAdmin?: boolean;
}

function parseScanSource(rawAgent: string | null) {
  if (!rawAgent) {
    return {
      operator: null,
      device: 'Poste de travail / Navigateur',
      isMobile: false,
    };
  }

  let operator: { name: string; role: string; email: string } | null = null;
  let device = 'Poste de travail / Navigateur';
  let isMobile = rawAgent.includes('Mobile') || rawAgent.includes('Android') || rawAgent.includes('iPhone');

  // Format: "Compte: Woody Joseph (Agent de Contrôle - agent@welj-express.com) | Mozilla/5.0..."
  if (rawAgent.startsWith('Compte: ')) {
    const parts = rawAgent.split(' | ');
    const opPart = parts[0].replace('Compte: ', '').trim();
    const match = opPart.match(/^(.+?)\s*\((.+?)\s*-\s*(.+?)\)$/);
    if (match) {
      operator = {
        name: match[1].trim(),
        role: match[2].trim(),
        email: match[3].trim(),
      };
    } else {
      operator = { name: opPart, role: 'Opérateur', email: '' };
    }

    const browserPart = parts[1] || '';
    if (browserPart.includes('Mobile') || browserPart.includes('Android') || browserPart.includes('iPhone')) {
      device = 'Smartphone Mobile';
      isMobile = true;
    } else {
      device = 'Poste de travail / PC';
      isMobile = false;
    }
  } else if (rawAgent.startsWith('Contrôle Public Direct')) {
    operator = null;
    const parts = rawAgent.split(' | ');
    const browserPart = parts[1] || '';
    if (browserPart.includes('Mobile') || browserPart.includes('Android') || browserPart.includes('iPhone')) {
      device = 'Smartphone (Public)';
      isMobile = true;
    } else {
      device = 'Navigateur Public';
      isMobile = false;
    }
  } else {
    if (isMobile) {
      device = 'Smartphone (Agent)';
    } else {
      device = 'Poste de travail';
    }
  }

  return { operator, device, isMobile };
}

function getAccountTypeBadge(accountType?: string | null) {
  if (!accountType) return null;
  const lower = accountType.toLowerCase();

  if (lower === 'platinum') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-400/40 shadow-sm">
        <span>👑 Platinum</span>
      </span>
    );
  }
  if (lower === 'gold') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm">
        <span>⭐ Gold</span>
      </span>
    );
  }
  if (lower === 'silver') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-600 text-white shadow-sm">
        <span>🥈 Silver</span>
      </span>
    );
  }
  if (lower === 'bronze') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-800 text-white shadow-sm">
        <span>🥉 Bronze</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-slate-800 border border-stone-200">
      <span>{accountType}</span>
    </span>
  );
}

export function HistoryClient({ initialLogs, isAdmin = true }: Props) {
  const [logs, setLogs] = useState<VerificationLog[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet enregistrement de scan ?')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression de la ligne.');
      }

      setLogs((prev) => prev.filter((log) => log.id !== id));
      showFeedback('success', 'Enregistrement de scan supprimé avec succès.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Impossible de supprimer cet enregistrement.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (logs.length === 0) return;

    if (!window.confirm('ATTENTION : Voulez-vous vraiment vider TOUT le journal des vérifications ? Cette action est irréversible.')) {
      return;
    }

    setClearingAll(true);
    try {
      const res = await fetch('/api/admin/history?all=true', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression totale.');
      }

      setLogs([]);
      showFeedback('success', 'Le journal des vérifications a été entièrement vidé.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Impossible de vider le journal.');
    } finally {
      setClearingAll(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (resultFilter !== 'all' && log.result !== resultFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const cardRef = log.cards?.card_identifier?.toLowerCase() || '';
      const memberName = log.cards?.members
        ? `${log.cards.members.first_name} ${log.cards.members.last_name}`.toLowerCase()
        : '';
      const memberCode = (log.cards?.members?.client_code || log.cards?.members?.member_code || '').toLowerCase();
      const accountType = (log.cards?.members?.account_type || '').toLowerCase();
      const agentRaw = (log.user_agent || '').toLowerCase();
      const hashLookup = log.token_hash_lookup?.toLowerCase() || '';

      return (
        cardRef.includes(q) ||
        memberName.includes(q) ||
        memberCode.includes(q) ||
        accountType.includes(q) ||
        agentRaw.includes(q) ||
        hashLookup.includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <History size={24} className="text-emerald-600" />
            Journal des Vérifications de Sécurité
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Historique auditable de tous les scans effectués via le vérificateur officiel ou mobile.
          </p>
        </div>

        {isAdmin && logs.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearingAll || deletingId !== null}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            title="Supprimer tous les scans enregistrés"
          >
            {clearingAll ? (
              <Loader2 size={15} className="animate-spin text-white" />
            ) : (
              <Trash2 size={15} className="text-white" />
            )}
            <span>Vider l&apos;historique</span>
          </button>
        )}
      </div>

      {/* Message de notification */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-transparent border-rose-400 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-2xl border border-stone-300/80 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher par compte, titulaire, code client, type de formule (Platinum, Gold...), opérateur ou carte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-600 mr-1">
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
                  ? 'bg-[#16a34a] text-white font-semibold'
                  : 'bg-stone-100 text-slate-700 hover:bg-stone-200 border border-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des Logs */}
      <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <History size={32} className="mx-auto mb-2 text-stone-400" />
            <p className="font-semibold text-slate-900">
              {logs.length === 0 ? "Aucun enregistrement d'audit" : "Aucun résultat trouvé"}
            </p>
            <p className="text-[11px] mt-1 text-slate-500">
              {logs.length === 0
                ? "Les vérifications scannées apparaîtront ici en temps réel."
                : "Modifiez vos termes de recherche ou sélectionnez un autre filtre."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Date et Heure</th>
                  <th className="py-3.5 px-4">Résultat</th>
                  <th className="py-3.5 px-4">Carte Vérifiée</th>
                  <th className="py-3.5 px-4">Compte &amp; Titulaire Scanné</th>
                  <th className="py-3.5 px-4">Compte Opérateur (Scanné par)</th>
                  <th className="py-3.5 px-4">Empreinte Cryptographique</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-slate-800">
                {filteredLogs.map((log) => {
                  const { operator, device, isMobile } = parseScanSource(log.user_agent);

                  return (
                    <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDateTimeFr(log.verified_at)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={log.result} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        {log.cards ? (
                          <span className="font-mono font-bold text-emerald-600 block">
                            {log.cards.card_identifier}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">
                            Token inconnu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {log.cards?.members ? (
                          <Link
                            href={`/admin/members/${log.cards.members.id}`}
                            className="hover:text-emerald-600 transition-colors block group"
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {getAccountTypeBadge(log.cards.members.account_type)}
                              <span className="font-mono font-bold text-[11px] text-emerald-700">
                                {log.cards.members.client_code || log.cards.members.member_code}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 group-hover:text-emerald-600 block leading-tight">
                              {log.cards.members.first_name} {log.cards.members.last_name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">
                            Aucun compte rattaché
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {operator ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <UserCheck size={13} className="text-emerald-600 shrink-0" />
                              <span>{operator.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {operator.role}
                              </span>
                            </div>
                            {operator.email && (
                              <p className="text-[10px] text-slate-500 font-mono pl-4">
                                {operator.email}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-4">
                              {isMobile ? <Smartphone size={10} /> : <Monitor size={10} />}
                              <span>{device}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold">
                              <Globe size={13} className="text-slate-400 shrink-0" />
                              <span>Contrôle Direct (Public)</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-4">
                              {isMobile ? <Smartphone size={10} /> : <Monitor size={10} />}
                              <span>{device}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={log.token_hash_lookup}>
                        {log.token_hash_lookup.substring(0, 16)}...
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            disabled={deletingId === log.id || clearingAll}
                            className="inline-flex items-center justify-center p-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Supprimer cet enregistrement"
                            aria-label="Supprimer cet enregistrement"
                          >
                            {deletingId === log.id ? (
                              <Loader2 size={15} className="animate-spin text-white" />
                            ) : (
                              <Trash2 size={15} className="text-white" />
                            )}
                          </button>
                        </td>
                      )}
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
