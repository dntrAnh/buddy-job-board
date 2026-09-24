
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.job_group(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_creator_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_group_cap() FROM PUBLIC, anon, authenticated;
