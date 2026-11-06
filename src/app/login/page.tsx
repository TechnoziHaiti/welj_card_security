'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  Scan,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/admin/dashboard';
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // Si déconnecté pour inactivité, nettoyer la session côté client
    if (reason === 'inactivity') {
      supabase.auth.signOut();
    }
  }, [reason, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        const userRole = data.user.user_metadata?.role;
        // Enregistrer l'activité initiale (1 heure = 3600 secondes)
        document.cookie = `welj_last_activity=${Date.now()}; path=/; max-age=3600; SameSite=Lax`;

        if (redirectTo && redirectTo !== '/login') {
          router.push(redirectTo);
        } else if (userRole === 'agent') {
          router.push('/verify');
        } else {
          router.push('/admin/dashboard');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Une erreur inattendue est survenue.');
      setLoading(false);
    }
  };

  const isScanningTarget = redirectTo.startsWith('/verify');

  return (
    <form className="space-y-5" onSubmit={handleLogin}>
      {isScanningTarget && (
        <div className="rounded-xl border border-blue-500/30 p-3.5 text-blue-300 text-xs font-medium text-center bg-transparent">
          Authentification requise pour activer et utiliser le scanner de cartes.
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
        >
          Adresse Email
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Mail size={17} />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="utilisateur@welj-express.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-black border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all [color-scheme:dark]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
        >
          Mot de Passe
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Lock size={17} />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-black border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all [color-scheme:dark]"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-950/50 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Authentification...</span>
            </>
          ) : isScanningTarget ? (
            <>
              <Scan size={17} />
              <span>Scanner carte</span>
            </>
          ) : (
            <>
              <span>Se connecter</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <div className="bg-white rounded-2xl px-6 py-3.5 shadow-2xl inline-flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="WELJ Express Services"
              width={160}
              height={70}
              className="h-11 sm:h-12 w-auto object-contain"
              priority
              unoptimized
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400 font-medium font-sans">
          Connexion sécurisée au registre officiel
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Suspense fallback={<div className="py-8 text-center text-xs text-slate-400">Chargement...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
