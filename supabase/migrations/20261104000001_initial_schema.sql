-- ==============================================================================
-- PROJET : WELJ CARD SECURITY
-- Script de migration initiale PostgreSQL & Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE DES PROFILS UTILISATEURS (Lié à Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent')) DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger pour la mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger automatique lors de la création d'un utilisateur Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Agent Welj'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. COMPTEUR ATOMIQUE POUR LE CODE MEMBRE
CREATE TABLE IF NOT EXISTS public.member_code_counter (
    id INT PRIMARY KEY DEFAULT 1,
    last_sequence_number BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT single_counter_row CHECK (id = 1)
);

INSERT INTO public.member_code_counter (id, last_sequence_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Fonction de génération atomique et concurrente du code membre
-- Format : ANNÉE + NUMÉRO SÉQUENTIEL (ex: 20260001, 20260002 ... 202610000, 202710001)
CREATE OR REPLACE FUNCTION public.generate_next_member_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_seq BIGINT;
    current_year TEXT;
    generated_code TEXT;
BEGIN
    current_year := to_char(CURRENT_DATE, 'YYYY');

    -- Verrouillage exclusif au niveau de la ligne du compteur pour garantir l'atomicité
    UPDATE public.member_code_counter
    SET last_sequence_number = last_sequence_number + 1
    WHERE id = 1
    RETURNING last_sequence_number INTO next_seq;

    -- Format : Année + minimum 4 chiffres (ou plus si >= 10000)
    generated_code := current_year || LPAD(next_seq::text, 4, '0');

    RETURN generated_code;
END;
$$;

-- 4. TABLE DES MEMBRES
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('Standard', 'Premium', 'VIP', 'Entreprise')) DEFAULT 'Standard',
    status TEXT NOT NULL CHECK (status IN ('actif', 'inactif', 'suspendu')) DEFAULT 'actif',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_code ON public.members(member_code);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. TABLE DES CARTES
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    card_identifier TEXT UNIQUE NOT NULL,
    qr_token_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'expiree', 'revoquee', 'en_attente')) DEFAULT 'active',
    revoked_at TIMESTAMPTZ,
    renewed_from_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_member_id ON public.cards(member_id);
CREATE INDEX IF NOT EXISTS idx_cards_token_hash ON public.cards(qr_token_hash);
CREATE INDEX IF NOT EXISTS idx_cards_status ON public.cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_expires_at ON public.cards(expires_at);

-- 6. TABLE DES LOGS DE VÉRIFICATION
CREATE TABLE IF NOT EXISTS public.verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
    result TEXT NOT NULL CHECK (result IN ('valide', 'expiree', 'revoquee', 'inconnue')),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    token_hash_lookup TEXT NOT NULL,
    ip_address_hash TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_vlogs_card_id ON public.verification_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_vlogs_verified_at ON public.verification_logs(verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_vlogs_result ON public.verification_logs(result);

-- 7. FONCTION RPC DE VÉRIFICATION PUBLIQUE SÉCURISÉE (SECURITY DEFINER)
-- Cette fonction est la SEULE porte d'entrée pour la vérification publique des QR codes.
-- Elle ne divulgue JAMAIS les données sensibles ni les ID internes, et enregistre chaque tentative.
CREATE OR REPLACE FUNCTION public.verify_card_by_token(
    p_token_hash TEXT,
    p_ip_address_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_card RECORD;
    v_member RECORD;
    v_computed_status TEXT;
    v_result TEXT;
    v_response JSONB;
BEGIN
    -- 1. Recherche de la carte correspondante par son empreinte cryptographique
    SELECT c.id, c.member_id, c.card_identifier, c.created_at, c.expires_at, c.status, c.revoked_at
    INTO v_card
    FROM public.cards c
    WHERE c.qr_token_hash = p_token_hash
    LIMIT 1;

    -- Cas 1 : Token non trouvé dans le système
    IF NOT FOUND THEN
        v_result := 'inconnue';
        INSERT INTO public.verification_logs (card_id, result, token_hash_lookup, ip_address_hash, user_agent)
        VALUES (NULL, v_result, p_token_hash, p_ip_address_hash, p_user_agent);

        RETURN jsonb_build_object(
            'success', false,
            'result', 'inconnue',
            'message', 'Cette carte n''existe pas dans le système officiel de Welj.'
        );
    END IF;

    -- 2. Détermination dynamique du statut officiel
    IF v_card.status = 'revoquee' THEN
        v_computed_status := 'revoquee';
        v_result := 'revoquee';
    ELSIF v_card.status = 'en_attente' THEN
        v_computed_status := 'en_attente';
        v_result := 'revoquee'; -- Ne peut pas être vérifiée
    ELSIF NOW() > v_card.expires_at THEN
        v_computed_status := 'expiree';
        v_result := 'expiree';
    ELSE
        v_computed_status := 'active';
        v_result := 'valide';
    END IF;

    -- 3. Enregistrement automatique et atomique du log de vérification
    INSERT INTO public.verification_logs (card_id, result, token_hash_lookup, ip_address_hash, user_agent)
    VALUES (v_card.id, v_result, p_token_hash, p_ip_address_hash, p_user_agent);

    -- 4. Cas 2 : Carte révoquée
    IF v_computed_status = 'revoquee' THEN
        RETURN jsonb_build_object(
            'success', false,
            'result', 'revoquee',
            'message', 'Cette carte n''est plus autorisée.',
            'revoked_at', v_card.revoked_at
        );
    END IF;

    -- Récupération des informations du membre associé
    SELECT m.member_code, m.first_name, m.last_name, m.account_type, m.status AS member_status
    INTO v_member
    FROM public.members m
    WHERE m.id = v_card.member_id;

    -- Si le membre est désactivé ou suspendu, la carte n'est plus autorisée
    IF v_member.member_status <> 'actif' THEN
        RETURN jsonb_build_object(
            'success', false,
            'result', 'revoquee',
            'message', 'Le compte membre associé à cette carte n''est plus actif.'
        );
    END IF;

    -- Cas 3 : Carte expirée (affiche les détails minimaux du membre et la date d'expiration)
    IF v_computed_status = 'expiree' THEN
        RETURN jsonb_build_object(
            'success', false,
            'result', 'expiree',
            'message', 'Carte expirée.',
            'first_name', v_member.first_name,
            'last_name', v_member.last_name,
            'member_code', v_member.member_code,
            'expires_at', v_card.expires_at
        );
    END IF;

    -- Cas 4 : Carte Authentique et Active
    RETURN jsonb_build_object(
        'success', true,
        'result', 'valide',
        'message', 'Carte authentique.',
        'card_identifier', v_card.card_identifier,
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'member_code', v_member.member_code,
        'account_type', v_member.account_type,
        'created_at', v_card.created_at,
        'expires_at', v_card.expires_at
    );
END;
$$;

-- 8. FONCTION UTILITAIRE POUR CRÉER UN MEMBRE AVEC CODE ATOMIQUE
CREATE OR REPLACE FUNCTION public.create_member_atomic(
    p_first_name TEXT,
    p_last_name TEXT,
    p_account_type TEXT DEFAULT 'Standard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_member_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Génération atomique du code
    v_code := public.generate_next_member_code();

    INSERT INTO public.members (member_code, first_name, last_name, account_type, status)
    VALUES (v_code, TRIM(p_first_name), TRIM(p_last_name), p_account_type, 'actif')
    RETURNING id, created_at INTO v_member_id, v_created_at;

    RETURN jsonb_build_object(
        'id', v_member_id,
        'member_code', v_code,
        'first_name', TRIM(p_first_name),
        'last_name', TRIM(p_last_name),
        'account_type', p_account_type,
        'status', 'actif',
        'created_at', v_created_at
    );
END;
$$;

-- 9. SÉCURITÉ : ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_code_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- Helper pour vérifier le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Politiques Profiles
DROP POLICY IF EXISTS "Profiles consultables par utilisateurs authentifiés" ON public.profiles;
CREATE POLICY "Profiles consultables par utilisateurs authentifiés"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Modification du profil par admin" ON public.profiles;
CREATE POLICY "Modification du profil par admin"
ON public.profiles FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin');

-- Politiques Members
DROP POLICY IF EXISTS "Lecture des membres par utilisateurs authentifiés" ON public.members;
CREATE POLICY "Lecture des membres par utilisateurs authentifiés"
ON public.members FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Gestion des membres par admin" ON public.members;
CREATE POLICY "Gestion des membres par admin"
ON public.members FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

-- Politiques Cards
DROP POLICY IF EXISTS "Lecture des cartes par utilisateurs authentifiés" ON public.cards;
CREATE POLICY "Lecture des cartes par utilisateurs authentifiés"
ON public.cards FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Gestion des cartes par admin" ON public.cards;
CREATE POLICY "Gestion des cartes par admin"
ON public.cards FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

-- Politiques Verification Logs
DROP POLICY IF EXISTS "Lecture des logs par admin" ON public.verification_logs;
CREATE POLICY "Lecture des logs par admin"
ON public.verification_logs FOR SELECT
TO authenticated
USING (public.current_user_role() = 'admin');

-- Droit d'exécution de la RPC pour tout le monde (public anon et authentifié)
GRANT EXECUTE ON FUNCTION public.verify_card_by_token(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_member_atomic(TEXT, TEXT, TEXT) TO authenticated;
