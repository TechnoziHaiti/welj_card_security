// Scanner officiel de vérification des cartes Welj
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Keyboard,
  ArrowRight,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ScanLine,
} from 'lucide-react';

export default function PublicVerifyPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  // La caméra est activée automatiquement dès l'ouverture de la page
  const [isScanning, setIsScanning] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const scannerRef = useRef<any>(null);

  // Arrêt sécurisé du scanner sans déclencher d'exception html5-qrcode
  const safeStopScanner = async (scanner: any) => {
    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      // 2 = SCANNING, 3 = PAUSED dans html5-qrcode
      if (state === 2 || state === 3 || scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Ignorer sans planter si le scanner était déjà arrêté
    }
  };

  // Parse token if full URL pasted or read by camera
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

  // Démarrage automatique de la caméra au chargement
  useEffect(() => {
    if (!isScanning || manualMode) return;

    let html5QrCodeScanner: any = null;
    let isMounted = true;
    setCameraLoading(true);

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        html5QrCodeScanner = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCodeScanner;

        await html5QrCodeScanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          async (decodedText: string) => {
            // Scan réussi : petite vibration tactile si supportée
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(100);
              } catch {}
            }

            const token = extractToken(decodedText);
            const scanner = scannerRef.current;
            scannerRef.current = null;
            await safeStopScanner(scanner);
            router.push(`/verify/${encodeURIComponent(token)}`);
          },
          () => {
            // frame vide
          }
        );

        if (!isMounted) {
          await safeStopScanner(html5QrCodeScanner);
          return;
        }

        setCameraLoading(false);
      } catch (err) {
        console.error('Erreur caméra:', err);
        if (isMounted) {
          setCameraLoading(false);
          setIsScanning(false);
          setManualMode(true);
          setError('Caméra non disponible ou permission refusée. Utilisez la saisie manuelle ci-dessous.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      safeStopScanner(scanner);
    };
  }, [isScanning, manualMode, router]);

  return (
    <main className="min-h-screen bg-[#010101] relative overflow-hidden flex flex-col items-center justify-center p-3 sm:p-6 text-white selection:bg-blue-600 selection:text-white">
      {/* Halo lumineux ambiant bleu nuit / noir */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-to-b from-blue-600/20 via-blue-900/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-t from-blue-950/25 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* En-tête épuré */}
        <div className="text-center mb-5 sm:mb-7">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Scanner Officiel de Cartes
          </h1>
        </div>

        {/* Conteneur Scanner Principal en verre sombre bleu nuit */}
        <div className="bg-[#0b1329]/90 backdrop-blur-xl text-white rounded-3xl shadow-2xl p-5 sm:p-6 border border-slate-800/80">
          {!manualMode ? (
            <div>
              <div className="text-center mb-4">
                <p className="text-xs text-slate-400">
                  Placez le QR Code de la carte Badgy devant votre appareil photo.
                </p>
              </div>

              {/* Viseur Caméra Automatique Haute Précision */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-square flex items-center justify-center">
                {cameraLoading && (
                  <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center gap-3 text-white">
                    <Loader2 size={34} className="animate-spin text-blue-400" />
                    <span className="text-xs font-semibold text-blue-200">
                      Activation automatique de la caméra...
                    </span>
                  </div>
                )}

                <div id="qr-reader" className="w-full h-full object-cover" />

                {/* Laser de scan animé stylisé */}
                {!cameraLoading && (
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-blue-400 shadow-[0_0_14px_#38bdf8] z-10 pointer-events-none animate-pulse" />
                )}
              </div>

              {/* Bouton bascule vers saisie manuelle si besoin */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    const scanner = scannerRef.current;
                    scannerRef.current = null;
                    await safeStopScanner(scanner);
                    setManualMode(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  <Keyboard size={14} />
                  <span>Saisir le code manuellement au clavier</span>
                </button>
              </div>
            </div>
          ) : (
            /* Mode Saisie Manuelle de secours */
            <div>
              <div className="text-center mb-4">
                <h2 className="text-base font-bold text-white">
                  Saisie manuelle du token
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Entrez le code ou le lien de la carte.
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label htmlFor="tokenInput" className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Token ou Lien complet
                  </label>
                  <div className="relative">
                    <input
                      id="tokenInput"
                      type="text"
                      autoFocus
                      placeholder="Collez le token ou l'URL..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      aria-label="Vérifier"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setManualMode(false);
                      setIsScanning(true);
                      setError('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-950/50"
                  >
                    <Camera size={14} />
                    <span>Réactiver la caméra automatique</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {error && (
            <div className="mt-3.5 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}


        </div>

        {/* Accès Administration */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Accès Espace Administrateur</span>
          </Link>
          <p className="text-[10px] text-slate-500 font-mono">
            Welj Express Services &bull; Module de Sécurité v1.0
          </p>
        </div>
      </div>
    </main>
  );
}
