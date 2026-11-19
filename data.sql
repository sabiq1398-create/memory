-- Memori schema, authentication, and access policies.
-- Run in the Supabase SQL Editor. Existing memory/user IDs are preserved.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  address text,
  instagram text,
  whatsapp text,
  bio text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active_device_id text,
  active_device_info text,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  image_url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  device_info text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS bio text;

UPDATE public.users AS profile
SET auth_user_id = auth_user.id
FROM auth.users AS auth_user
WHERE profile.auth_user_id IS NULL
  AND lower(profile.email) = lower(auth_user.email);

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.memori_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.memori_migrations FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memori_migrations WHERE name = 'secure-roles-v1'
  ) THEN
    -- The previous demo UI let clients change their own role.
    UPDATE public.users SET role = 'user' WHERE role IS DISTINCT FROM 'user';
    INSERT INTO public.memori_migrations (name) VALUES ('secure-roles-v1');
  END IF;
END;
$$;

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users AS current_profile (email, full_name, avatar_url, role, auth_user_id)
  VALUES (
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    'user',
    NEW.id
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        role = CASE
          WHEN current_profile.auth_user_id IS DISTINCT FROM EXCLUDED.auth_user_id THEN 'user'
          ELSE current_profile.role
        END,
        full_name = COALESCE(current_profile.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(current_profile.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_memori ON auth.users;
CREATE TRIGGER on_auth_user_created_memori
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.is_memori_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_contact_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT public.is_memori_admin()
     AND (
       NEW.address IS DISTINCT FROM OLD.address
       OR NEW.instagram IS DISTINCT FROM OLD.instagram
       OR NEW.whatsapp IS DISTINCT FROM OLD.whatsapp
       OR NEW.bio IS DISTINCT FROM OLD.bio
     ) THEN
    RAISE EXCEPTION 'Akses administrator diperlukan'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_contact_updates ON public.users;
CREATE TRIGGER guard_profile_contact_updates
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_contact_updates();

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_auth_user_id uuid;
  admin_count integer;
BEGIN
  IF NOT public.is_memori_admin() THEN
    RAISE EXCEPTION 'Akses administrator diperlukan';
  END IF;
  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Role tidak valid';
  END IF;

  SELECT auth_user_id INTO target_auth_user_id
  FROM public.users
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan';
  END IF;
  IF target_auth_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Role akun aktif tidak dapat diubah';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('memori_admin_role_change'));
  IF p_role = 'user' THEN
    SELECT count(*) INTO admin_count
    FROM public.users
    WHERE role = 'admin' AND auth_user_id IS NOT NULL;
    IF admin_count <= 1 AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_user_id AND role = 'admin' AND auth_user_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Setidaknya satu administrator harus tetap aktif';
    END IF;
  END IF;

  UPDATE public.users SET role = p_role WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_device(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_memori_admin() THEN
    RAISE EXCEPTION 'Akses administrator diperlukan';
  END IF;
  UPDATE public.users
  SET active_device_id = NULL,
      active_device_info = NULL,
      last_active_at = NULL
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan';
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.memory_user_profiles
WITH (security_barrier = true)
AS
  SELECT id, full_name, avatar_url, address, instagram, whatsapp, bio
  FROM public.users;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_memori_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_profile_contact_updates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_user_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_memori_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_profile_contact_updates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_device(uuid) TO authenticated;

REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.memories FROM anon, authenticated;
REVOKE ALL ON public.activity_logs FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (active_device_id, active_device_info, last_active_at)
  ON public.users TO authenticated;
GRANT UPDATE (address, instagram, whatsapp, bio)
  ON public.users TO authenticated;
GRANT SELECT ON public.memory_user_profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.memories TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.memories_id_seq TO authenticated;

DO $$
DECLARE
  policy_row record;
BEGIN
  -- Policies are permissive by default; remove legacy policies on these app tables
  -- before applying the role-scoped policies below.
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'memories', 'activity_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_read_own_or_admin
  ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) OR public.is_memori_admin());
CREATE POLICY users_update_own_device
  ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));
CREATE POLICY users_update_profile_admin
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_memori_admin())
  WITH CHECK (public.is_memori_admin());

CREATE POLICY memories_read_signed_in
  ON public.memories FOR SELECT TO authenticated
  USING (true);
CREATE POLICY memories_insert_admin
  ON public.memories FOR INSERT TO authenticated
  WITH CHECK (
    public.is_memori_admin()
    AND
    user_id = (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );
CREATE POLICY memories_delete_owner_or_admin
  ON public.memories FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
    OR public.is_memori_admin()
  );

CREATE POLICY activity_logs_insert_own
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );
CREATE POLICY activity_logs_read_admin
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_memori_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('memories', 'memories', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS memori_memory_files_public_read ON storage.objects;
DROP POLICY IF EXISTS memori_memory_files_upload_own ON storage.objects;
DROP POLICY IF EXISTS memori_memory_files_upload_admin ON storage.objects;
DROP POLICY IF EXISTS memori_memory_files_delete_own_or_admin ON storage.objects;

CREATE POLICY memori_memory_files_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'memories');
CREATE POLICY memori_memory_files_upload_admin
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'memories'
    AND public.is_memori_admin()
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.users WHERE auth_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY memori_memory_files_delete_own_or_admin
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'memories'
    AND (
      (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE auth_user_id = (SELECT auth.uid())
      )
      OR public.is_memori_admin()
    )
  );

-- Promote the first administrator after creating their account in Supabase Auth:
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@example.com';
