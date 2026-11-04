import { createHash, randomBytes } from 'crypto';

/**
 * Génère un token cryptographiquement sécurisé pour le QR Code.
 * Ne contient aucune information lisible ou séquentielle.
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Calcule l'empreinte SHA-256 d'un token.
 * C'est cette empreinte qui est stockée en base de données.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Génère un identifiant unique de carte au format d'entreprise WELJ-YYYY-XXXX.
 */
export function generateCardIdentifier(): string {
  const year = new Date().getFullYear();
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
  return `WELJ-${year}-${randomSuffix}`;
}

/**
 * Hache une adresse IP pour des raisons de conformité et de confidentialité.
 */
export function hashIpAddress(ip?: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip + '-welj-salt').digest('hex').substring(0, 32);
}
