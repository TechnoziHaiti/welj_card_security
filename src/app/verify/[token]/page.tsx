import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import {
  ShieldAlert,
  Clock,
  XCircle,
  Camera,
  ArrowLeft,
  User,
  Hash,
  CreditCard,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnonClient } from '@/lib/supabase/server';
import { hashToken, hashIpAddress, generateDynamicSecurityCode } from '@/lib/crypto';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse } from '@/types/database';
import { LiveVerificationCard } from './LiveVerificationCard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function VerifyTokenPage({ params }: PageProps) {
  const { token } = await params;
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
    message: 'Cette carte n\'existe pas dans le système officiel de Welj.',
  };

  try {
    let supabaseClient;
    try {
      supabaseClient = await createAnonClient();
    } catch {
      supabaseClient = createAdminClient();
    }

    const { data, error } = await supabaseClient.rpc('verify_card_by_token', {
      p_token_hash: tokenHash,
      p_ip_address_hash: hashedIp || undefined,
      p_user_agent: userAgent,
    });

    if (!error && data) {
      verification = data as unknown as VerificationResponse;
    } else if (error) {
      console.error('Erreur RPC verify_card_by_token:', error);
    }

    // Fallback de résolution directe par identifiant de carte officiel (ex: WELJ-20260001, WELJ-2026-BEE4B3)
    if (!verification.success) {
      const cleanToken = decodeURIComponent(token).trim();
      const { data: cardById } = await supabaseClient
        .from('cards')
        .select('*, members(*)')
        .or(`card_identifier.eq.${cleanToken},card_identifier.ilike.${cleanToken}`)
        .maybeSingle();

      if (cardById) {
        const isRevoked = cardById.status === 'revoquee';
        const isExpired = new Date(cardById.expires_at) < new Date();
        const computedResult = isRevoked ? 'revoquee' : isExpired ? 'expiree' : 'valide';

        verification = {
          success: computedResult === 'valide',
          result: computedResult as any,
          message:
            computedResult === 'valide'
              ? 'Carte officielle valide et certifiée.'
              : computedResult === 'expiree'
              ? 'Cette carte a dépassé sa date d\'expiration.'
              : 'Cette carte a été révoquée.',
          card_identifier: cardById.card_identifier,
          first_name: cardById.members?.first_name,
          last_name: cardById.members?.last_name,
          member_code: cardById.members?.member_code,
          account_type: cardById.members?.account_type,
          created_at: cardById.created_at,
          expires_at: cardById.expires_at,
          revoked_at: cardById.revoked_at,
        };
      }
    }
  } catch (err) {
    console.error('Erreur lors de la vérification:', err);
  }

  const { result } = verification;
  const dynamicSecurity = generateDynamicSecurityCode(tokenHash, 30);

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans relative overflow-hidden">
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* ============================================================ */}
        {/* CAS 1 : CARTE AUTHENTIQUE & ACTIVE                          */}
        {/* ============================================================ */}
        {result === 'valide' && (
          <LiveVerificationCard
            verification={verification}
            initialDynamicCode={dynamicSecurity.code}
            initialValidUntil={dynamicSecurity.validUntil}
            initialRemainingSeconds={dynamicSecurity.remainingSeconds}
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
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ EN GRAND PLAN */}
              <div className="bg-white py-6 px-6 sm:py-8 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={240}
                  height={143}
                  className="h-20 sm:h-24 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 rounded-full border-4 border-amber-500/30 bg-amber-500/10 flex items-center justify-center mx-auto text-amber-400 ring-8 ring-amber-500/5">
                    <Clock size={44} className="text-amber-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-sans">
                    Carte Expirée
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    La période de validité de 1 an de cette carte est échue. Le titulaire doit la renouveler.
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {verification.member_code}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
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
        {/* CAS 3 : CARTE RÉVOQUÉE                                      */}
        {/* ============================================================ */}
        {result === 'revoquee' && (
          <div className="relative group w-full">
            {/* Effet lumineux néon rouge en dessous */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-red-600/25 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(239,68,68,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ EN GRAND PLAN */}
              <div className="bg-white py-6 px-6 sm:py-8 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={240}
                  height={143}
                  className="h-20 sm:h-24 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 rounded-full border-4 border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto text-red-500 ring-8 ring-red-500/5">
                    <ShieldAlert size={44} className="text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-tight font-sans">
                    Carte Révoquée
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    Cette carte a été définitivement invalidée. Elle ne confère plus aucun accès.
                  </p>
                </div>

                <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <User size={14} className="text-stone-500" />
                      <span>Titulaire</span>
                    </span>
                    <span className="font-bold text-white text-sm text-right">
                      {verification.first_name} {verification.last_name}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <Hash size={14} className="text-stone-500" />
                      <span>Code Client</span>
                    </span>
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {verification.member_code}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <CreditCard size={14} className="text-stone-500" />
                      <span>Identifiant Carte</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {verification.card_identifier}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500" />
                      <span>Statut</span>
                    </span>
                    <span className="font-bold text-red-500 text-xs uppercase tracking-wide">
                      Révoquée &bull; Accès Refusé
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
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-red-600/25 blur-3xl rounded-full pointer-events-none" />

            <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(239,68,68,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* EN-TÊTE : FOND BLANC AVEC LOGO WELJ EN GRAND PLAN */}
              <div className="bg-white py-6 px-6 sm:py-8 flex flex-col items-center justify-center border-b border-stone-200">
                <Image
                  src="/logo.png"
                  alt="Welj Express Services"
                  width={240}
                  height={143}
                  className="h-20 sm:h-24 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {/* CORPS : FULL BLACK ÉPURÉ (STYLE EXACT DE LA PHOTO 2) */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 rounded-full border-4 border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto text-red-500 ring-8 ring-red-500/5">
                    <XCircle size={44} className="text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-tight font-sans">
                    Carte Non Reconnue
                  </h2>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
                    Cette carte n&apos;existe pas dans le système officiel de Welj Express Services.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 space-y-2 font-sans">
                  <p className="font-bold text-red-400 uppercase text-[10px] tracking-wider">
                    Motifs de sécurité possibles :
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-stone-400 text-[11px]">
                    <li>Tentative de falsification ou contrefaçon de QR Code.</li>
                    <li>Lien ou code incomplet ou altéré.</li>
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
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-950/60 transition-all font-sans"
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
