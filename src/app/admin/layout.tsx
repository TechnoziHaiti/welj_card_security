import React from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null = null;
  let userName: string | null = null;
  let userRole: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userEmail = user.email || null;
      userName = user.user_metadata?.full_name || null;
      userRole = user.user_metadata?.role || 'admin';
    }
  } catch (err) {
    // Si Supabase n'est pas encore initialisé localement
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar verte corporate */}
      <AdminSidebar
        userEmail={userEmail}
        userName={userName}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
