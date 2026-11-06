'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, CheckCircle2, QrCode as QrIcon } from 'lucide-react';
import { generateQrDataUrl, getVerificationUrl } from '@/lib/qr';
import { Card, Member } from '@/types/database';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  member?: Member | null;
  rawToken?: string | null;
}

export function QrCodeModal({ isOpen, onClose, card, member, rawToken }: QrCodeModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [showQrPreview, setShowQrPreview] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://weljcard.vercel.app';

  const verificationUrl = rawToken
    ? `${baseUrl}/verify/${encodeURIComponent(rawToken.trim())}`
    : card
    ? `${baseUrl}/verify/${encodeURIComponent(card.card_identifier)}`
    : '';

  useEffect(() => {
    if (showQrPreview && !qrDataUrl && verificationUrl) {
      generateQrDataUrl(verificationUrl, 250)
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [showQrPreview, qrDataUrl, verificationUrl]);

  if (!isOpen || !card) return null;

  const handleCopyLink = () => {
    if (verificationUrl) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-300 text-slate-900">
        {/* En-tête simplifié */}
        <div className="bg-stone-50 p-5 flex items-center justify-between border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-200 shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Carte créée avec succès !
              </h3>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                {member ? `${member.first_name} ${member.last_name}` : 'Nouveau titulaire'} &bull; Identifiant : <strong className="text-blue-600">{card.card_identifier}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps épuré et centré sur le lien Badgy */}
        <div className="p-6 space-y-5">
          {/* Bloc Lien pour Badgy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Lien à placer sous le QR Code sur Badgy :
              </label>
              {copied && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fadeIn">
                  ✓ Copié dans le presse-papier !
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={verificationUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 px-3.5 py-3 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-2 transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer"
              >
                {copied ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                <span>{copied ? 'Copié !' : 'Copier le lien'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Collez ce lien directement sous le QR Code de votre maquette dans le logiciel d&apos;impression Badgy.
            </p>
          </div>

          {/* Options secondaires discrètes */}
          <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              {verificationUrl && (
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>Tester le lien</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowQrPreview(!showQrPreview)}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <QrIcon size={13} />
                <span>{showQrPreview ? 'Masquer l\'image QR' : 'Aperçu QR (optionnel)'}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 font-semibold transition-colors border border-stone-300 cursor-pointer"
            >
              Terminer
            </button>
          </div>

          {/* Aperçu QR rétractable si jamais nécessaire */}
          {showQrPreview && qrDataUrl && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center animate-fadeIn">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR ${card.card_identifier}`}
                className="w-36 h-36 mx-auto rounded-lg bg-white p-1 border border-stone-300"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {card.card_identifier}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
