'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Search,
  Filter,
  QrCode,
  RefreshCw,
  ShieldAlert,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { QrCodeModal } from '@/components/QrCodeModal';
import { createClient } from '@/lib/supabase/client';
import { formatDateFr, isExpiringSoon } from '@/lib/dates';
import { generateSecureToken, hashToken, generateCardIdentifier } from '@/lib/crypto';
import { calculateExpirationDate } from '@/lib/dates';
import { Card, Member } from '@/types/database';

interface Props {
  initialCards: (Card & { members?: Member })[];
  currentStatusFilter?: string;
  searchQuery?: string;
  isAdmin?: boolean;
}

export function CardsListClient({ initialCards, currentStatusFilter, searchQuery, isAdmin = true }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [cards, setCards] = useState(initialCards);
  const [searchTerm, setSearchTerm] = useState(searchQuery || '');
  const [statusFilter, setStatusFilter] = useState(currentStatusFilter || 'all');
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal QR
  const [activeModalCard, setActiveModalCard] = useState<Card | null>(null);
  const [activeModalMember, setActiveModalMember] = useState<Member | null>(null);
  const [rawModalToken, setRawModalToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Révocation d'une carte
  const handleRevoke = async (card: Card) => {
    if (!confirm(`Confirmer la révocation définitive de la carte ${card.card_identifier} ?`)) return;

    setActionLoading(true);
    setAlert(null);

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('cards')
        .update({
          status: 'revoquee',
          revoked_at: now,
        })
        .eq('id', card.id)
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Erreur lors de la révocation.');

      setCards(cards.map((c) => (c.id === card.id ? { ...c, status: 'revoquee', revoked_at: now } : c)));
      setAlert({ text: `Carte ${card.card_identifier} révoquée.`, type: 'success' });
      router.refresh();
    } catch (err: any) {
      setAlert({ text: err?.message || 'Erreur.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Renouvellement d'une carte
  const handleRenew = async (oldCard: Card & { members?: Member }) => {
    if (!confirm(`Confirmer le renouvellement de la carte ${oldCard.card_identifier} pour 1 an ?`)) return;

    setActionLoading(true);
    setAlert(null);

    try {
      const now = new Date();
      // 1. Révocation de l'ancienne carte
      await supabase
        .from('cards')
        .update({
          status: 'revoquee',
          revoked_at: now.toISOString(),
        })
        .eq('id', oldCard.id);

      // 2. Création de la nouvelle
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const existingCount = cards.filter((c) => c.member_id === oldCard.member_id).length;
      const baseCode = oldCard.members?.member_code || oldCard.card_identifier.replace(/^WELJ-?/i, '').split('-')[0];
      const newCardIdentifier = generateCardIdentifier(baseCode, existingCount > 0 ? `R${existingCount}` : undefined);
      const expiresAt = calculateExpirationDate(now);

      const { data: newCard, error: createError } = await supabase
        .from('cards')
        .insert({
          member_id: oldCard.member_id,
          card_identifier: newCardIdentifier,
          qr_token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          status: 'active',
          renewed_from_card_id: oldCard.id,
        })
        .select('*, members(*)')
        .single();

      if (createError || !newCard) throw new Error(createError?.message || 'Erreur lors du renouvellement.');

      // Mise à jour de l'état local
      setCards([
        newCard as any,
        ...cards.map((c) => (c.id === oldCard.id ? { ...c, status: 'revoquee' as const, revoked_at: now.toISOString() } : c)),
      ]);

      // Ouverture automatique de la modal pour télécharger le nouveau QR Code
      setActiveModalCard(newCard as Card);
      setActiveModalMember(oldCard.members || null);
      setRawModalToken(rawToken);
      setShowQrModal(true);

      setAlert({ text: `Carte renouvelée avec succès ! Nouvel ID: ${newCardIdentifier}`, type: 'success' });
      router.refresh();
    } catch (err: any) {
      setAlert({ text: err?.message || 'Erreur lors du renouvellement.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtrage combiné : recherche (nom, prénom, code, card_id) + statut
  const filteredCards = cards.filter((c) => {
    // Filtre statut
    if (statusFilter === 'active' && c.status !== 'active') return false;
    if (statusFilter === 'expiree' && c.status !== 'expiree') return false;
    if (statusFilter === 'revoquee' && c.status !== 'revoquee') return false;
    if (statusFilter === 'expiring' && !isExpiringSoon(c.expires_at, 30)) return false;

    // Filtre recherche
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const memberName = c.members ? `${c.members.first_name} ${c.members.last_name}`.toLowerCase() : '';
      const memberCode = c.members?.member_code?.toLowerCase() || '';
      const cardId = c.card_identifier.toLowerCase();

      return memberName.includes(q) || memberCode.includes(q) || cardId.includes(q);
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Registre des Cartes Welj
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Consultation, téléchargement de QR Codes, renouvellement et révocation sécurisée.
          </p>
        </div>
      </div>

      {/* Alertes */}
      {alert && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-2xl border border-stone-300/80 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher par identifiant carte, nom du membre ou code membre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-600 mr-1">
            <Filter size={13} />
            <span>Statut :</span>
          </div>

          {[
            { id: 'all', label: 'Toutes' },
            { id: 'active', label: 'Actives' },
            { id: 'expiree', label: 'Expirées' },
            { id: 'revoquee', label: 'Révoquées' },
            { id: 'expiring', label: 'Exp. < 30j' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-stone-100 text-slate-700 hover:bg-stone-200 border border-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des Cartes */}
      <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm overflow-hidden">
        {filteredCards.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <CreditCard size={32} className="mx-auto mb-2 text-stone-400" />
            <p className="font-semibold text-slate-900">Aucune carte trouvée</p>
            <p className="text-[11px] mt-1 text-slate-500">Modifiez vos critères de recherche ou vos filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-600 border-b border-stone-200 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Identifiant Carte</th>
                  <th className="py-3.5 px-4">Titulaire (Membre)</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4">Création</th>
                  <th className="py-3.5 px-4">Expiration (1 an)</th>
                  <th className="py-3.5 px-4 text-center">QR Code</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-slate-800">
                {filteredCards.map((card) => {
                  const expiringSoon = isExpiringSoon(card.expires_at, 30);

                  return (
                    <tr key={card.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {card.card_identifier}
                      </td>
                      <td className="py-3 px-4">
                        {card.members ? (
                          <Link
                            href={`/admin/members/${card.members.id}`}
                            className="group block"
                          >
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
                              {card.members.first_name} {card.members.last_name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Compte {card.members.account_type}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">Non rattaché</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={card.status} size="sm" />
                          {expiringSoon && card.status === 'active' && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Bientôt
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDateFr(card.created_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className={expiringSoon ? 'font-bold text-amber-700' : ''}>
                          {formatDateFr(card.expires_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setActiveModalCard(card);
                            setActiveModalMember(card.members || null);
                            setRawModalToken(null);
                            setShowQrModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-stone-100 text-blue-600 font-semibold text-[11px] border border-blue-300 transition-colors shadow-sm"
                          title="Télécharger QR Code"
                        >
                          <QrCode size={13} />
                          <span>Voir QR</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1.5">
                            {card.status === 'active' && (
                              <>
                                <button
                                  onClick={() => handleRenew(card)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-slate-700 border border-stone-300 text-[11px] font-semibold transition-colors shadow-sm"
                                  title="Renouveler pour 1 an"
                                >
                                  <RefreshCw size={13} />
                                </button>
                                <button
                                  onClick={() => handleRevoke(card)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 text-[11px] font-semibold transition-colors shadow-sm"
                                  title="Révoquer"
                                >
                                  <ShieldAlert size={13} />
                                </button>
                              </>
                            )}
                            {card.status === 'expiree' && (
                              <button
                                onClick={() => handleRenew(card)}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <RefreshCw size={12} />
                                <span>Renouveler</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Lecture</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal QR Code */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        card={activeModalCard}
        member={activeModalMember}
        rawToken={rawModalToken}
      />
    </div>
  );
}
