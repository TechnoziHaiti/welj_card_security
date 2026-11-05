'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  User,
  Hash,
  Award,
  Calendar,
  CreditCard,
  Radio,
} from 'lucide-react';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse } from '@/types/database';

interface Props {
  verification: VerificationResponse;
  initialDynamicCode?: string;
  initialValidUntil?: string;
  initialRemainingSeconds?: number;
}

export function LiveVerificationCard({ verification }: Props) {
  const [currentTime, setCurrentTime] = useState<string>('');

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

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div className="relative group w-full">
      {/* Effet lumineux néon en dessous */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-emerald-500/25 blur-3xl rounded-full pointer-events-none" />

      <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(16,185,129,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

        {/* CORPS : FULL BLACK ÉPURÉ (STYLE MINIMALISTE ET LISIBLE) */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Badge statut circulaire centré */}
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-full border-4 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400 ring-8 ring-emerald-500/5">
              <ShieldCheck size={44} className="text-emerald-400" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-sans">
              Carte Authentique &amp; Active
            </h2>

            <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
              Adhérent officiel certifié dans le registre central de Welj Express Services
            </p>
          </div>

          {/* Liste des informations clés (lignes épurées avec séparateurs discrets) */}
          <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
            {/* Titulaire */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <User size={14} className="text-stone-500" />
                <span>Titulaire</span>
              </span>
              <span className="font-bold text-white text-sm text-right truncate">
                {verification.first_name} {verification.last_name}
              </span>
            </div>

            {/* Code Client */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Hash size={14} className="text-stone-500" />
                <span>Code Client</span>
              </span>
              <span className="font-mono font-bold text-blue-400 text-sm">
                {verification.member_code}
              </span>
            </div>

            {/* Identifiant Carte */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <CreditCard size={14} className="text-stone-500" />
                <span>Identifiant Carte</span>
              </span>
              <span className="font-mono font-bold text-slate-200 text-xs">
                {verification.card_identifier}
              </span>
            </div>

            {/* Type de Compte */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Award size={14} className="text-stone-500" />
                <span>Type de Compte</span>
              </span>
              <span className="font-bold text-emerald-400 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                {verification.account_type || 'Bronze'}
              </span>
            </div>

            {/* Date d'Expiration */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Calendar size={14} className="text-stone-500" />
                <span>Expiration</span>
              </span>
              <span className="font-bold text-white text-xs">
                {formatDateFr(verification.expires_at)}
              </span>
            </div>

            {/* Contrôle Temps Réel (preuve de vie anti-capture d'écran) */}
            <div className="py-3.5 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Radio size={14} className="text-emerald-400 animate-pulse" />
                <span>Contrôle Direct</span>
              </span>
              <span className="font-mono font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {currentTime || 'Synchronisation...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
