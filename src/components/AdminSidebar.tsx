'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  History,
  QrCode,
  LogOut,
  KeyRound,
  Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdminSidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  onNavigate?: () => void;
}

export function AdminSidebar({ userEmail, userName, userRole, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = userRole === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Les agents ont accès au tableau de bord, au scanner, à la consultation des membres, cartes et historique.
  // SEUL l'administrateur a accès à "Gestion des Accès" (/admin/users).
  const navItems = [
    {
      label: 'Tableau de bord',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Scanner de Cartes (Direct)',
      href: '/verify',
      icon: QrCode,
    },
    {
      label: 'Membres',
      href: '/admin/members',
      icon: Users,
    },
    {
      label: 'Cartes Welj',
      href: '/admin/cards',
      icon: CreditCard,
    },
    {
      label: 'Historique des Scan',
      href: '/admin/history',
      icon: History,
    },
    ...(isAdmin
      ? [
          {
            label: 'Gestion des Accès',
            href: '/admin/users',
            icon: KeyRound,
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 h-full bg-black text-white flex flex-col shrink-0 border-r border-neutral-900 shadow-2xl select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-neutral-900 shrink-0">
        <Link href="/admin/dashboard" onClick={() => onNavigate?.()} className="block group">
          <span className="text-sm font-black tracking-wider text-white uppercase block leading-snug group-hover:text-emerald-400 transition-colors">
            WELJ EXPRESS SERVICES
          </span>
        </Link>
      </div>

      {/* Navigation avec scroll interne si nécessaire */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          {isAdmin ? 'Administration' : 'Espace Contrôle'}
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info & Logout fixé en bas */}
      <div className="p-4 border-t border-neutral-900 bg-black shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
              isAdmin ? 'bg-[#16a34a]' : 'bg-slate-700 border border-slate-600'
            }`}>
              {(userName || userEmail || 'W')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {userName || userEmail?.split('@')[0] || (isAdmin ? 'Administrateur' : 'Agent')}
              </p>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                {isAdmin ? (
                  <span className="text-emerald-400 font-medium">Administrateur</span>
                ) : (
                  <span className="text-slate-300 font-medium">Agent de Contrôle</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 bg-neutral-950 hover:bg-neutral-900 hover:text-white rounded-xl transition-colors border border-neutral-800 cursor-pointer"
        >
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
