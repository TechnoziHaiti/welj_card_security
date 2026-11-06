/**
 * Gestion du calcul des dates d'expiration et du formatage
 * Règle d'entreprise Welj : Une carte est valide exactement 1 an jusqu'à 23:59:59 de sa date anniversaire.
 */

export function calculateExpirationDate(createdDate: Date = new Date()): Date {
  const expires = new Date(createdDate);
  const startYear = expires.getUTCFullYear();
  const startMonth = expires.getUTCMonth(); // 0-indexed
  const startDay = expires.getUTCDate();

  // Année suivante
  const targetYear = startYear + 1;

  // Gestion des années bissextiles (29 février -> 28 février l'année suivante si non bissextile)
  if (startMonth === 1 && startDay === 29) {
    const isNextYearLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    if (!isNextYearLeap) {
      expires.setUTCFullYear(targetYear, 1, 28);
    } else {
      expires.setUTCFullYear(targetYear, 1, 29);
    }
  } else {
    expires.setUTCFullYear(targetYear, startMonth, startDay);
  }

  // La carte est valide jusqu'à la fin de la journée anniversaire
  expires.setUTCHours(23, 59, 59, 999);
  return expires;
}

export function isCardExpired(expiresAt: string | Date): boolean {
  const exp = new Date(expiresAt);
  return new Date() > exp;
}

/**
 * Calcule dynamiquement le statut officiel effectif d'une carte :
 * - Si le statut de la carte est "revoquee", la révocation est permanente.
 * - Si le membre rattaché ou la carte est suspendu, la carte affiche "suspendu".
 * - Si le membre rattaché ou la carte est inactif/désactivé, la carte affiche "inactif".
 * - Si la date d'expiration est dépassée (now > expires_at), la carte est "expiree".
 * - Sinon la carte est "active".
 */
export function getEffectiveCardStatus(
  card: {
    status?: string | null;
    expires_at: string | Date;
    members?: { status?: string | null } | null;
  },
  memberOverride?: { status?: string | null } | null
): 'active' | 'expiree' | 'revoquee' | 'suspendu' | 'inactif' | 'en_attente' {
  if (card.status === 'revoquee') return 'revoquee';

  const memberStatus = memberOverride?.status || card.members?.status;
  if (card.status === 'suspendu' || card.status === 'suspendue' || memberStatus === 'suspendu') {
    return 'suspendu';
  }

  if (card.status === 'inactif' || card.status === 'desactive' || memberStatus === 'inactif') {
    return 'inactif';
  }

  if (card.status === 'en_attente') return 'en_attente';
  if (isCardExpired(card.expires_at) || card.status === 'expiree') return 'expiree';
  return 'active';
}

export function isExpiringSoon(expiresAt: string | Date, daysThreshold: number = 30): boolean {
  const exp = new Date(expiresAt);
  const now = new Date();
  if (now > exp) return false; // Déjà expirée

  const diffTime = exp.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= daysThreshold;
}

export function formatDateFr(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Formatage court standardisé DD/MM/YYYY (ex: 03/11/2026) pour la maquette officielle de carte Welj
 */
export function formatDateShortFr(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTimeFr(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
