'use client';

import React from 'react';
import Image from 'next/image';
import {
  User,
  Hash,
  Award,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { formatDateFr } from '@/lib/dates';
import { VerificationResponse } from '@/types/database';

interface Props {
  verification: VerificationResponse;
}

export function LiveVerificationCard({ verification }: Props) {
  return (
    <div className="relative group w-full">
      {/* Effet lumineux néon bleu en dessous */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-28 bg-blue-600/35 blur-3xl rounded-full pointer-events-none" />

      <div className="relative bg-black text-white rounded-3xl border border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_10px_30px_rgba(37,99,235,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
          {/* Badge vérifié bleu officiel */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mx-auto">
              <Image
                src="/badge-verified.png"
                alt="Badge Vérifié"
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(37,99,235,0.6)]"
                priority
                unoptimized
              />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-blue-500 tracking-tight font-sans">
              Carte Authentique &amp; Active
            </h2>

            <p className="text-xs text-stone-400 max-w-xs mx-auto font-sans leading-relaxed">
              Adhérent officiel certifié dans le registre central de Welj Express Services
            </p>
          </div>

          {/* Liste des informations clés (lignes épurées et fixes) */}
          <div className="divide-y divide-stone-800/80 border-y border-stone-800/80 text-xs font-sans">
            {/* Titulaire */}
            <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <User size={14} className="text-stone-500" />
                <span>Titulaire</span>
              </span>
              <span className="font-bold text-white text-sm text-right truncate">
                {verification.first_name} {verification.last_name}
              </span>
            </div>

            {/* Code Client */}
            <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Hash size={14} className="text-stone-500" />
                <span>Code Client</span>
              </span>
              <span className="font-mono font-bold text-blue-400 text-sm">
                {verification.client_code || verification.member_code}
              </span>
            </div>

            {/* Identifiant Carte */}
            <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <CreditCard size={14} className="text-stone-500" />
                <span>Identifiant Carte</span>
              </span>
              <span className="font-mono font-bold text-slate-200 text-xs">
                {verification.card_identifier}
              </span>
            </div>

            {/* Type de Compte */}
            <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Award size={14} className="text-stone-500" />
                <span>Type de Compte</span>
              </span>
              <span className="font-bold text-blue-400 text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                {verification.account_type || 'Bronze'}
              </span>
            </div>

            {/* Date d'Expiration */}
            <div className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <span className="text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-2 shrink-0">
                <Calendar size={14} className="text-stone-500" />
                <span>Expiration</span>
              </span>
              <span className="font-bold text-white text-xs">
                {formatDateFr(verification.expires_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
