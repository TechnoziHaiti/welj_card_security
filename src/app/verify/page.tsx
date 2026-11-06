// Scanner officiel de vérification des cartes Welj
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  AlertCircle,
  ArrowLeft,
  Loader2,
  LogOut,
  Upload,
  Search,
  CheckCircle2,
  RefreshCw,
  SwitchCamera,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes d'inactivité

// Réhausseur dynamique de contraste (histogram stretching) pour décoder les QR codes dans le noir ou avec reflets
function enhanceLuminance(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 8) {
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }

    const range = max - min;
    if (range < 12 || range > 215) return;

    const scale = 255 / range;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      const v = Math.min(255, Math.max(0, (lum - min) * scale));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {}
}

export default function PublicVerifyPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [processingScan, setProcessingScan] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [cameraList, setCameraList] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [screenTorch, setScreenTorch] = useState<boolean>(false);

  const scannerRef = useRef<any>(null);
  const isRedirectingRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeIntervalsRef = useRef<any[]>([]);
  const activeZxingsRef = useRef<any[]>([]);

  // Rafraîchir l'horodatage d'activité utilisateur (30 minutes)
  const refreshActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (typeof document !== 'undefined') {
      document.cookie = `welj_last_activity=${now}; path=/; max-age=1800; SameSite=Lax`;
    }
  }, []);

  // Détection des caméras physiques disponibles (pour PC multi-webcams ou smartphones)
  useEffect(() => {
    let isMounted = true;
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (isMounted && devices && devices.length > 0) {
              // Filtrer pour écarter les caméras IR / virtuelles (ex: Windows Hello IR) si d'autres webcams existent
              const filtered = devices.filter((d) => {
                const lbl = (d.label || '').toLowerCase();
                return !lbl.includes('ir ') && !lbl.includes('infrared') && !lbl.includes('virtual');
              });
              const usable = filtered.length > 0 ? filtered : devices;
              setCameraList(usable);

              const isMobile =
                typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

              setActiveCameraId((prev) => {
                if (prev) return prev;
                if (isMobile) {
                  const rearCam = usable.find((d) => {
                    const l = (d.label || '').toLowerCase();
                    return l.includes('back') || l.includes('rear') || l.includes('arrière') || l.includes('environment');
                  });
                  return rearCam ? rearCam.id : usable[usable.length - 1].id;
                }
                // Sur PC : toujours la première webcam (RGB normale)
                return usable[0].id;
              });
            }
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Bascule entre les caméras disponibles
  const handleSwitchCamera = async () => {
    if (cameraList.length <= 1) return;
    setError('');
    setIsScanning(true);
    setCameraLoading(true);

    if (scannerRef.current) {
      await safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    }

    const currentIndex = cameraList.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameraList.length;
    setActiveCameraId(cameraList[nextIndex].id);
  };

  // Résolution intelligente de l'URL cible selon le contenu du QR Code scanné
  const resolveTargetUrl = (raw: string): string => {
    const trimmed = raw.trim();

    // Cas 1 : Lien officiel de vérification Welj contenant "/verify/"
    const isWeljDomain =
      trimmed.startsWith('/') ||
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('192.168.') ||
      trimmed.includes('weljcard') ||
      trimmed.includes('welj');

    if (isWeljDomain && trimmed.includes('/verify/')) {
      const parts = trimmed.split('/verify/');
      const tokenCandidate = parts[parts.length - 1].split('?')[0].split('#')[0].trim();
      if (tokenCandidate) {
        return `/verify/${encodeURIComponent(tokenCandidate)}`;
      }
    }

    // Cas 2 : Lien externe avec paramètre user_id (ex: https://welj-ht.com/admin/shipments/search?user_id=33269)
    const userIdMatch = trimmed.match(/[?&]user_id=([a-zA-Z0-9_-]+)/i);
    if (userIdMatch && userIdMatch[1]) {
      return `/verify/${encodeURIComponent(userIdMatch[1])}?raw=${encodeURIComponent(trimmed)}`;
    }

    // Cas 3 : Identifiant direct de carte Welj (ex: WELJ-20260002, WELJ-RP861950)
    if (/^WELJ-[A-Z0-9_-]+$/i.test(trimmed)) {
      return `/verify/${encodeURIComponent(trimmed)}`;
    }

    // Cas 4 : Code Client direct (ex: RP861950, CL-9824, 20260001, 33269)
    if (/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      return `/verify/${encodeURIComponent(trimmed)}`;
    }

    // Cas 5 : Token cryptographique strict sans caractères spéciaux (hash SHA-256 ou token 32 car.)
    if (/^[a-fA-F0-9]{64}$/.test(trimmed) || /^[a-zA-Z0-9_-]{32}$/.test(trimmed)) {
      return `/verify/${encodeURIComponent(trimmed)}`;
    }

    // Cas 6 : N'importe quel autre lien ou code QR externe (ex: https://google.com, autre entreprise, menu, WiFi...)
    return `/verify/inconnue?raw=${encodeURIComponent(trimmed)}`;
  };

  // Traitement universel du code détecté (caméra, fichier ou saisie)
  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;

      setProcessingScan(true);
      refreshActivity();

      // Vibration haptique si supportée
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(100);
        } catch {}
      }

      // Mettre la caméra en pause immédiatement pour bloquer les scans ultérieurs
      try {
        if (scannerRef.current) {
          scannerRef.current.pause(true);
        }
      } catch {}

      const targetUrl = resolveTargetUrl(decodedText);

      // Redirection immédiate par assignation d'URL
      window.location.assign(targetUrl);
    },
    [refreshActivity]
  );

  // Arrêt sécurisé du scanner et de tous les moteurs de décodage
  const safeStopScanner = async (scanner: any) => {
    activeIntervalsRef.current.forEach((id) => clearInterval(id));
    activeIntervalsRef.current = [];
    activeZxingsRef.current.forEach((z) => {
      try {
        z.stopContinuousDecode?.();
        z.reset?.();
      } catch {}
    });
    activeZxingsRef.current = [];

    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      if (state === 2 || state === 3 || scanner.isScanning) {
        await scanner.stop();
      }
      if (typeof scanner.clear === 'function') {
        scanner.clear();
      }
    } catch {
      // Ignorer sans planter si déjà arrêté
    }
  };

  // Déconnexion manuelle
  const handleLogout = async () => {
    await safeStopScanner(scannerRef.current);
    const supabase = createClient();
    await supabase.auth.signOut();
    if (typeof document !== 'undefined') {
      document.cookie = 'welj_last_activity=; path=/; max-age=0; SameSite=Lax';
    }
    router.push('/login');
  };

  // 1. Vérification de l'authentification obligatoire pour le scanner
  useEffect(() => {
    const supabase = createClient();
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login?redirectTo=/verify');
          return;
        }
        setCurrentUser(user);
        setAuthChecking(false);
        refreshActivity();
      } catch {
        router.push('/login?redirectTo=/verify');
      }
    };

    checkAuth();
  }, [router, refreshActivity]);

  // 2. Gestion de l'inactivité de 30 minutes
  useEffect(() => {
    if (authChecking || !currentUser) return;

    const handleUserInteraction = () => {
      if (Date.now() - lastActivityRef.current > 10000) {
        refreshActivity();
      }
    };

    window.addEventListener('mousemove', handleUserInteraction, { passive: true });
    window.addEventListener('mousedown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });

    const interval = setInterval(async () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval);
        await safeStopScanner(scannerRef.current);
        const supabase = createClient();
        await supabase.auth.signOut();
        if (typeof document !== 'undefined') {
          document.cookie = 'welj_last_activity=; path=/; max-age=0; SameSite=Lax';
        }
        router.push('/login?reason=inactivity&redirectTo=/verify');
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      clearInterval(interval);
    };
  }, [authChecking, currentUser, refreshActivity, router]);

  // 3. Démarrage de la caméra uniquement après confirmation de l'authentification
  useEffect(() => {
    if (!isScanning || authChecking || !currentUser) return;

    let html5QrCodeScanner: any = null;
    let isMounted = true;
    let isStarting = true;
    setCameraLoading(true);

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        // Arrêter proprement un éventuel scanner précédent avant d'en créer un nouveau
        if (scannerRef.current) {
          await safeStopScanner(scannerRef.current);
          scannerRef.current = null;
        }

        const isMobile =
          typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // Déterminer la configuration caméra conforme aux règles strictes de html5-qrcode
        // (soit un ID de caméra sous forme de chaîne, soit un objet à clé unique { facingMode: "user" | "environment" })
        let targetConfig: string | { facingMode: string } = activeCameraId;
        if (!targetConfig) {
          targetConfig = isMobile ? { facingMode: 'environment' } : { facingMode: 'user' };
        }

        // Activation du scanner en mode haute sensibilité QR Code uniquement
        html5QrCodeScanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: [0], // 0 = Html5QrcodeSupportedFormats.QR_CODE uniquement (ignore les autres formats pour décoder 3x plus vite)
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        scannerRef.current = html5QrCodeScanner;

        const scanConfig = {
          fps: 24,
          disableFlip: false,
        };

        try {
          await html5QrCodeScanner.start(
            targetConfig,
            scanConfig,
            (decodedText: string) => {
              handleScanSuccess(decodedText);
            },
            () => {
              // Frame sans QR Code
            }
          );
        } catch (initialErr: any) {
          console.warn('Erreur caméra initiale, tentative avec le périphérique alternatif...', initialErr);

          // Secours 1 : Si un ID précis a échoué (ex: caméra IR / Windows Hello) et qu'on a une autre caméra
          if (cameraList.length > 1) {
            const altDevice = cameraList.find((d) => d.id !== activeCameraId);
            if (altDevice) {
              await safeStopScanner(html5QrCodeScanner);
              html5QrCodeScanner = new Html5Qrcode('qr-reader', {
                formatsToSupport: [0],
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                verbose: false,
              });
              scannerRef.current = html5QrCodeScanner;
              await html5QrCodeScanner.start(
                altDevice.id,
                scanConfig,
                (decodedText: string) => {
                  handleScanSuccess(decodedText);
                },
                () => {}
              );
              setActiveCameraId(altDevice.id);
              if (isMounted) {
                setCameraLoading(false);
                setError('');
              }
              return;
            }
          }

          // Secours 2 : Tenter avec facingMode 'user' générique
          await safeStopScanner(html5QrCodeScanner);
          html5QrCodeScanner = new Html5Qrcode('qr-reader', {
            formatsToSupport: [0],
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            verbose: false,
          });
          scannerRef.current = html5QrCodeScanner;
          await html5QrCodeScanner.start(
            { facingMode: 'user' },
            scanConfig,
            (decodedText: string) => {
              handleScanSuccess(decodedText);
            },
            () => {}
          );
        }

        isStarting = false;

        if (!isMounted) {
          await safeStopScanner(html5QrCodeScanner);
          return;
        }

        setCameraLoading(false);
        setError('');

        // Recherche de l'élément vidéo actif pour connecter le moteur d'accélération haute résolution
        setTimeout(async () => {
          if (!isMounted || isRedirectingRef.current) return;
          const videoElement = document.querySelector<HTMLVideoElement>('#qr-reader video');
          if (!videoElement) return;

          // Création d'un canvas de traitement haute sensibilité
          const workCanvas = document.createElement('canvas');
          workCanvas.width = 512;
          workCanvas.height = 512;
          const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

          // Chargement du moteur ZXing MultiFormatReader avec TRY_HARDER
          let zxingReader: any = null;
          let ZXingLib: any = null;
          try {
            const zxingRaw: any = await import('html5-qrcode/third_party/zxing-js.umd.js');
            ZXingLib = zxingRaw.default || zxingRaw;
            const hints = new Map();
            hints.set(ZXingLib.DecodeHintType.TRY_HARDER, true);
            hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, [ZXingLib.BarcodeFormat.QR_CODE]);
            zxingReader = new ZXingLib.MultiFormatReader();
            zxingReader.setHints(hints);
          } catch {}

          // Détecteur BarcodeDetector natif Chrome/Edge (GPU)
          let nativeDetector: any = null;
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            } catch {}
          }

          let tick = 0;
          const processInterval = setInterval(async () => {
            if (!isMounted || isRedirectingRef.current) {
              clearInterval(processInterval);
              return;
            }

            if (!videoElement || videoElement.readyState < 2 || !workCtx) return;
            const vw = videoElement.videoWidth;
            const vh = videoElement.videoHeight;
            if (vw <= 0 || vh <= 0) return;

            tick++;

            try {
              // Étape 1 : Zoom numérique 1.8x sur les 55% centraux (zone où se trouve la carte dans le viseur)
              const useCrop = tick % 3 !== 0; // 2 fois sur 3 = zoom central, 1 fois sur 3 = champ complet
              if (useCrop) {
                const cropW = Math.floor(vw * 0.55);
                const cropH = Math.floor(vh * 0.55);
                const cropX = Math.floor((vw - cropW) / 2);
                const cropY = Math.floor((vh - cropH) / 2);
                workCtx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, 512, 512);
              } else {
                workCtx.drawImage(videoElement, 0, 0, vw, vh, 0, 0, 512, 512);
              }

              // Test 1 : Détection immédiate sur le crop
              if (nativeDetector) {
                try {
                  const codes = await nativeDetector.detect(workCanvas);
                  if (codes && codes.length > 0 && codes[0].rawValue) {
                    clearInterval(processInterval);
                    handleScanSuccess(codes[0].rawValue);
                    return;
                  }
                } catch {}
              }

              // Test 2 : Réhaussement automatique du contraste (corrige les pièces sombres et les reflets)
              enhanceLuminance(workCtx, 512, 512);

              // Test 3 : Détecteur GPU sur l'image réhaussée
              if (nativeDetector) {
                try {
                  const codes = await nativeDetector.detect(workCanvas);
                  if (codes && codes.length > 0 && codes[0].rawValue) {
                    clearInterval(processInterval);
                    handleScanSuccess(codes[0].rawValue);
                    return;
                  }
                } catch {}
              }

              // Test 4 : Décodeur ZXing avec binarisation hybride robuste sur l'image réhaussée
              if (zxingReader && ZXingLib) {
                try {
                  const lumSource = new ZXingLib.HTMLCanvasElementLuminanceSource(workCanvas);
                  const bitmap = new ZXingLib.BinaryBitmap(new ZXingLib.HybridBinarizer(lumSource));
                  const decoded = zxingReader.decode(bitmap);
                  const text = decoded?.getText?.() || decoded?.text;
                  if (text) {
                    clearInterval(processInterval);
                    handleScanSuccess(text);
                    return;
                  }
                } catch {}
              }
            } catch {}
          }, 90);

          activeIntervalsRef.current.push(processInterval);
        }, 250);
      } catch (err: any) {
        isStarting = false;
        if (
          err?.name === 'AbortError' ||
          (typeof err?.message === 'string' &&
            (err.message.includes('play()') ||
              err.message.includes('pause()') ||
              err.message.includes('media was removed') ||
              err.message.includes('interrupted')))
        ) {
          return;
        }

        console.error('Erreur caméra:', err);
        if (isMounted) {
          setCameraLoading(false);
          setIsScanning(false);
          setError(
            'Caméra non disponible ou permission refusée. Vous pouvez autoriser la caméra, importer une image de QR Code, ou tester manuellement ci-dessous.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!isStarting) {
        safeStopScanner(scanner);
      }
    };
  }, [isScanning, authChecking, currentUser, activeCameraId, handleScanSuccess, cameraList]);

  // Scan d'une image téléversée (capture d'écran, photo de QR Code, etc.)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setError('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const fileScanner = new Html5Qrcode('qr-file-detector', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });

      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      handleScanSuccess(decodedText);
    } catch (err: any) {
      setFileScanning(false);
      setError(
        'Aucun QR Code lisible n\'a été détecté sur cette image. Veuillez importer une photo plus nette ou tester le lien manuellement.'
      );
    }
  };

  // Test manuel par saisie ou collage direct d'un lien / code
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    handleScanSuccess(val);
  };

  if (authChecking) {
    return (
      <main className="min-h-screen bg-[#010101] flex flex-col items-center justify-center p-6 text-white font-sans">
        <Loader2 size={36} className="animate-spin text-blue-500 mb-3" />
        <p className="text-xs text-slate-400 font-medium">Vérification de l&apos;accès au scanner...</p>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-3 sm:p-6 font-sans transition-colors duration-300 ${
        screenTorch ? 'bg-white text-slate-900' : 'bg-[#010101] text-white selection:bg-blue-600 selection:text-white'
      }`}
    >
      {/* Halo lumineux ambiant bleu nuit / noir (désactivé en mode torche) */}
      {!screenTorch && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-to-b from-blue-600/20 via-blue-900/10 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-t from-blue-950/25 to-transparent blur-3xl pointer-events-none" />
        </>
      )}

      {/* Conteneur caché pour le décodage d'image importée */}
      <div id="qr-file-detector" className="hidden" />

      <div className="relative z-10 w-full max-w-md">
        {/* En-tête épuré */}
        <div className="text-center mb-4 sm:mb-5">
          <h1
            className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
              screenTorch ? 'text-slate-900' : 'text-white'
            }`}
          >
            Scanner Officiel de Cartes
          </h1>
          <p className={`text-xs mt-1 ${screenTorch ? 'text-slate-600' : 'text-slate-400'}`}>
            Contrôle d&apos;authenticité et de validité Welj Express Services
          </p>
        </div>

        {/* Conteneur Scanner Principal en verre sombre bleu nuit */}
        <div className="bg-[#0b1329]/90 backdrop-blur-xl text-white rounded-3xl shadow-2xl p-5 sm:p-6 border border-slate-800/80 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-slate-300 font-medium">Viseur Caméra en Direct</span>
              <div className="flex items-center gap-2">
                {/* Bouton Torche Écran pour pièces sombres */}
                <button
                  type="button"
                  onClick={() => setScreenTorch(!screenTorch)}
                  className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    screenTorch
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                  }`}
                  title="Allume un fond blanc lumineux pour éclairer la carte dans l'obscurité"
                >
                  <span>💡 {screenTorch ? 'Torche Active' : 'Éclairer la carte'}</span>
                </button>

                {cameraList.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-blue-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    title="Changer de caméra"
                  >
                    <SwitchCamera size={13} />
                    <span>Changer ({cameraList.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Viseur Caméra Haute Précision - Conforme ratio natif sans déformation anamorphique */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-black min-h-[260px] sm:min-h-[290px] flex items-center justify-center shadow-inner">
              {cameraLoading && (
                <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center gap-3 text-white">
                  <Loader2 size={34} className="animate-spin text-blue-400" />
                  <span className="text-xs font-semibold text-blue-200">
                    Activation automatique de la caméra...
                  </span>
                </div>
              )}

              {/* Overlay de détection immédiate dès qu'un code est lu */}
              {processingScan && (
                <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center mb-3">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">QR Code détecté !</p>
                  <p className="text-xs text-blue-200">Vérification de la carte en cours...</p>
                </div>
              )}

              {/* Conteneur vidéo officiel */}
              <div id="qr-reader" className="w-full h-full" />

              {/* Cadre de visée dynamique centré */}
              {!cameraLoading && !processingScan && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
                  <div className="w-40 h-40 sm:w-44 sm:h-44 border-2 border-blue-400/50 rounded-2xl relative shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    {/* 4 coins de visée fluorescents */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                    {/* Laser de scan animé centré dans le viseur */}
                    <div className="laser-fluorescent-bar" />
                  </div>
                </div>
              )}
            </div>

            {/* Conseils pour mise au point optimale sur webcam PC */}
            <div className="bg-slate-900/60 rounded-xl p-2.5 mt-2.5 border border-slate-800 text-center">
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                💡 <span className="text-blue-300 font-bold">Conseil webcam PC :</span> Tenez la carte à environ <span className="text-white font-bold underline decoration-blue-400 underline-offset-2">25 à 35 cm</span> de la caméra.
                <br />
                <span className="text-slate-400 text-[10px]">
                  Les webcams de PC ont une mise au point fixe : si vous la tenez trop près (moins de 20 cm), le QR Code devient flou. Reculez-le légèrement pour qu&apos;il soit bien net !
                </span>
              </p>
            </div>
          </div>

          {/* Actions alternatives : Importer une image & Saisie manuelle */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              {/* Bouton Import Image */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={fileScanning || processingScan}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {fileScanning ? (
                  <Loader2 size={13} className="animate-spin text-blue-400" />
                ) : (
                  <Upload size={13} className="text-blue-400" />
                )}
                <span>{fileScanning ? 'Analyse image...' : 'Importer photo QR'}</span>
              </button>

              {/* Bouton Réactiver la caméra si erreur */}
              {error && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setCameraLoading(true);
                    if (cameraList.length > 0) {
                      setActiveCameraId(cameraList[0].id);
                    }
                    setIsScanning(true);
                  }}
                  className="inline-flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Relancer</span>
                </button>
              )}
            </div>

            {/* Formulaire de test manuel rapide */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ou collez un lien / code ici..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full pl-3 pr-2 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualInput.trim() || processingScan}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Tester
              </button>
            </form>
          </div>

          {error && (
            <div className="p-3 bg-transparent border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>

        {/* Contrôle de Session et Accès Administration */}
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            {currentUser?.user_metadata?.role === 'admin' ? (
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Espace Administration</span>
              </Link>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Session active &bull; Déconnexion auto (30m)
              </span>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Déconnexion</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 font-mono">
            Welj Express Services &bull; Module de Sécurité v1.0
          </p>
        </div>
      </div>
    </main>
  );
}
