-- ==============================================================================
-- UNIFICATION DU CODE CLIENT DANS LA BASE DE DONNÉES
-- Règle métier : Seuls deux codes sont conservés dans le système :
--   1. Le Code Client (saisi dès la création du membre, ex: CL-9824, RP861950)
--   2. Le Code de la Carte (ex: WELJ-RP861950 ou WELJ-20260001)
-- ==============================================================================

-- 1. Synchronisation rétroactive des enregistrements existants
UPDATE public.members
SET client_code = member_code
WHERE client_code IS NULL OR client_code = '';

UPDATE public.members
SET member_code = client_code
WHERE client_code IS NOT NULL AND client_code <> '' AND member_code <> client_code;

-- 2. Index d'unicité et de performance sur le code client
CREATE INDEX IF NOT EXISTS idx_members_client_code ON public.members(client_code);

-- 3. Mise à jour de la fonction atomique de création avec le code client explicite
CREATE OR REPLACE FUNCTION public.create_member_atomic(
    p_first_name TEXT,
    p_last_name TEXT,
    p_client_code TEXT,
    p_account_type TEXT DEFAULT 'Platinum'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    INSERT INTO public.members (member_code, client_code, first_name, last_name, account_type, status)
    VALUES (TRIM(p_client_code), TRIM(p_client_code), TRIM(p_first_name), TRIM(p_last_name), p_account_type, 'actif')
    RETURNING id, created_at INTO v_member_id, v_created_at;

    RETURN jsonb_build_object(
        'id', v_member_id,
        'member_code', TRIM(p_client_code),
        'client_code', TRIM(p_client_code),
        'first_name', TRIM(p_first_name),
        'last_name', TRIM(p_last_name),
        'account_type', p_account_type,
        'status', 'actif',
        'created_at', v_created_at
    );
END;
$$;
