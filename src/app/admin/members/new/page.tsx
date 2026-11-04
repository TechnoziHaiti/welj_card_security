'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { QrCodeModal } from '@/components/QrCodeModal';
import { generateSecureToken, hashToken, generateCardIdentifier } from '@/lib/crypto';
import { calculateExpirationDate } from '@/lib/dates';
import { AccountType, Card, Member } from '@/types/database';

export default function NewMemberPage() {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Standard');
  const [createCardNow, setCreateCardNow] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pour le modal de téléchargement immédiat du QR Code
  const [createdCard, setCreatedCard] = useState<Card | null>(null);
  const [createdMember, setCreatedMember] = useState<Member | null>(null);
  const [rawQrToken, setRawQrToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez renseigner le nom et le prénom du membre.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Appel atomique de la fonction PostgreSQL pour générer le code membre de façon concurrente
      const { data: memberData, error: memberError } = await supabase.rpc(
        'create_member_atomic',
        {
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
          p_account_type: accountType,
        }
      );

      if (memberError || !memberData) {
        throw new Error(memberError?.message || 'Erreur lors de la création du membre.');
      }

      const newMember = memberData as unknown as Member;
      setCreatedMember(newMember);

      // 2. Si l'option "Générer la carte" est cochée
      if (createCardNow) {
        const rawToken = generateSecureToken(32);
        const tokenHash = hashToken(rawToken);
        const cardIdentifier = generateCardIdentifier();
        const now = new Date();
        const expiresAt = calculateExpirationDate(now);

        const { data: cardData, error: cardError } = await supabase
          .from('cards')
          .insert({
            member_id: newMember.id,
            card_identifier: cardIdentifier,
            qr_token_hash: tokenHash,
            created_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            status: 'active',
          })
          .select()
          .single();

        if (cardError || !cardData) {
          throw new Error('Membre créé, mais erreur lors de la génération de la carte.');
        }

        setCreatedCard(cardData as Card);
        setRawQrToken(rawToken);
        setShowQrModal(true);
      } else {
        router.push(`/admin/members/${newMember.id}`);
        router.refresh();
      }
    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err?.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/members"
          className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition-colors shadow-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Nouveau Membre Welj
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Le code membre unique sera généré automatiquement selon la séquence officielle.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Nom de famille *
              </label>
              <input
                id="lastName"
                type="text"
                required
                placeholder="Ex: Dupont"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Prénom *
              </label>
              <input
                id="firstName"
                type="text"
                required
                placeholder="Ex: Jean-Marc"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="accountType"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Type de Compte Membre
            </label>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none bg-white transition-all"
            >
              <option value="Standard">Compte Standard</option>
              <option value="Premium">Compte Premium</option>
              <option value="VIP">Compte VIP</option>
              <option value="Entreprise">Compte Entreprise</option>
            </select>
          </div>

          {/* Option Création immédiate de carte */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createCardNow}
                onChange={(e) => setCreateCardNow(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-emerald-950 block">
                  Émettre et générer la carte physique immédiatement
                </span>
                <span className="text-emerald-800 text-[11px] block mt-0.5">
                  Calcule automatiquement l&apos;expiration à 1 an (23:59:59), génère un token aléatoire haute sécurité et prépare le QR Code pour impression.
                </span>
              </div>
            </label>
          </div>

          {/* Notice Confidentialité */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-start gap-2">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Règle de confidentialité :</strong> Aucune photographie de membre n&apos;est collectée ou stockée sur la plateforme.
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/admin/members"
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Annuler
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  <span>Enregistrer le membre</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal QR Code après création */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => {
          setShowQrModal(false);
          if (createdMember) {
            router.push(`/admin/members/${createdMember.id}`);
            router.refresh();
          }
        }}
        card={createdCard}
        member={createdMember}
        rawToken={rawQrToken}
      />
    </div>
  );
}
