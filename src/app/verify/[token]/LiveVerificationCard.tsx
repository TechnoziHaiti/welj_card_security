'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Hash,
  Award,
  Calendar,
  Clock,
  Radio,
  Lock,
} from 'lucide-react';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse } from '@/types/database';

interface Props {
  verification: VerificationResponse;
  initialDynamicCode: string;
  initialValidUntil: string;
  initialRemainingSeconds: number;
}

export function LiveVerificationCard({
  verification,
  initialDynamicCode,
  initialRemainingSeconds,
}: Props) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(initialRemainingSeconds);
  const [dynamicCode, setDynamicCode] = useState<string>(initialDynamicCode);

  useEffect(() => {
    // Horloge temps réel animée (défile chaque seconde pour prouver qu'il ne s'agit pas d'une capture d'écran)
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    // Décompte de la tranche de 30 minutes
    const countdownInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Recharger pour régénérer le code de la nouvelle tranche
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const minutesRemaining = Math.floor(secondsLeft / 60);
  const secondsRemaining = secondsLeft % 60;

  return (
    <div className="bg-[#0b1329] text-white rounded-3xl shadow-2xl border-2 border-emerald-500/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Bannière de statut officielle */}
      <div className="bg-emerald-600 p-6 text-white text-center relative overflow-hidden">
        {/* Effet d'arrière-plan */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm ring-4 ring-white/30">
          <ShieldCheck size={38} className="text-white" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
          Carte Authentique &bull; Active
        </div>

        <h2 className="text-2xl font-black tracking-tight">Carte Officielle Welj</h2>
        <p className="text-emerald-100 text-xs mt-0.5 font-medium">
          Identité certifiée dans le registre central de Welj Express Services
        </p>
      </div>

      {/* BLOC SÉCURITÉ DYNAMIQUE 30 MINUTES (ANTI-CAPTURE D'ÉCRAN) */}
      <div className="bg-[#020617] text-white p-4 mx-4 -mt-3 rounded-2xl shadow-xl border border-emerald-500/30 relative z-10">
        <div className="flex items-center justify-between text-[11px] text-emerald-300 mb-2">
          <span className="font-semibold flex items-center gap-1.5">
            <Radio size={13} className="text-emerald-400 animate-pulse" />
            CONTRÔLE EN DIRECT TEMPS RÉEL
          </span>
          <span className="font-mono font-bold text-white bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/80">
            {currentTime || 'Synchronisation...'}
          </span>
        </div>

        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-semibold">
              Code Dynamique (Validité 30 min) :
            </span>
            <span className="text-xl font-mono font-black text-emerald-300 tracking-wider block mt-0.5">
              {dynamicCode}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Renouvellement dans</span>
            <span className="text-xs font-mono font-bold text-white block mt-0.5">
              {minutesRemaining}m {secondsRemaining.toString().padStart(2, '0')}s
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 mt-2 text-center leading-tight">
          Ce code change automatiquement toutes les 30 minutes. Il prouve à l&apos;agent que cet écran est authentique et actif à cet instant précis.
        </p>
      </div>

      {/* Détails du membre et de la carte */}
      <div className="p-6 space-y-4">
        {/* Fiche Titulaire */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
              <User size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Titulaire de la carte
              </span>
              <h3 className="text-lg font-black text-white leading-tight truncate">
                {verification.first_name} {verification.last_name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-800/60">
                  <Hash size={12} />
                  {verification.member_code}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                  <Award size={12} />
                  {verification.account_type || 'Bronze'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Informations de Validité */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Calendar size={13} className="text-blue-400" />
              <span>Création</span>
            </div>
            <p className="text-xs font-bold text-slate-200">
              {formatDateFr(verification.created_at)}
            </p>
          </div>

          <div className="bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-500/30">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-1">
              <Calendar size={13} className="text-emerald-400" />
              <span className="font-bold">Expiration</span>
            </div>
            <p className="text-xs font-black text-emerald-300">
              {formatDateFr(verification.expires_at)}
            </p>
          </div>
        </div>

        {verification.card_identifier && (
          <div className="text-center pt-1">
            <span className="text-[11px] text-slate-500 font-mono">
              Identifiant officiel : <strong className="text-slate-300">{verification.card_identifier}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
