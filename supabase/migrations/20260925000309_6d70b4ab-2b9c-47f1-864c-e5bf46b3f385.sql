ALTER TABLE public.groups ADD COLUMN invite_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX groups_invite_token_idx ON public.groups(invite_token);

CREATE OR REPLACE FUNCTION public.join_by_token(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid; total int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT id INTO g FROM public.groups WHERE invite_token = _token;
  IF g IS NULL THEN RAISE EXCEPTION 'This invite link is no longer valid.'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = g AND user_id = auth.uid()) THEN RETURN g; END IF;
  SELECT (SELECT count(*) FROM public.group_members WHERE group_id = g)
       + (SELECT count(*) FROM public.invites WHERE group_id = g AND accepted = false
            AND lower(email) <> lower(coalesce(auth.jwt()->>'email',''))) INTO total;
  IF total >= 15 THEN RAISE EXCEPTION 'This group is full (15 people max).'; END IF;
  INSERT INTO public.group_members(group_id, user_id) VALUES (g, auth.uid());
  UPDATE public.invites SET accepted = true WHERE group_id = g AND lower(email) = lower(coalesce(auth.jwt()->>'email',''));
  RETURN g;
END $$;
REVOKE EXECUTE ON FUNCTION public.join_by_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_by_token(uuid) TO authenticated;