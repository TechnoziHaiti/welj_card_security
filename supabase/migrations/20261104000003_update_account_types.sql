-- Migration: Mettre à jour les types de comptes autorisés vers Platinum, Gold, Silver, Bronze
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_account_type_check;

ALTER TABLE public.members
    ADD CONSTRAINT members_account_type_check
    CHECK (account_type IN ('Platinum', 'Gold', 'Silver', 'Bronze', 'Standard', 'Premium', 'VIP', 'Entreprise'));

ALTER TABLE public.members
    ALTER COLUMN account_type SET DEFAULT 'Bronze';

CREATE OR REPLACE FUNCTION public.create_member_atomic(
    p_first_name TEXT,
    p_last_name TEXT,
    p_account_type TEXT DEFAULT 'Bronze'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_seq INT;
    v_code TEXT;
    v_member RECORD;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');

    INSERT INTO public.member_sequences (year, last_sequence)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE
    SET last_sequence = public.member_sequences.last_sequence + 1
    RETURNING last_sequence INTO v_seq;

    v_code := v_year || LPAD(v_seq::TEXT, 4, '0');

    INSERT INTO public.members (member_code, first_name, last_name, account_type, status)
    VALUES (v_code, TRIM(p_first_name), TRIM(p_last_name), p_account_type, 'actif')
    RETURNING * INTO v_member;

    RETURN jsonb_build_object(
        'id', v_member.id,
        'member_code', v_member.member_code,
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'account_type', v_member.account_type,
        'status', v_member.status,
        'created_at', v_member.created_at
    );
END;
$$;
