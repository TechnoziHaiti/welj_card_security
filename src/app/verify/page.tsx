'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  QrCode,
  Camera,
  Search,
  ArrowRight,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

export default function PublicVerifyPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(true);
  const scannerRef = useRef<unknown>(null);

  // Parse token if full URL pasted
  const extractToken = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.includes('/verify/')) {
      const parts = trimmed.split('/verify/');
      return parts[parts.length - 1].split('?')[0].split('#')[0];
    }
    return trimmed;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(tokenInput);
    if (!token) {
      setError('Veuillez entrer un token ou un lien de vérification valide.');
      return;
    }
    setError('');
    router.push(`/verify/${encodeURIComponent(token)}`);
  };

  // Gestion du scanner de caméra
  useEffect(() => {
    if (!isScanning) return;

    let html5QrCodeScanner: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCodeScanner = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCodeScanner;

        await html5QrCodeScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            // Lecture réussie
            const token = extractToken(decodedText);
            if (html5QrCodeScanner) {
              html5QrCodeScanner.stop().catch(() => {});
            }
            router.push(`/verify/${encodeURIComponent(token)}`);
          },
          () => {
            // Callback d'erreur sur chaque frame vide (ignoré)
          }
        );
      } catch (err) {
        console.error('Erreur caméra:', err);
        setScannerSupported(false);
        setIsScanning(false);
        setError('Impossible d\'accéder à la caméra. Vérifiez les permissions de votre navigateur.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        (scannerRef.current as any).stop().catch(() => {});
      }
    };
  }, [isScanning, router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-white">
      <div className="w-full max-w-md">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl p-3 shadow-lg mb-3 ring-4 ring-emerald-500/20">
            <Image
              src="/logo.png"
              alt="Welj Express Services"
              width={160}
              height={70}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            WELJ EXPRESS SERVICES
          </h1>
          <p className="text-xs text-emerald-300 font-medium tracking-wide uppercase mt-1">
            Vérificateur officiel d&apos;authenticité de cartes
          </p>
        </div>

        {/* Card Conteneur */}
        <div className="bg-white text-slate-800 rounded-3xl shadow-2xl p-6 border border-slate-100">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Contrôle de conformité
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scannez le QR Code officiel présent sur la carte ou saisissez manuellement son identifiant.
            </p>
          </div>

          {/* Option 1: Scanner Caméra */}
          <div className="mb-5">
            {!isScanning ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsScanning(true);
                }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-all shadow-md group"
              >
                <div className="p-2 bg-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                  <Camera size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <span className="block font-bold">Scanner avec l&apos;appareil photo</span>
                  <span className="block text-[11px] text-emerald-200 font-normal">
                    Lecture instantanée du QR Code physique
                  </span>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-900 p-3 text-center">
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden" />
                <button
                  type="button"
                  onClick={() => {
                    if (scannerRef.current) {
                      (scannerRef.current as any).stop().catch(() => {});
                    }
                    setIsScanning(false);
                  }}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Fermer la caméra
                </button>
              </div>
            )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase tracking-wider font-semibold">
              Ou saisie directe
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Option 2: Entrée manuelle */}
          <form onSubmit={handleManualSubmit} className="mt-3 space-y-3">
            <div>
              <label htmlFor="tokenInput" className="block text-xs font-medium text-slate-700 mb-1">
                Token ou lien de vérification
              </label>
              <div className="relative">
                <input
                  id="tokenInput"
                  type="text"
                  placeholder="Collez le token ou l'URL complète..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
                  aria-label="Vérifier"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </form>

          {/* Consignes de sécurité officielles */}
          <div className="mt-5 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 mb-1.5">
              <ShieldCheck size={15} className="text-emerald-700 shrink-0" />
              Consignes Officielles de Sécurité Welj
            </h3>
            <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside leading-relaxed">
              <li>
                <strong>Scanner officiel étanche :</strong> Ce scanner interroge directement le registre Supabase et neutralise toute tentative de faux site ou clone externe.
              </li>
              <li>
                <strong>Vérification physique :</strong> Contrôlez que le Nom et la Date d&apos;expiration sur cet écran correspondent à la carte Badgy.
              </li>
              <li>
                <strong>Code dynamique 30 min :</strong> Le code et l&apos;horloge en direct certifient la fraîcheur du contrôle à la seconde près.
              </li>
            </ul>
          </div>
        </div>

        {/* Lien de retour et mention légale */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Accès Espace Administrateur</span>
          </Link>
          <p className="text-[10px] text-emerald-400 font-mono mt-1">
            Welj Express Services &bull; Module de sécurité v1.0
          </p>
        </div>
      </div>
    </main>
  );
}
