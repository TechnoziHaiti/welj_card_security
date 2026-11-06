import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import {
  Clock,
  Camera,
  ArrowLeft,
  User,
  Hash,
  CreditCard,
  Calendar,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnonClient } from '@/lib/supabase/server';
import { hashToken, hashIpAddress } from '@/lib/crypto';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse, VerificationResultType } from '@/types/database';
import { LiveVerificationCard } from './LiveVerificationCard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ raw?: string }>;
}

export default async function VerifyTokenPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const search = searchParams ? await searchParams : {};
  let rawScanned: string | null = null;
  if (search.raw) {
    try {
      rawScanned = decodeURIComponent(search.raw).trim();
    } catch {
      rawScanned = String(search.raw).trim();
    }
  }
  const headerList = await headers();

  const userAgent = headerList.get('user-agent') || 'Inconnu';
  const forwardedFor = headerList.get('x-forwarded-for');
  const realIp = headerList.get('x-real-ip');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || null;
  const hashedIp = hashIpAddress(clientIp);

  // Calcul de l'empreinte cryptographique SHA-256 du token
  const tokenHash = hashToken(token);

  let verification: VerificationResponse = {
    success: false,
    result: 'inconnue',
    message: rawScanned
      ? 'Ce lien ne correspond à aucune carte dans notre système.'
      : 'Cette carte n\'existe pas dans le système officiel de Welj.',
  };

  // Si le token est explicitement "inconnue", on affiche directement l'écran de rejet sans interroger la DB
  if (token !== 'inconnue') {
    try {
      const adminSupabase = createAdminClient();
      const cleanToken = decodeURIComponent(token).trim();
      const tokenHash = hashToken(cleanToken);

      let card: any = null;
      let member: any = null;

      // Étape 1 : Recherche par empreinte de token (QR Code officiel scanné)
      const { data: cardByToken } = await adminSupabase
        .from('cards')
        .select('*')
        .or(`qr_token_hash.eq.${tokenHash},qr_token_hash.eq.${cleanToken}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cardByToken) {
        card = cardByToken;
      }

      // Étape 2 : Si non trouvée, recherche par Identifiant Carte (ex: WELJ-RP861950, WELJ-20260001, RP861950)
      if (!card) {
        const candidateWithoutPrefix = cleanToken.replace(/^WELJ-/i, '');
        const { data: cardByIdentifier } = await adminSupabase
          .from('cards')
          .select('*')
          .or(
            `card_identifier.eq.${cleanToken},card_identifier.ilike.${cleanToken},card_identifier.eq.WELJ-${cleanToken},card_identifier.ilike.WELJ-${cleanToken},card_identifier.eq.WELJ-${candidateWithoutPrefix},card_identifier.ilike.WELJ-${candidateWithoutPrefix}`
          )
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cardByIdentifier) {
          card = cardByIdentifier;
        }
      }

      // Étape 3 : Si non trouvée, recherche par Code Client dans la table members
      if (!card) {
        let memberFound: any = null;
        try {
          const { data: m1 } = await adminSupabase
            .from('members')
            .select('*')
            .or(`client_code.eq.${cleanToken},client_code.ilike.${cleanToken}`)
            .limit(1)
            .maybeSingle();
          if (m1) memberFound = m1;
        } catch {}

        if (!memberFound) {
          try {
            const { data: m2 } = await adminSupabase
              .from('members')
              .select('*')
              .or(`member_code.eq.${cleanToken},member_code.ilike.${cleanToken}`)
              .limit(1)
              .maybeSingle();
            if (m2) memberFound = m2;
          } catch {}
        }

        if (memberFound) {
          member = memberFound;
          const { data: memberCard } = await adminSupabase
            .from('cards')
            .select('*')
            .eq('member_id', memberFound.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (memberCard) {
            card = memberCard;
          }
        }
      }

      // Étape 4 : Charger le membre si la carte a été trouvée
      if (card && !member && card.member_id) {
        const { data: m } = await adminSupabase
          .from('members')
          .select('*')
          .eq('id', card.member_id)
          .maybeSingle();
        if (m) {
          member = m;
        }
      }

      // Étape 5 : Analyse précise et infaillible du statut
      if (card) {
        const isRevoked = card.status === 'revoquee';
        const isExpired = new Date(card.expires_at).getTime() < Date.now() || card.status === 'expiree';
        const isMemberInactive = member && member.status && member.status === 'inactif';
        const isMemberSuspended = member && member.status && member.status === 'suspendu';

        let computedResult: VerificationResultType = 'valide';
        let message = 'Carte officielle valide et certifiée.';

        // Hiérarchie des statuts selon les règles métier Welj :
        // 1. Fraude / Litige -> "Ce compte est suspendu"
        // 2. Carte perdue / Désactivation -> "Ce compte est désactivé"
        // 3. Carte révoquée -> "Ce compte n'est plus valide"
        // 4. Échéance dépassée -> "Cette carte est expirée"
        // 5. Compte & Carte normaux -> "Carte authentique et active"
        if (isMemberSuspended) {
          computedResult = 'suspendu';
          message = 'Ce compte est suspendu.';
        } else if (isMemberInactive) {
          computedResult = 'desactive';
          message = 'Ce compte est désactivé.';
        } else if (isRevoked) {
          computedResult = 'revoquee';
          message = 'Ce compte n\'est plus valide.';
        } else if (isExpired) {
          computedResult = 'expiree';
          message = 'Cette carte est expirée.';
        }

        verification = {
          success: computedResult === 'valide',
          result: computedResult,
          message,
          card_identifier: card.card_identifier,
          first_name: member?.first_name || 'Membre',
          last_name: member?.last_name || 'Welj',
          client_code: member?.client_code || member?.member_code || card.card_identifier,
          member_code: member?.client_code || member?.member_code || card.card_identifier,
          account_type: member?.account_type || 'Platinum',
          created_at: card.created_at,
          expires_at: card.expires_at,
          revoked_at: card.revoked_at,
        };

        // Enregistrement immédiat dans les logs de vérification conforme aux statuts autorisés en DB
        const logResult =
          computedResult === 'valide'
            ? 'valide'
            : computedResult === 'expiree'
            ? 'expiree'
            : 'revoquee';

        try {
          await adminSupabase.from('verification_logs').insert({
            card_id: card.id,
            result: logResult,
            token_hash_lookup: tokenHash,
            ip_address_hash: hashedIp || null,
            user_agent: userAgent,
          });
        } catch (logErr) {
          console.error('Erreur log verification:', logErr);
        }
      } else {
        // La carte n'existe PAS du tout dans le système (lien externe, QR Code étranger ou contrefaçon)
        verification = {
          success: false,
          result: 'inconnue',
          message: rawScanned
            ? 'Ce lien externe ne correspond à aucune carte dans notre système.'
            : 'Cette carte n\'existe pas dans le système officiel de Welj.',
        };

        try {
          await adminSupabase.from('verification_logs').insert({
            card_id: null,
            result: 'inconnue',
            token_hash_lookup: tokenHash,
            ip_address_hash: hashedIp || null,
            user_agent: userAgent,
          });
        } catch {}
      }
    } catch (err) {
      console.error('Erreur lors de la vérification:', err);
    }
  }

  const { result } = verification;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans relative overflow-hidden">
      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* ============================================================ */}
        {/* CAS 1 : CARTE AUTHENTIQUE & ACTIVE                          */}
        {/* ============================================================ */}
        {result === 'valide' && (
          <LiveVerificationCard
            verification={verification}
          />
        )}

        {/* ============================================================ */}
        {/* CAS 2 : CARTE EXPIRÉE                                       */}
        {/* ============================================================ */}
        {result === 'expiree' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon ambre en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-amber-500/25 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(245,158,11,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ COMPACT */}
              <div className="bg-white py-3.5 px-4 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={180}
                  height={72}
                  className="h-10 sm:h-12 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center mx-auto text-amber-400">
                    <Clock size={40} className="text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-sans">
                    Cette carte est expirée
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    La période de validité de 1 an de cette carte est échue. Le titulaire doit la renouveler.
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {verification.client_code || verification.member_code}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Calendar size={14} className="text-amber-400" />
                      <span>Expiration</span>
                    </span>
                    <span className="font-bold text-amber-400 text-xs">
                      Échue le {formatDateFr(verification.expires_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 3 : COMPTE DÉSACTIVÉ (ex: Carte perdue)                 */}
        {/* ============================================================ */}
        {result === 'desactive' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon ambre en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-amber-500/25 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(245,158,11,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ COMPACT */}
              <div className="bg-white py-3.5 px-4 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={180}
                  height={72}
                  className="h-10 sm:h-12 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center mx-auto text-amber-400">
                    <AlertTriangle size={40} className="text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-sans">
                    Ce compte est désactivé
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    Ce compte a été désactivé par l&apos;administration (signalement de carte perdue ou dossier en sommeil).
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {verification.client_code || verification.member_code}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-400" />
                      <span>Statut</span>
                    </span>
                    <span className="font-bold text-amber-400 text-xs uppercase tracking-wide">
                      Désactivé &bull; Accès Non Autorisé
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 4 : COMPTE SUSPENDU (ex: Fraude ou litige)              */}
        {/* ============================================================ */}
        {result === 'suspendu' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon rouge en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-red-600/35 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(239,68,68,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ COMPACT */}
              <div className="bg-white py-3.5 px-4 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={180}
                  height={72}
                  className="h-10 sm:h-12 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center mx-auto text-red-500">
                    <ShieldAlert size={44} className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-tight font-sans">
                    Ce compte est suspendu
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    Ce compte fait l&apos;objet d&apos;une mesure conservatoire de suspension administrative immédiate.
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {verification.client_code || verification.member_code}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500" />
                      <span>Statut</span>
                    </span>
                    <span className="font-bold text-red-500 text-xs uppercase tracking-wide">
                      Suspendu &bull; Accès Bloqué
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 5 : CARTE RÉVOQUÉE                                      */}
        {/* ============================================================ */}
        {result === 'revoquee' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon rouge en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-red-600/35 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(239,68,68,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ COMPACT */}
              <div className="bg-white py-3.5 px-4 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={180}
                  height={72}
                  className="h-10 sm:h-12 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center mx-auto">
                    <Image
                      src="/badge-rejected.png"
                      alt="Badge Révoqué"
                      width={80}
                      height={80}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                      priority
                      unoptimized
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-tight font-sans">
                    Ce compte n&apos;est plus valide
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    Cette carte a été définitivement révoquée et invalidée. Elle ne confère plus aucun droit d&apos;accès.
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {verification.client_code || verification.member_code}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500" />
                      <span>Statut</span>
                    </span>
                    <span className="font-bold text-red-500 text-xs uppercase tracking-wide">
                      Révoquée &bull; Non Valide
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 4 : CARTE NON RECONNUE / TOKEN INVALIDE                 */}
        {/* ============================================================ */}
        {result === 'inconnue' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon rouge en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-red-600/35 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(239,68,68,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ COMPACT */}
              <div className="bg-white py-3.5 px-4 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={180}
                  height={72}
                  className="h-10 sm:h-12 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center mx-auto">
                    <Image
                      src="/badge-rejected.png"
                      alt="Carte Rejetée"
                      width={80}
                      height={80}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                      priority
                      unoptimized
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-tight font-sans">
                    Carte Rejetée
                  </h2>
                  <p className="text-xs text-stone-300 max-w-xs mx-auto font-sans leading-relaxed font-medium">
                    {verification.message}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 space-y-1.5 font-sans text-left">
                  <p className="font-bold text-red-400 uppercase text-[10px] tracking-wider">
                    Motifs de sécurité possibles :
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-stone-400 text-[11px]">
                    <li>QR Code d&apos;un autre site web ou d&apos;un service tiers.</li>
                    <li>Tentative de falsification ou contrefaçon de QR Code.</li>
                    <li>Carte non émise par Welj Express Services.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'action en bas (style propre et lisible) */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Link
            href="/verify"
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#16a34a] hover:bg-[#15803d] active:bg-[#166534] text-white font-bold text-sm shadow-xl shadow-green-950/60 transition-all font-sans"
          >
            <Camera size={18} />
            <span>Scanner la carte suivante</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors font-sans py-1"
          >
            <ArrowLeft size={13} />
            <span>Accès Administrateur Welj</span>
          </Link>
        </div>

        <p className="text-center text-[10px] text-stone-500 font-sans tracking-wide">
          Welj Express Services &copy; {new Date().getFullYear()} &bull; Sécurité &amp; Traçabilité
        </p>
      </div>
    </main>
  );
}
