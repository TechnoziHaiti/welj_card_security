'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, ExternalLink, QrCode as QrIcon } from 'lucide-react';
import { generateQrDataUrl, getVerificationUrl } from '@/lib/qr';
import { formatDateFr } from '@/lib/dates';
import { Card, Member } from '@/types/database';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  member?: Member | null;
  rawToken?: string | null;
}

export function QrCodeModal({ isOpen, onClose, card, member, rawToken }: QrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const verificationUrl = rawToken
    ? getVerificationUrl(rawToken)
    : card
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/verify?cardId=${card.card_identifier}`
    : '';

  useEffect(() => {
    if (!isOpen || (!rawToken && !card)) return;

    let isMounted = true;
    setLoading(true);

    const generate = async () => {
      try {
        const urlToEncode = rawToken ? getVerificationUrl(rawToken) : card?.card_identifier || '';
        const dataUrl = await generateQrDataUrl(urlToEncode, 450);
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erreur génération QR:', err);
        if (isMounted) setLoading(false);
      }
    };

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, card, rawToken]);

  if (!isOpen || !card) return null;

  const handleCopyLink = () => {
    if (verificationUrl) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${card.card_identifier}_${member ? `${member.first_name}_${member.last_name}` : 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-lg">
              <QrIcon size={20} className="text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">QR Code Officiel Welj</h3>
              <p className="text-xs text-emerald-200 font-mono">{card.card_identifier}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center">
          {member && (
            <div className="mb-4 text-center">
              <h4 className="text-lg font-bold text-slate-800">
                {member.first_name} {member.last_name}
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Code Membre : <span className="font-semibold text-emerald-700">{member.member_code}</span>
              </p>
            </div>
          )}

          {/* QR Code Container */}
          <div className="relative mx-auto my-3 w-64 h-64 bg-slate-50 border-2 border-emerald-100 rounded-2xl p-3 flex items-center justify-center shadow-inner">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Génération du QR Code...</span>
              </div>
            ) : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR Code ${card.card_identifier}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-xs text-rose-500">Erreur lors de la génération du QR</p>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-500 flex justify-center gap-4">
            <span>Créée le : <strong>{formatDateFr(card.created_at)}</strong></span>
            <span>Expire le : <strong>{formatDateFr(card.expires_at)}</strong></span>
          </div>

          {rawToken ? (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-left">
              <p className="text-[11px] text-amber-800 leading-tight">
                <strong>Attention sécurité :</strong> Le token brut est affiché uniquement à la création. Téléchargez le QR code dès maintenant pour l&apos;impression.
              </p>
            </div>
          ) : (
            <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-left">
              <p className="text-[11px] text-slate-600 leading-tight">
                Empreinte cryptographique : <span className="font-mono text-[10px] break-all">{card.qr_token_hash.substring(0, 24)}...</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl || loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              <Download size={16} />
              <span>Télécharger le QR Code (PNG Haute Définition)</span>
            </button>

            {verificationUrl && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Lien copié !' : 'Copier l\'URL'}</span>
                </button>

                {rawToken && (
                  <a
                    href={verificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>Tester le lien</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
