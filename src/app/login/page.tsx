'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

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
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Une erreur inattendue est survenue.');
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleLogin}>
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Adresse Email Administrateur
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail size={17} />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@welj-express.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Mot de Passe
        </label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
            className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-all disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Authentification...</span>
            </>
          ) : (
            <>
              <span>Se connecter au Dashboard</span>
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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 flex items-center justify-center text-white shadow-md group-hover:bg-emerald-700 transition-colors">
            <ShieldCheck size={28} />
          </div>
        </Link>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          WELJ EXPRESS SERVICES
        </h1>
        <p className="mt-1 text-xs text-emerald-800 font-semibold tracking-wider uppercase">
          Espace d&apos;Administration Sécurisé
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          <Suspense fallback={<div className="py-8 text-center text-xs text-slate-400">Chargement...</div>}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-[11px] text-slate-500">
              Accès strictement restreint aux membres du personnel habilité de Welj Express Services.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-800 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Retour au portail d&apos;accueil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
