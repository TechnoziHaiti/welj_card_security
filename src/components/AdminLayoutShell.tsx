'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';

interface AdminLayoutShellProps {
  children: React.ReactNode;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
}

export function AdminLayoutShell({
  children,
  userEmail,
  userName,
  userRole,
}: AdminLayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Fermer automatiquement le menu mobile lors d'un changement de page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fermer avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Empêcher le scroll d'arrière-plan quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isAdmin = userRole === 'admin';
  const initial = (userName || userEmail || 'W')[0].toUpperCase();

  return (
    <div className="h-screen w-full bg-black flex overflow-hidden relative">
      {/* 1. Sidebar Desktop : fixe à gauche, masquée sur mobile (< md) */}
      <div className="hidden md:flex h-full shrink-0">
        <AdminSidebar
          userEmail={userEmail}
          userName={userName}
          userRole={userRole}
        />
      </div>

      {/* 2. Menu Mobile Drawer : Tiroir coulissant avec fond flouté */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" aria-modal="true" role="dialog">
          {/* Arrière-plan sombre avec effet de flou */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panneau latéral mobile */}
          <div className="relative z-10 w-72 max-w-[85vw] h-full flex flex-col bg-black shadow-2xl animate-in slide-in-from-left duration-200 border-r border-neutral-900">
            {/* Bouton de fermeture mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-3.5 z-20 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>

            <AdminSidebar
              userEmail={userEmail}
              userName={userName}
              userRole={userRole}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 3. Conteneur principal avec header mobile sticky */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#FAFAFF] text-slate-900">
        {/* Header Mobile : visible uniquement sur mobile (< md) */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black text-white border-b border-neutral-900 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              aria-label="Ouvrir le menu de navigation"
            >
              <Menu size={22} />
            </button>
            <span className="text-xs font-black tracking-wider uppercase text-white">
              WELJ EXPRESS SERVICES
            </span>
          </div>

          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
              isAdmin ? 'bg-[#16a34a]' : 'bg-slate-700'
            }`}
          >
            {initial}
          </div>
        </header>

        {/* Zone de contenu des pages */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
