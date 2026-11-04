import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  QrCode,
  ArrowLeft,
  Calendar,
  User,
  Hash,
  Award,
  Camera,
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
    // Appel sécurisé de la fonction RPC de vérification
    // Utilise le client anon avec Security Definer, ou fallback admin
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
  } catch (err) {
    console.error('Erreur lors de la vérification:', err);
  }

  const { result } = verification;
  const dynamicSecurity = generateDynamicSecurityCode(tokenHash, 30);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#010101] via-[#020617] to-[#0a152f] flex flex-col items-center justify-center p-4 sm:p-6 text-white">
      <div className="w-full max-w-md">
        {/* En-tête Welj Express Services */}
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-400 text-[11px] font-black tracking-widest uppercase mb-2 shadow-sm">
            WELJ EXPRESS SERVICES
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Vérification de Carte
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Résultat certifié par le registre officiel de Welj Express Services
          </p>
        </div>

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
          <div className="bg-[#0b1329] text-white rounded-2xl shadow-2xl border-2 border-amber-500/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-amber-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm ring-4 ring-white/30">
                <Clock size={36} className="text-white" />
              </div>
              <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                Avertissement
              </span>
              <h2 className="text-2xl font-black tracking-tight">Carte Expirée</h2>
              <p className="text-amber-100 text-xs mt-1">
                La période de validité de 1 an de cette carte est dépassée.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Membre associé
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {verification.first_name} {verification.last_name}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Code de la carte : <span className="font-semibold text-blue-400">{verification.member_code}</span>
                </p>
              </div>

              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-center">
                <p className="text-xs text-rose-300 font-medium">
                  Date d&apos;expiration échue le :
                </p>
                <p className="text-sm font-bold text-rose-200 mt-0.5">
                  {formatDateFr(verification.expires_at)}
                </p>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Le titulaire doit contacter Welj Express Services pour effectuer le renouvellement de sa carte.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 3 : CARTE RÉVOQUÉE                                      */}
        {/* ============================================================ */}
        {result === 'revoquee' && (
          <div className="bg-[#0b1329] text-white rounded-2xl shadow-2xl border-2 border-rose-600/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-rose-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm ring-4 ring-white/30">
                <ShieldAlert size={36} className="text-white" />
              </div>
              <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                Interdit
              </span>
              <h2 className="text-2xl font-black tracking-tight">Carte Révoquée</h2>
              <p className="text-rose-100 text-xs mt-1">
                Cette carte n&apos;est plus autorisée dans le réseau Welj.
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-200 text-sm font-semibold">
                Cette carte a été invalidée ou remplacée. Elle ne confère plus aucun droit d&apos;accès.
              </div>
              <p className="text-xs text-slate-400">
                Toute tentative d&apos;utilisation d&apos;une carte révoquée est consignée dans le registre de sécurité.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 4 : CARTE NON RECONNUE / TOKEN INVALIDE                 */}
        {/* ============================================================ */}
        {result === 'inconnue' && (
          <div className="bg-[#0b1329] text-white rounded-2xl shadow-2xl border-2 border-red-500/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-700 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm ring-4 ring-white/30">
                <XCircle size={36} className="text-white" />
              </div>
              <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                Alerte Sécurité
              </span>
              <h2 className="text-2xl font-black tracking-tight">Carte Non Reconnue</h2>
              <p className="text-red-100 text-xs mt-1">
                Cette carte n&apos;existe pas dans le système officiel de Welj.
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs text-left">
                <p className="font-semibold mb-1 text-red-100">Motifs possibles :</p>
                <ul className="list-disc list-inside space-y-1 text-red-200">
                  <li>Tentative de contrefaçon ou falsification de QR Code.</li>
                  <li>Lien ou token incomplet ou altéré lors du scan.</li>
                  <li>Carte provenant d&apos;un émetteur tiers non agréé.</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                Aucune information de membre n&apos;est disponible pour les tokens invalides.
              </p>
            </div>
          </div>
        )}

        {/* Pied de page et bouton nouvelle vérification */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/verify"
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-950/50 transition-all hover:scale-[1.01]"
          >
            <Camera size={18} />
            <span>Scanner la carte suivante</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Accès Administrateur Welj</span>
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-500 mt-6 font-mono">
          Welj Express Services &copy; {new Date().getFullYear()} &bull; Sécurité &amp; Traçabilité
        </p>
      </div>
    </main>
  );
}
