-- ==============================================================================
-- PROJET : WELJ CARD SECURITY
-- DONNÉES DE DÉMONSTRATION & BENCHMARKS DE TEST (CLAIREMENT IDENTIFIÉES)
-- ==============================================================================
-- Ces données sont exclusivement destinées aux tests fonctionnels.
-- Elles couvrent tous les cas d'usage :
--   1. Carte Authentique et Active
--   2. Carte Expirée (dépassant 1 an)
--   3. Carte Révoquée / Annulée
--   4. Token Inconnu (test négatif automatique)
-- ==============================================================================

-- 1. Réinitialisation sécurisée des données de démonstration (optionnel)
-- DELETE FROM public.verification_logs;
-- DELETE FROM public.cards;
-- DELETE FROM public.members;
-- UPDATE public.member_code_counter SET last_sequence_number = 0 WHERE id = 1;

-- 2. Création de membres de test via la fonction atomique
-- Membre 1 : Alice N'Diaye (Compte VIP - Carte Active)
DO $$
DECLARE
    v_member_1_id UUID;
    v_member_2_id UUID;
    v_member_3_id UUID;
    
    -- Tokens bruts de démonstration (utilisables directement dans le vérificateur /verify/[token]) :
    -- Token 1 (Valide)   : 7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a
    -- Token 2 (Expiré)   : 1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff
    -- Token 3 (Révoqué)  : 9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa
    
    v_token_hash_1 TEXT;
    v_token_hash_2 TEXT;
    v_token_hash_3 TEXT;
BEGIN
    -- Calcul des empreintes SHA-256 des tokens bruts de démo
    v_token_hash_1 := encode(digest('7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a', 'sha256'), 'hex');
    v_token_hash_2 := encode(digest('1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff', 'sha256'), 'hex');
    v_token_hash_3 := encode(digest('9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa', 'sha256'), 'hex');

    -- Insertion Membre 1 (Actif)
    SELECT (public.create_member_atomic('Alice', 'N''Diaye', 'VIP'))->>'id' INTO v_member_1_id;

    -- Insertion Membre 2 (Titulaire de carte expirée)
    SELECT (public.create_member_atomic('Mamadou', 'Diallo', 'Premium'))->>'id' INTO v_member_2_id;

    -- Insertion Membre 3 (Titulaire de carte révoquée)
    SELECT (public.create_member_atomic('Benoit', 'Moreau', 'Standard'))->>'id' INTO v_member_3_id;

    -- 3. Insertion des cartes associées
    -- Carte 1 : ACTIVE (Valide 1 an à partir d'aujourd'hui)
    INSERT INTO public.cards (
        member_id,
        card_identifier,
        qr_token_hash,
        created_at,
        expires_at,
        status
    ) VALUES (
        v_member_1_id,
        'WELJ-2026-DEMO01',
        v_token_hash_1,
        NOW(),
        (NOW() + INTERVAL '1 year'),
        'active'
    ) ON CONFLICT (qr_token_hash) DO NOTHING;

    -- Carte 2 : EXPIRÉE (Créée il y a 14 mois)
    INSERT INTO public.cards (
        member_id,
        card_identifier,
        qr_token_hash,
        created_at,
        expires_at,
        status
    ) VALUES (
        v_member_2_id,
        'WELJ-2025-DEMO02',
        v_token_hash_2,
        (NOW() - INTERVAL '14 months'),
        (NOW() - INTERVAL '2 months'),
        'expiree'
    ) ON CONFLICT (qr_token_hash) DO NOTHING;

    -- Carte 3 : RÉVOQUÉE (Invalidée manuellement)
    INSERT INTO public.cards (
        member_id,
        card_identifier,
        qr_token_hash,
        created_at,
        expires_at,
        status,
        revoked_at
    ) VALUES (
        v_member_3_id,
        'WELJ-2026-DEMO03',
        v_token_hash_3,
        (NOW() - INTERVAL '3 months'),
        (NOW() + INTERVAL '9 months'),
        'revoquee',
        (NOW() - INTERVAL '1 month')
    ) ON CONFLICT (qr_token_hash) DO NOTHING;

END $$;

-- Vérification des données insérées
SELECT m.member_code, m.first_name, m.last_name, m.account_type, c.card_identifier, c.status, c.expires_at
FROM public.members m
JOIN public.cards c ON c.member_id = m.id
ORDER BY m.member_code;
