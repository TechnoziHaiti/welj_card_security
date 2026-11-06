'use client';

import React, { useState, useEffect } from 'react';
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
  User,
  KeyRound,
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
  const [clientCode, setClientCode] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Platinum');

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

  // Vérification de sécurité : Seul l'administrateur a le droit de créer des membres
  useEffect(() => {
    async function verifyAdminAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role;
      if (role !== 'admin') {
        router.replace('/admin/members');
      }
    }
    verifyAdminAccess();
  }, [router, supabase]);

  // Mise à jour synchronisée de la date d'expiration par défaut (+1 an) si création modifiée
  const handleCreationDateChange = (newCreationDate: string) => {
    setCreationDate(newCreationDate);
    if (newCreationDate) {
      try {
        const parts = newCreationDate.split('-');
        const y = parseInt(parts[0], 10) + 1;
        setExpirationDate(`${y}-${parts[1]}-${parts[2]}`);
      } catch {
        // Fallback
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!lastName.trim() || !firstName.trim()) {
        throw new Error('Le nom et le prénom sont obligatoires.');
      }

      if (!clientCode.trim()) {
        throw new Error('Le Code Client est obligatoire.');
      }

      const enteredClientCode = clientCode.trim();

      // 1. Enregistrement adaptatif et résilient du membre avec son Code Client saisi
      // Supporte tous les états du schéma Supabase (présence de client_code, member_code, ou des deux).
      let memberData: any = null;
      let memberError: any = null;

      const firstAttempt = await supabase
        .from('members')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          account_type: accountType,
          member_code: enteredClientCode,
          client_code: enteredClientCode,
          status: 'actif',
        })
        .select()
        .single();

      if (!firstAttempt.error && firstAttempt.data) {
        memberData = firstAttempt.data;
      } else {
        const errorText = `${firstAttempt.error?.message || ''} ${firstAttempt.error?.details || ''}`;

        // Si la colonne 'member_code' n'est pas dans le schéma Supabase
        if (errorText.includes('member_code')) {
          const retryClientOnly = await supabase
            .from('members')
            .insert({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              account_type: accountType,
              client_code: enteredClientCode,
              status: 'actif',
            })
            .select()
            .single();
          memberData = retryClientOnly.data;
          memberError = retryClientOnly.error;
        }
        // Si la colonne 'client_code' n'est pas dans le schéma Supabase
        else if (errorText.includes('client_code') || firstAttempt.error?.code === 'PGRST204') {
          const retryMemberOnly = await supabase
            .from('members')
            .insert({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              account_type: accountType,
              member_code: enteredClientCode,
              status: 'actif',
            })
            .select()
            .single();
          memberData = retryMemberOnly.data;
          memberError = retryMemberOnly.error;
        } else {
          memberError = firstAttempt.error;
        }
      }

      if (memberError || !memberData) {
        if (
          memberError?.message?.includes('duplicate key') ||
          memberError?.message?.includes('unique constraint')
        ) {
          throw new Error(
            `Ce Code Client "${enteredClientCode}" existe déjà dans le système. Veuillez saisir un code client unique.`
          );
        }
        throw new Error(memberError?.message || 'Erreur lors de la création du membre.');
      }

      const newMember = memberData as Member;
      setCreatedMember(newMember);

      // 2. Émission de la carte associée avec l'identifiant basé directement sur ce Code Client
      if (createCardNow) {
        const rawToken = generateSecureToken(32);
        const tokenHash = hashToken(rawToken);
        const cardIdentifier = generateCardIdentifier(enteredClientCode);

        const creationObj = new Date(`${creationDate}T${new Date().toTimeString().split(' ')[0]}`);
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
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/members"
          className="p-2.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-slate-700 transition-colors shadow-sm"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Nouveau Membre Welj
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Enregistrement du dossier client, attribution automatique du code membre et émission de carte.
          </p>
        </div>
      </div>

      {/* Formulaire large et spacieux */}
      <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm p-6 sm:p-10 text-slate-900">
        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Section 1 : Identité Civile */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <User size={15} />
              <span>1. Identité du Titulaire</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
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
                  className="w-full px-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
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
                  className="w-full px-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Code Client */}
          <div className="space-y-4 pt-3 border-t border-stone-200">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <KeyRound size={15} />
              <span>2. Code Client</span>
            </h2>

            <div>
              <label
                htmlFor="clientCode"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
              >
                Code Client *
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
                <input
                  id="clientCode"
                  type="text"
                  required
                  placeholder="Ex: CL-9824 ou RP861950"
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Référence interne ou numéro de dossier client à renseigner obligatoirement.
              </p>
            </div>
          </div>

          {/* Section 3 : Formule et Type de Compte */}
          <div className="space-y-4 pt-3 border-t border-stone-200">
            <div>
              <label
                htmlFor="accountType"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
              >
                Type de Compte Membre
              </label>
              <select
                id="accountType"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full px-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              >
                <option value="Platinum">Platinum</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Bronze">Bronze</option>
              </select>
            </div>
          </div>

          {/* Section 4 : Paramètres de la Carte Welj */}
          <div className="p-5 sm:p-6 rounded-2xl bg-stone-50 border border-stone-200 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Calendar size={16} className="text-blue-600" />
              <span>Paramètres de la Carte Welj (Validité 1 an)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="creationDate"
                  className="block text-[11px] font-semibold text-slate-600 uppercase mb-1.5"
                >
                  Date d&apos;Adhésion
                </label>
                <input
                  id="creationDate"
                  type="date"
                  required
                  value={creationDate}
                  onChange={(e) => handleCreationDateChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-[11px] font-semibold text-slate-600 uppercase mb-1.5"
                >
                  Date d&apos;Expiration de la Carte
                </label>
                <input
                  id="expirationDate"
                  type="date"
                  required
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-700"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-3 border-t border-stone-200">
              <input
                type="checkbox"
                checked={createCardNow}
                onChange={(e) => setCreateCardNow(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 bg-white"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Émettre et générer le QR Code officiel immédiatement
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Génère le token aléatoire haute sécurité et prépare le QR Code scellé pour impression.
                </span>
              </div>
            </label>
          </div>

          {/* Notice Confidentialité */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-slate-700 text-xs flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>Sécurité &amp; Confidentialité :</strong> Aucune photo n&apos;est enregistrée. La carte est liée au QR Code et protégée par un code de sécurité dynamique en direct (30 min) lors des contrôles.
            </span>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-transparent border border-rose-500/60 text-rose-600 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <Link
              href="/admin/members"
              className="px-5 py-2.5 rounded-xl border border-stone-300 text-slate-700 hover:bg-stone-100 text-xs font-semibold transition-colors"
            >
              Annuler
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
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
