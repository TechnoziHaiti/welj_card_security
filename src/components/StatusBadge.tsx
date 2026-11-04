import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { CardStatus, MemberStatus, VerificationResultType } from '@/types/database';

interface StatusBadgeProps {
  status: CardStatus | MemberStatus | VerificationResultType | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-3 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-4 py-1.5 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  // Actif / Valide / Active
  if (normalized === 'active' || normalized === 'actif' || normalized === 'valide') {
    return (
      <span className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25 ${sizeClasses[size]}`}>
        {showIcon && <CheckCircle2 size={iconSizes[size]} className="text-emerald-600" />}
        {normalized === 'valide' ? 'Authentique' : normalized === 'active' ? 'Active' : 'Actif'}
      </span>
    );
  }

  // Expirée
  if (normalized === 'expiree' || normalized === 'expirée') {
    return (
      <span className={`inline-flex items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25 ${sizeClasses[size]}`}>
        {showIcon && <Clock size={iconSizes[size]} className="text-amber-600" />}
        Expirée
      </span>
    );
  }

  // Révoquée / Suspendu
  if (normalized === 'revoquee' || normalized === 'révoquée' || normalized === 'suspendu') {
    return (
      <span className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/25 ${sizeClasses[size]}`}>
        {showIcon && <ShieldAlert size={iconSizes[size]} className="text-rose-600" />}
        {normalized === 'suspendu' ? 'Suspendu' : 'Révoquée'}
      </span>
    );
  }

  // Inconnue / Invalide
  if (normalized === 'inconnue' || normalized === 'invalide') {
    return (
      <span className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/25 ${sizeClasses[size]}`}>
        {showIcon && <XCircle size={iconSizes[size]} className="text-rose-600" />}
        Non reconnue
      </span>
    );
  }

  // En attente / Inactif
  if (normalized === 'en_attente' || normalized === 'inactif') {
    return (
      <span className={`inline-flex items-center rounded-full bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-300 ${sizeClasses[size]}`}>
        {showIcon && <AlertTriangle size={iconSizes[size]} className="text-stone-500" />}
        {normalized === 'en_attente' ? 'En attente' : 'Inactif'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-300 ${sizeClasses[size]}`}>
      {status}
    </span>
  );
}
