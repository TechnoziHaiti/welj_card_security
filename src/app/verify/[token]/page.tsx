import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnonClient } from '@/lib/supabase/server';
import { hashToken, hashIpAddress } from '@/lib/crypto';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse } from '@/types/database';

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* En-tête Welj Express Services */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl p-3 shadow-md mb-3 ring-4 ring-emerald-900/10 border border-slate-200">
            <Image
              src="/logo.png"
              alt="Welj Express Services"
              width={160}
              height={70}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/10 text-emerald-900 text-xs font-semibold tracking-wider uppercase mb-2">
            <ShieldCheck size={14} className="text-emerald-700" />
            Vérificateur Officiel
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">
            Vérification de Carte
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Résultat certifié par le registre officiel de Welj Express Services
          </p>
        </div>

        {/* ============================================================ */}
        {/* CAS 1 : CARTE AUTHENTIQUE & ACTIVE                          */}
        {/* ============================================================ */}
        {result === 'valide' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-500 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Bannière de statut */}
            <div className="bg-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm ring-4 ring-white/30">
                <ShieldCheck size={36} className="text-white" />
              </div>
              <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                Authentique
              </span>
              <h2 className="text-2xl font-black tracking-tight">Carte Authentique</h2>
              <p className="text-emerald-100 text-xs mt-1 font-medium">
                Statut officiel : <span className="font-bold underline">Active et Valide</span>
              </p>
            </div>

            {/* Détails du membre et de la carte */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white font-bold text-lg flex items-center justify-center shrink-0">
                    <User size={22} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Titulaire du compte
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      {verification.first_name} {verification.last_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Hash size={12} />
                        {verification.member_code}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        <Award size={12} />
                        {verification.account_type || 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations temporelles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Calendar size={13} className="text-emerald-600" />
                    <span>Création</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {formatDateFr(verification.created_at)}
                  </p>
                </div>
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs mb-1">
                    <Calendar size={13} className="text-emerald-600" />
                    <span className="font-semibold">Expiration</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-900">
                    {formatDateFr(verification.expires_at)}
                  </p>
                </div>
              </div>

              {verification.card_identifier && (
                <div className="text-center pt-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Réf. carte : {verification.card_identifier}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 2 : CARTE EXPIRÉE                                       */}
        {/* ============================================================ */}
        {result === 'expiree' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-500 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/80">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                  Membre associé
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">
                  {verification.first_name} {verification.last_name}
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  Code membre : <span className="font-semibold text-slate-700">{verification.member_code}</span>
                </p>
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <p className="text-xs text-rose-700 font-medium">
                  Date d&apos;expiration échue le :
                </p>
                <p className="text-sm font-bold text-rose-900 mt-0.5">
                  {formatDateFr(verification.expires_at)}
                </p>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Le titulaire doit contacter Welj Express Services pour effectuer le renouvellement de sa carte.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 3 : CARTE RÉVOQUÉE                                      */}
        {/* ============================================================ */}
        {result === 'revoquee' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-rose-600 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm font-semibold">
                Cette carte a été invalidée ou remplacée. Elle ne confère plus aucun droit d&apos;accès.
              </div>
              <p className="text-xs text-slate-500">
                Toute tentative d&apos;utilisation d&apos;une carte révoquée est consignée dans le registre de sécurité.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CAS 4 : CARTE NON RECONNUE / TOKEN INVALIDE                 */}
        {/* ============================================================ */}
        {result === 'inconnue' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-red-500 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs text-left">
                <p className="font-semibold mb-1">Motifs possibles :</p>
                <ul className="list-disc list-inside space-y-1 text-red-800">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-sm transition-all"
          >
            <QrCode size={16} className="text-emerald-700" />
            <span>Effectuer un autre scan</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Accès Administrateur Welj</span>
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6 font-mono">
          Welj Express Services &copy; {new Date().getFullYear()} &bull; Sécurité &amp; Traçabilité
        </p>
      </div>
    </main>
  );
}
