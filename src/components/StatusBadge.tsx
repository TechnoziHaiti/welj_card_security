import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { CardStatus, MemberStatus, VerificationResultType } from '@/types/database';

interface StatusBadgeProps {
  status: CardStatus | MemberStatus | VerificationResultType | string;
  expiresAt?: string | Date | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, expiresAt, size = 'md', showIcon = true }: StatusBadgeProps) {
  let effective = status;
  if (
    expiresAt &&
    effective !== 'revoquee' &&
    effective !== 'révoquée' &&
    new Date() > new Date(expiresAt)
  ) {
    effective = 'expiree';
  }

  const normalized = effective.toLowerCase();

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5 gap-1 font-bold',
    md: 'text-xs px-3 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-4 py-1.5 gap-2 font-bold',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  // Actif / Valide / Active (Vert Solide Vif)
  if (normalized === 'active' || normalized === 'actif' || normalized === 'valide') {
    return (
      <span className={`inline-flex items-center rounded-full bg-[#16a34a] text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <CheckCircle2 size={iconSizes[size]} className="text-white shrink-0" />}
        <span>{normalized === 'valide' ? 'Authentique' : normalized === 'active' ? 'Active' : 'Actif'}</span>
      </span>
    );
  }

  // Expirée (Ambre / Orange Solide)
  if (normalized === 'expiree' || normalized === 'expirée') {
    return (
      <span className={`inline-flex items-center rounded-full bg-amber-500 text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <Clock size={iconSizes[size]} className="text-white shrink-0" />}
        <span>Expirée</span>
      </span>
    );
  }

  // Suspendu / Suspendue (Rouge Solide Vif)
  if (normalized === 'suspendu' || normalized === 'suspendue') {
    return (
      <span className={`inline-flex items-center rounded-full bg-red-600 text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <ShieldAlert size={iconSizes[size]} className="text-white shrink-0" />}
        <span>Suspendu</span>
      </span>
    );
  }

  // Révoquée (Rouge Bordeaux / Foncé Solide)
  if (normalized === 'revoquee' || normalized === 'révoquée') {
    return (
      <span className={`inline-flex items-center rounded-full bg-rose-700 text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <ShieldAlert size={iconSizes[size]} className="text-white shrink-0" />}
        <span>Révoquée</span>
      </span>
    );
  }

  // Inconnue / Invalide (Rouge Solide)
  if (normalized === 'inconnue' || normalized === 'invalide') {
    return (
      <span className={`inline-flex items-center rounded-full bg-red-600 text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <XCircle size={iconSizes[size]} className="text-white shrink-0" />}
        <span>Non reconnue</span>
      </span>
    );
  }

  // En attente / Inactif / Désactivé (Pierre / Gris Foncé Solide)
  if (
    normalized === 'en_attente' ||
    normalized === 'inactif' ||
    normalized === 'desactive' ||
    normalized === 'désactivé'
  ) {
    return (
      <span className={`inline-flex items-center rounded-full bg-stone-600 text-white shadow-sm ${sizeClasses[size]}`}>
        {showIcon && <AlertTriangle size={iconSizes[size]} className="text-white shrink-0" />}
        <span>
          {normalized === 'desactive' || normalized === 'désactivé'
            ? 'Désactivé'
            : normalized === 'en_attente'
            ? 'En attente'
            : 'Inactif'}
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-stone-600 text-white shadow-sm ${sizeClasses[size]}`}>
      {status}
    </span>
  );
}
