import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  QrCode,
  Lock,
  CheckCircle2,
  Calendar,
  Users,
  Shield,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-emerald-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 border border-emerald-600/50 flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight block leading-tight">
                WELJ EXPRESS SERVICES
              </span>
              <span className="text-[11px] text-emerald-300 font-medium tracking-wider uppercase">
                Card Security System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors border border-emerald-600/40"
            >
              <QrCode size={15} />
              <span>Vérificateur Public</span>
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold transition-colors shadow-sm"
            >
              <Lock size={14} />
              <span>Espace Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wide uppercase mb-4 ring-1 ring-emerald-600/20">
              <Shield size={14} />
              Portail Officiel de Gestion &amp; Contrôle
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Gestion et Vérification Sécurisée des Cartes <span className="text-emerald-700">Welj Express</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">
              Délivrance de cartes avec QR Codes uniques cryptographiquement scellés,
              attribution atomique de codes membres et vérification instantanée en temps réel par les agents de terrain.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/verify"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <QrCode size={18} />
                <span>Vérifier une carte officielle</span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-300 shadow-sm transition-all"
              >
                <Lock size={16} className="text-emerald-700" />
                <span>Connexion Administrateur</span>
              </Link>
            </div>
          </div>

          {/* Pillars Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <QrCode size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                QR Codes Scellés (SHA-256)
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chaque carte génère un token aléatoire haute entropie dont seule l&apos;empreinte cryptographique est stockée en base. Impossible à falsifier ou deviner.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <Users size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Code Membre Atomique
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Structure <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">ANNÉE + SÉQUENCE</code> continue sans remise à zéro, gérée de manière concurrente et atomique dans PostgreSQL.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <Calendar size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Validité 1 An &amp; Audit Logs
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Expiration calculée au jour anniversaire à 23:59:59 avec gestion des années bissextiles. Révocation immédiate et traçabilité intégrale de chaque scan.
              </p>
            </div>
          </div>

          {/* Engagement de conformité */}
          <div className="mt-12 bg-emerald-900 text-white rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Protection et Confidentialité des Données</h3>
              <p className="text-xs text-emerald-200 max-w-2xl leading-relaxed">
                Welj Card Security applique le principe de minimisation des données : aucune photo ni biométrie de membre n&apos;est collectée ou enregistrée. Seules les données administratives nécessaires sont conservées.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-200">
                Architecture Zero-Trust
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} Welj Express Services. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/verify" className="hover:text-emerald-700 transition-colors">
              Vérificateur public
            </Link>
            <Link href="/login" className="hover:text-emerald-700 transition-colors">
              Espace Administrateur
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
