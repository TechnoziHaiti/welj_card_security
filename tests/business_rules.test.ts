import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecureToken, hashToken, generateCardIdentifier } from '../src/lib/crypto.ts';
import { calculateExpirationDate, isCardExpired, isExpiringSoon, getEffectiveCardStatus } from '../src/lib/dates.ts';

test('1. Sécurité Cryptographique des Tokens QR', async (t) => {
  await t.test('Génération de tokens uniques haute entropie', () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    assert.equal(token1.length, 64, 'Token doit faire 64 caractères hex (32 octets)');
    assert.notEqual(token1, token2, 'Deux tokens générés successivement doivent être distincts');
  });

  await t.test('Hachage SHA-256 déterministe et conforme', () => {
    const rawToken = 'test-token-welj-card-2026';
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);

    assert.equal(hash1, hash2, 'Le hash doit être déterministe');
    assert.equal(hash1.length, 64, 'L\'empreinte SHA-256 fait 64 caractères hex');
    assert.notEqual(hash1, rawToken, 'L\'empreinte ne doit jamais exposer le token en clair');
  });

  await t.test('Format identifiant de carte d\'entreprise', () => {
    const cardId = generateCardIdentifier('20260001');
    const currentYear = new Date().getFullYear().toString();

    assert.equal(cardId, `WELJ-20260001`);
    assert.match(cardId, new RegExp(`^WELJ-${currentYear}\\d{4,}$`), 'Format WELJ-YYYYXXXX valide');
  });
});

test('2. Règle Métier d\'Expiration (1 an à 23:59:59)', async (t) => {
  await t.test('Calcul standard 1 an jusqu\'à la fin de la date anniversaire', () => {
    // Carte créée le 4 novembre 2026 à 14h30 UTC
    const creation = new Date('2026-11-04T14:30:00.000Z');
    const expires = calculateExpirationDate(creation);

    assert.equal(expires.getUTCFullYear(), 2027, 'Année + 1');
    assert.equal(expires.getUTCMonth(), 10, 'Novembre (10)');
    assert.equal(expires.getUTCDate(), 4, 'Jour anniversaire (4)');
    assert.equal(expires.getUTCHours(), 23, 'Fin de journée 23h');
    assert.equal(expires.getUTCMinutes(), 59, '59 minutes');
    assert.equal(expires.getUTCSeconds(), 59, '59 secondes');
  });

  await t.test('Gestion des années bissextiles (29 février)', () => {
    // 29 février 2024 -> 28 février 2025 (2025 non bissextile)
    const leapCreation = new Date('2024-02-29T10:00:00.000Z');
    const leapExpires = calculateExpirationDate(leapCreation);

    assert.equal(leapExpires.getUTCFullYear(), 2025);
    assert.equal(leapExpires.getUTCMonth(), 1, 'Février');
    assert.equal(leapExpires.getUTCDate(), 28, 'Reporté au 28 février');
    assert.equal(leapExpires.getUTCHours(), 23);
  });

  await t.test('Détection de carte expirée', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // hier
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // dans 10 jours

    assert.equal(isCardExpired(pastDate), true, 'Date passée doit être expirée');
    assert.equal(isCardExpired(futureDate), false, 'Date future ne doit pas être expirée');
  });

  await t.test('Détection carte expirant sous 30 jours', () => {
    const expiringIn15Days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15);
    const expiringIn60Days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);

    assert.equal(isExpiringSoon(expiringIn15Days, 30), true, 'Doit alerter sous 30 jours');
    assert.equal(isExpiringSoon(expiringIn60Days, 30), false, 'Pas d\'alerte à 60 jours');
  });

  await t.test('Statut effectif dynamique (getEffectiveCardStatus)', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // hier
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 300); // futur

    // Carte marquée "active" en DB mais dont la date d'expiration est dépassée -> doit être "expiree"
    assert.equal(getEffectiveCardStatus({ status: 'active', expires_at: pastDate }), 'expiree', 'Date passée => statut effectif "expiree"');
    assert.equal(getEffectiveCardStatus({ status: 'active', expires_at: futureDate }), 'active', 'Date future => statut effectif "active"');

    // Révocation permanente
    assert.equal(getEffectiveCardStatus({ status: 'revoquee', expires_at: pastDate }), 'revoquee', 'Carte révoquée reste révoquée');
    assert.equal(getEffectiveCardStatus({ status: 'revoquee', expires_at: futureDate }), 'revoquee', 'Carte révoquée reste révoquée');
  });
});

test('3. Structure du Code Membre et Continuité Séquentielle', async (t) => {
  await t.test('Formatage minimum 4 chiffres (ex: 20260001, 20269999, 202610000)', () => {
    const formatCode = (year: number, seq: number) => {
      return `${year}${seq.toString().padStart(4, '0')}`;
    };

    assert.equal(formatCode(2026, 1), '20260001');
    assert.equal(formatCode(2026, 2), '20260002');
    assert.equal(formatCode(2026, 9999), '20269999');
    assert.equal(formatCode(2026, 10000), '202610000');
    assert.equal(formatCode(2027, 10001), '202710001');
  });
});
