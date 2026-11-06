import React from 'react';
import { AdminLayoutShell } from '@/components/AdminLayoutShell';
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
    <AdminLayoutShell
      userEmail={userEmail}
      userName={userName}
      userRole={userRole}
    >
      {children}
    </AdminLayoutShell>
  );
}
