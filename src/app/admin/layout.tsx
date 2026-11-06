import React from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getCurrentUserRole } from '@/lib/auth-helpers';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, profile } = await getCurrentUserRole();

  const userEmail = user?.email || null;
  const userName = profile?.full_name || user?.user_metadata?.full_name || null;
  const userRole = role; // Strictement 'admin' ou 'agent'

  return (
    <div className="h-screen w-full bg-black flex overflow-hidden">
      {/* Sidebar noire pure */}
      <AdminSidebar
        userEmail={userEmail}
        userName={userName}
        userRole={userRole}
      />

      {/* Zone de contenu principal en blanc éclatant #FAFAFF avec scroll vertical indépendant */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#FAFAFF] text-slate-900">
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
