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
 * Génère un identifiant unique de carte au format d'entreprise WELJ-YYYYXXXX (ex: WELJ-20260001).
 * Si un code est fourni (ex: 20260001), l'utilise avec le préfixe WELJ-.
 */
export function generateCardIdentifier(code?: string | number, suffix?: string): string {
  const year = new Date().getFullYear();
  if (code) {
    const clean = String(code).replace(/^WELJ-?/i, '');
    return suffix ? `WELJ-${clean}-${suffix}` : `WELJ-${clean}`;
  }
  return `WELJ-${year}0001`;
}

/**
 * Hache une adresse IP pour des raisons de conformité et de confidentialité.
 */
export function hashIpAddress(ip?: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip + '-welj-salt').digest('hex').substring(0, 32);
}

/**
 * Génère un code de sécurité dynamique (TOTP / Anti-Screenshot)
 * qui change automatiquement toutes les 30 minutes de manière déterministe.
 * Empêche toute falsification par capture d'écran ou clone offline.
 */
export function generateDynamicSecurityCode(
  seed: string,
  intervalMinutes: number = 30
): { code: string; validUntil: string; remainingSeconds: number } {
  const windowMs = intervalMinutes * 60 * 1000;
  const now = Date.now();
  const timeWindow = Math.floor(now / windowMs);

  // Calcul d'un code HMAC / SHA-256 basé sur la tranche de temps de 30 min
  const rawHash = createHash('sha256')
    .update(`${seed}-welj-dynamic-window-${timeWindow}`)
    .digest('hex');

  // Extraction d'un code à 6 chiffres formaté : XXX-XXX
  const numPart = parseInt(rawHash.substring(0, 8), 16) % 1000000;
  const formattedCode = numPart.toString().padStart(6, '0');
  const displayCode = `${formattedCode.substring(0, 3)}-${formattedCode.substring(3, 6)}`;

  const nextWindowTime = (timeWindow + 1) * windowMs;
  const remainingSeconds = Math.max(0, Math.floor((nextWindowTime - now) / 1000));

  return {
    code: `WJ-${displayCode}`,
    validUntil: new Date(nextWindowTime).toISOString(),
    remainingSeconds,
  };
}
