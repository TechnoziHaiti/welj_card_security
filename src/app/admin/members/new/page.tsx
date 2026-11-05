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
  const [memberCode, setMemberCode] = useState('');
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

  // Calcul automatique du Code Membre selon la règle officielle (Année + Séquence continue)
  useEffect(() => {
    const fetchNextMemberCode = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const { data } = await supabase
          .from('members')
          .select('member_code')
          .order('created_at', { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          const yearCodes = data
            .map((m) => m.member_code)
            .filter((c) => c && c.startsWith(String(currentYear)));

          if (yearCodes.length > 0) {
            const maxSeq = Math.max(
              ...yearCodes.map((c) => {
                const seqPart = c.slice(4);
                const num = parseInt(seqPart, 10);
                return isNaN(num) ? 0 : num;
              })
            );
            const nextSeq = maxSeq + 1;
            const seqStr = nextSeq < 10000 ? String(nextSeq).padStart(4, '0') : String(nextSeq);
            setMemberCode(`${currentYear}${seqStr}`);
            return;
          }
        }
        setMemberCode(`${currentYear}0001`);
      } catch (err) {
        console.error('Erreur calcul code membre:', err);
        setMemberCode(`${new Date().getFullYear()}0001`);
      }
    };

    fetchNextMemberCode();
  }, [supabase]);

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

      // 1. Enregistrement du membre
      let newMember: Member;
      const codeToUse = memberCode.trim();

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          account_type: accountType,
          member_code: codeToUse,
          status: 'actif',
        })
        .select()
        .single();

      if (memberError || !memberData) {
        if (memberError?.message?.includes('duplicate key')) {
          const { data: atomicData, error: atomicErr } = await supabase.rpc(
            'create_member_atomic',
            {
              p_first_name: firstName.trim(),
              p_last_name: lastName.trim(),
              p_account_type: accountType,
            }
          );
          if (atomicErr || !atomicData) {
            throw new Error(atomicErr?.message || 'Erreur lors de la création du membre.');
          }
          newMember = atomicData as unknown as Member;
        } else {
          throw new Error(memberError?.message || 'Erreur lors de la création du membre.');
        }
      } else {
        newMember = memberData as Member;
      }

      setCreatedMember(newMember);

      // 2. Émission de la carte avec les dates choisies
      if (createCardNow) {
        const rawToken = generateSecureToken(32);
        const tokenHash = hashToken(rawToken);
        const cardIdentifier = generateCardIdentifier();

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

          {/* Section 2 : Codes (Code Client obligatoire & Code de la Carte automatique) */}
          <div className="space-y-4 pt-3 border-t border-stone-200">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <KeyRound size={15} />
              <span>2. Code Client &amp; Code de la Carte</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CHAMP 1 : CODE CLIENT (OBLIGATOIRE, SAISIE MANUELLE) */}
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
                    placeholder="Ex: CL-9824 ou REF-0042"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Référence interne ou numéro de dossier client à renseigner obligatoirement.
                </p>
              </div>

              {/* CHAMP 2 : CODE DE LA CARTE (AUTOMATIQUEMENT REMPLI SELON LA LOGIQUE) */}
              <div>
                <label
                  htmlFor="memberCode"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
                >
                  Code de la Carte
                </label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3.5 top-3.5 text-blue-600" />
                  <input
                    id="memberCode"
                    type="text"
                    readOnly
                    value={memberCode || `${new Date().getFullYear()}0001`}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-blue-50/50 border border-blue-200 rounded-xl text-blue-800 font-mono font-bold cursor-not-allowed select-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Calculé automatiquement selon la logique : Année ({new Date().getFullYear()}) + numéro de séquence incrémenté.
                </p>
              </div>
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
                  Date de Création de la Carte
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
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
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
