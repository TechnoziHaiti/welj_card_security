'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  CreditCard,
  QrCode,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  X,
  PlusCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Lock,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { QrCodeModal } from '@/components/QrCodeModal';
import { createClient } from '@/lib/supabase/client';
import { formatDateFr, formatDateTimeFr, calculateExpirationDate } from '@/lib/dates';
import { generateSecureToken, hashToken, generateCardIdentifier } from '@/lib/crypto';
import { Member, Card, MemberStatus, AccountType } from '@/types/database';

interface Props {
  initialMember: Member;
  initialCards: Card[];
  isAdmin?: boolean;
}

export function MemberDetailClient({ initialMember, initialCards, isAdmin = true }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [member, setMember] = useState<Member>(initialMember);
  const [cards, setCards] = useState<Card[]>(initialCards);

  // Mode Édition
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(member.first_name);
  const [editLastName, setEditLastName] = useState(member.last_name);
  const [editAccountType, setEditAccountType] = useState<AccountType>(member.account_type);
  const [savingEdit, setSavingEdit] = useState(false);

  // Actions Cartes
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal QR Code
  const [activeModalCard, setActiveModalCard] = useState<Card | null>(null);
  const [rawModalToken, setRawModalToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Sauvegarde des modifications
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('members')
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          account_type: editAccountType,
        })
        .eq('id', member.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Erreur lors de la mise à jour.');
      }

      setMember(data as Member);
      setIsEditing(false);
      setMessage({ text: 'Informations du membre mises à jour avec succès.', type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err?.message || 'Erreur lors de l\'enregistrement.', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Bascule du statut du membre (Actif / Inactif / Suspendu)
  const handleToggleMemberStatus = async (newStatus: MemberStatus) => {
    setActionLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', member.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Erreur lors du changement de statut.');
      }

      setMember(data as Member);
      setMessage({ text: `Statut du membre changé en "${newStatus}".`, type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err?.message || 'Erreur.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Création d'une nouvelle carte
  const handleCreateNewCard = async () => {
    if (member.status !== 'actif') {
      setMessage({ text: 'Impossible d\'émettre une carte pour un membre inactif.', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const existingCount = cards.filter((c) => c.member_id === member.id).length;
      const cardIdentifier = generateCardIdentifier(member.member_code, existingCount > 0 ? `R${existingCount}` : undefined);
      const now = new Date();
      const expiresAt = calculateExpirationDate(now);

      const { data, error } = await supabase
        .from('cards')
        .insert({
          member_id: member.id,
          card_identifier: cardIdentifier,
          qr_token_hash: tokenHash,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Erreur lors de l\'émission de la carte.');
      }

      setCards([data as Card, ...cards]);
      setActiveModalCard(data as Card);
      setRawModalToken(rawToken);
      setShowQrModal(true);
      setMessage({ text: 'Nouvelle carte émise avec succès.', type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err?.message || 'Erreur création carte.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Renouvellement de carte (invalide l'ancienne et crée la nouvelle)
  const handleRenewCard = async (oldCard: Card) => {
    if (member.status !== 'actif') {
      setMessage({ text: 'Le compte du membre doit être actif pour renouveler sa carte.', type: 'error' });
      return;
    }

    const confirmed = typeof window !== 'undefined'
      ? window.confirm(
          `CONFIRMATION WEB - RENOUVELLEMENT DE CARTE\n\n` +
          `Confirmer le renouvellement de la carte ${oldCard.card_identifier} pour ${member.first_name} ${member.last_name} pour 1 an ?\n\n` +
          `• L'ancienne carte sera immédiatement révoquée.\n` +
          `• Un nouveau QR Code officiel et sécurisé sera émis.\n\n` +
          `Cliquez sur OK pour confirmer ou Annuler pour abandonner.`
        )
      : true;

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setMessage(null);

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

      // 2. Création de la nouvelle carte liée
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const existingCount = cards.filter((c) => c.member_id === member.id).length;
      const cardIdentifier = generateCardIdentifier(member.member_code, `R${existingCount}`);
      const expiresAt = calculateExpirationDate(now);

      const { data: newCard, error: newCardError } = await supabase
        .from('cards')
        .insert({
          member_id: member.id,
          card_identifier: cardIdentifier,
          qr_token_hash: tokenHash,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'active',
          renewed_from_card_id: oldCard.id,
        })
        .select()
        .single();

      if (newCardError || !newCard) {
        throw new Error(newCardError?.message || 'Erreur renouvellement.');
      }

      // Mise à jour de la liste locale
      setCards([
        newCard as Card,
        ...cards.map((c) => (c.id === oldCard.id ? { ...c, status: 'revoquee' as const, revoked_at: now.toISOString() } : c)),
      ]);

      setActiveModalCard(newCard as Card);
      setRawModalToken(rawToken);
      setShowQrModal(true);
      setMessage({ text: `Carte renouvelée ! Nouvelle référence : ${newCard.card_identifier}`, type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err?.message || 'Erreur lors du renouvellement.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Révocation d'une carte
  const handleRevokeCard = async (cardToRevoke: Card) => {
    if (!confirm(`Êtes-vous certain de vouloir RÉVOQUER définitivement la carte ${cardToRevoke.card_identifier} ? Cette action est irréversible.`)) {
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('cards')
        .update({
          status: 'revoquee',
          revoked_at: now.toISOString(),
        })
        .eq('id', cardToRevoke.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Erreur lors de la révocation.');
      }

      setCards(cards.map((c) => (c.id === cardToRevoke.id ? (data as Card) : c)));
      setMessage({ text: `Carte ${cardToRevoke.card_identifier} révoquée.`, type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err?.message || 'Erreur lors de la révocation.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const activeCard = cards.find((c) => c.status === 'active');

  return (
    <div className="space-y-6">
      {/* Navigation et Titre */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/members"
            className="p-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-slate-700 transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {member.first_name} {member.last_name}
              </h1>
              <StatusBadge status={member.status} size="sm" />
            </div>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              Code de la Carte : <span className="font-bold text-blue-600">{member.member_code}</span> &bull; Adhérent depuis le {formatDateFr(member.created_at)}
            </p>
          </div>
        </div>

        {/* Indicateur de rôle si non-admin */}
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-[11px] text-slate-600 font-medium shadow-sm">
              Mode Consultation (Lecture seule)
            </div>
          </div>
        )}
      </div>

      {/* Messages d'alerte */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid: Infos Membre et Carte Active */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne 1: Fiche du Membre */}
        <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User size={16} className="text-blue-600" />
              Informations du Membre
            </h2>
            {isAdmin && (!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-stone-100 transition-colors"
                title="Modifier"
              >
                <Edit2 size={15} />
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-slate-800 hover:bg-stone-100 transition-colors"
                title="Annuler"
              >
                <X size={15} />
              </button>
            ))}
          </div>

          {!isEditing ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Code de la Carte
                </span>
                <span className="font-mono font-bold text-blue-600 text-sm mt-0.5 block">
                  {member.member_code}
                </span>
                <span className="text-[10px] text-slate-500">
                  Code officiel de la carte, attribué de manière séquentielle et atomique.
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Nom et Prénom
                </span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {member.last_name} {member.first_name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Type de Compte
                </span>
                <span className="inline-block mt-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-slate-800 font-semibold text-xs">
                  {member.account_type}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Statut du Compte
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={member.status} size="sm" />
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-stone-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Actions sur le compte
                  </span>
                  <div className="flex gap-2">
                    {member.status === 'actif' ? (
                      <button
                        onClick={() => handleToggleMemberStatus('inactif')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[11px] shadow-sm border border-amber-500 transition-colors"
                      >
                        Désactiver le compte
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleMemberStatus('actif')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] shadow-sm border border-emerald-600 transition-colors"
                      >
                        Réactiver le compte
                      </button>
                    )}

                    {member.status !== 'suspendu' && (
                      <button
                        onClick={() => handleToggleMemberStatus('suspendu')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-[11px] shadow-sm border border-red-600 transition-colors"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveMember} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Nom de famille
                </label>
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Prénom
                </label>
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Type de compte
                </label>
                <select
                  value={editAccountType}
                  onChange={(e) => setEditAccountType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Bronze">Bronze</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-60 shadow-sm"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Enregistrer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 border border-stone-300 text-slate-700 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Colonne 2 & 3: Carte Active et Historique des cartes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte Actuelle */}
          <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-blue-600" />
              Carte Active Actuelle
            </h2>

            {activeCard ? (
              <div className="bg-gradient-to-br from-[#0a152f] via-[#112349] to-[#19305d] text-white rounded-2xl p-6 shadow-xl border border-blue-800/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-36 h-36 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-start justify-between relative z-10 mb-6">
                  <div>
                    <span className="text-[10px] text-blue-300 font-mono tracking-widest uppercase block">
                      WELJ CARD SECURITY &bull; CARTE OFFICIELLE
                    </span>
                    <h3 className="text-xl font-mono font-bold tracking-wider mt-1 text-white">
                      {activeCard.card_identifier}
                    </h3>
                  </div>
                  <StatusBadge status="active" size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs relative z-10 pt-2 border-t border-blue-800/60">
                  <div>
                    <span className="text-[10px] text-blue-300 uppercase block">Titulaire</span>
                    <span className="font-bold text-sm block">{member.first_name} {member.last_name}</span>
                    <span className="text-[11px] font-mono text-blue-200">Identifiant : {activeCard.card_identifier}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-blue-300 uppercase block">Validité</span>
                    <span className="text-[11px] text-blue-200 block">Du {formatDateFr(activeCard.created_at)}</span>
                    <span className="font-bold text-white block">Au {formatDateFr(activeCard.expires_at)}</span>
                  </div>
                </div>

                {/* Actions de la carte active */}
                <div className="mt-5 pt-4 border-t border-blue-800/60 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => {
                      setActiveModalCard(activeCard);
                      setRawModalToken(null);
                      setShowQrModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-sm transition-colors border border-white/15"
                  >
                    <QrCode size={14} />
                    <span>Afficher / Télécharger le QR</span>
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleRenewCard(activeCard)}
                        disabled={actionLoading || member.status !== 'actif'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw size={14} />
                        <span>Renouveler la carte (1 an)</span>
                      </button>

                      <button
                        onClick={() => handleRevokeCard(activeCard)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                      >
                        <ShieldAlert size={14} />
                        <span>Révoquer</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-stone-50 border border-dashed border-stone-300 rounded-2xl">
                <p className="text-xs text-slate-600 mb-3">
                  Ce membre ne possède actuellement aucune carte active valide.
                </p>
                {isAdmin && (
                  <button
                    onClick={handleCreateNewCard}
                    disabled={actionLoading || member.status !== 'actif'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                  >
                    <PlusCircle size={15} />
                    <span>Émettre une carte maintenant</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Historique complet des cartes du membre */}
          <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              Historique des Cartes Émises
            </h2>

            {cards.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">Aucune carte enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Identifiant</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3">Date d&apos;Émission</th>
                      <th className="py-2.5 px-3">Date d&apos;Expiration</th>
                      <th className="py-2.5 px-3">Révocation / Remplacement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-slate-800">
                    {cards.map((card) => (
                      <tr key={card.id} className="hover:bg-stone-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                          {card.card_identifier}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={card.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDateFr(card.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDateFr(card.expires_at)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {card.revoked_at ? `Révoquée le ${formatDateFr(card.revoked_at)}` : '-'}
                          {card.renewed_from_card_id && ' (Renouvellement)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal QR Code */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        card={activeModalCard}
        member={member}
        rawToken={rawModalToken}
      />
    </div>
  );
}
