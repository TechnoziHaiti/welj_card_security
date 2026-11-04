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
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdminSidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
}

export function AdminSidebar({ userEmail, userName, userRole }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    {
      label: 'Tableau de bord',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
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
      label: 'Historique des vérifications',
      href: '/admin/history',
      icon: History,
    },
  ];

  return (
    <aside className="w-64 bg-emerald-900 text-white flex flex-col min-h-screen shrink-0 shadow-lg">
      {/* Brand Header */}
      <div className="p-6 border-b border-emerald-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-emerald-200">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight leading-none text-white">
            WELJ EXPRESS
          </h1>
          <span className="text-xs text-emerald-300 font-medium tracking-wider uppercase">
            Card Security
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
          Administration
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-emerald-300' : 'text-emerald-300/70'} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-5 px-3 py-2 text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
          Accès Public
        </div>
        <Link
          href="/verify"
          target="_blank"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-3">
            <QrCode size={18} className="text-emerald-300/70" />
            <span>Vérificateur public</span>
          </div>
          <ExternalLink size={14} className="text-emerald-300/50" />
        </Link>
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-emerald-800 bg-emerald-950/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(userName || userEmail || 'W')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {userName || userEmail?.split('@')[0] || 'Administrateur'}
              </p>
              <p className="text-[11px] text-emerald-300 truncate capitalize">
                {userRole || 'Admin'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-200 bg-emerald-900/60 hover:bg-emerald-800 rounded-lg transition-colors border border-emerald-700/50"
        >
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
