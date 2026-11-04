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
  Calendar,
  Hash,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { QrCodeModal } from '@/components/QrCodeModal';
import { generateSecureToken, hashToken, generateCardIdentifier } from '@/lib/crypto';
import { calculateExpirationDate } from '@/lib/dates';
import { AccountType, Card, Member } from '@/types/database';

export default function NewMemberPage() {
  const router = useRouter();
  const supabase = createClient();

  // 1. Informations d'identité
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Standard');

  // 2. Dates de la carte (Création & Expiration)
  const todayStr = new Date().toISOString().split('T')[0];
  const nextYearDate = new Date();
  nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
  const nextYearStr = nextYearDate.toISOString().split('T')[0];

  const [creationDate, setCreationDate] = useState(todayStr);
  const [expirationDate, setExpirationDate] = useState(nextYearStr);
  const [createCardNow, setCreateCardNow] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal QR Code
  const [createdCard, setCreatedCard] = useState<Card | null>(null);
  const [createdMember, setCreatedMember] = useState<Member | null>(null);
  const [rawQrToken, setRawQrToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Mise à jour automatique de la date d'expiration (+1 an) si la date de création change
  const handleCreationDateChange = (newCreationDate: string) => {
    setCreationDate(newCreationDate);
    try {
      const d = new Date(newCreationDate);
      if (!isNaN(d.getTime())) {
        const calculated = calculateExpirationDate(d);
        setExpirationDate(calculated.toISOString().split('T')[0]);
      }
    } catch {
      // Ignoré
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez renseigner le nom et le prénom du membre.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let newMember: Member;

      // Si l'utilisateur a spécifié un code client personnalisé
      if (memberCode.trim()) {
        const { data: customMember, error: customErr } = await supabase
          .from('members')
          .insert({
            member_code: memberCode.trim().toUpperCase(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            account_type: accountType,
            status: 'actif',
          })
          .select()
          .single();

        if (customErr || !customMember) {
          throw new Error(
            customErr?.message?.includes('duplicate key')
              ? `Le code client "${memberCode}" est déjà attribué. Veuillez en choisir un autre.`
              : customErr?.message || 'Erreur lors de la création du membre.'
          );
        }
        newMember = customMember as Member;
      } else {
        // Génération automatique et atomique du code séquentiel par PostgreSQL
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

        newMember = memberData as unknown as Member;
      }

      setCreatedMember(newMember);

      // 2. Émission de la carte avec les dates choisies
      if (createCardNow) {
        const rawToken = generateSecureToken(32);
        const tokenHash = hashToken(rawToken);
        const cardIdentifier = generateCardIdentifier();

        // Heure de création avec l'heure courante sur la date sélectionnée
        const creationObj = new Date(`${creationDate}T${new Date().toTimeString().split(' ')[0]}`);
        // Expiration à 23:59:59.999 UTC sur la date d'expiration choisie
        const expirationObj = new Date(`${expirationDate}T23:59:59.999Z`);

        const { data: cardData, error: cardError } = await supabase
          .from('cards')
          .insert({
            member_id: newMember.id,
            card_identifier: cardIdentifier,
            qr_token_hash: tokenHash,
            created_at: creationObj.toISOString(),
            expires_at: expirationObj.toISOString(),
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
            Enregistrement du membre, attribution du code et émission de la carte.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identité : Nom & Prénom */}
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

          {/* Code Client / Membre */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="memberCode"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Code Client / Code Membre
              </label>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Sparkles size={12} />
                Laisser vide pour génération automatique
              </span>
            </div>
            <div className="relative">
              <Hash size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                id="memberCode"
                type="text"
                placeholder="Ex: 20260001 (Automatique si vide)"
                value={memberCode}
                onChange={(e) => setMemberCode(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Si vous laissez ce champ vide, le système attribuera automatiquement le prochain code selon la séquence officielle (ex : Année + Séquence continue).
            </p>
          </div>

          {/* Type de compte */}
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

          {/* Dates de Carte : Création et Expiration */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Calendar size={16} className="text-emerald-700" />
              <span>Paramètres de la Carte Welj</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="creationDate"
                  className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
                >
                  Date de Création de la Carte
                </label>
                <input
                  id="creationDate"
                  type="date"
                  required
                  value={creationDate}
                  onChange={(e) => handleCreationDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
                >
                  Date d&apos;Expiration de la Carte
                </label>
                <input
                  id="expirationDate"
                  type="date"
                  required
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none bg-white font-bold text-emerald-900"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-200">
              <input
                type="checkbox"
                checked={createCardNow}
                onChange={(e) => setCreateCardNow(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">
                  Émettre et générer le QR Code officiel immédiatement
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Génère le token aléatoire haute sécurité et prépare le QR Code scellé pour impression.
                </span>
              </div>
            </label>
          </div>

          {/* Notice Confidentialité */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Sécurité &amp; Confidentialité :</strong> Aucune photo n&apos;est enregistrée. La carte est liée au QR Code et protégée par un code de sécurité dynamique en direct (30 min) lors des contrôles.
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
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md disabled:opacity-60 cursor-pointer"
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
