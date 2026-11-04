-- Migration pour ajouter le champ client_code distinct du member_code
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS client_code TEXT;
CREATE INDEX IF NOT EXISTS idx_members_client_code ON public.members(client_code);
