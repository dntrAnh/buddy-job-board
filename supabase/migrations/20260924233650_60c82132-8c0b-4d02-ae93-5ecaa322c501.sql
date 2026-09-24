
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  resume text NOT NULL DEFAULT '',
  reminder_mode text NOT NULL DEFAULT 'medium' CHECK (reminder_mode IN ('easy','medium','hard')),
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  posted_by uuid NOT NULL,
  company text NOT NULL,
  role text NOT NULL,
  description text NOT NULL,
  link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.applications (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('applied','skipped')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);
CREATE TABLE public.match_scores (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score int NOT NULL,
  matched text[] NOT NULL DEFAULT '{}',
  missing text[] NOT NULL DEFAULT '{}',
  suggestions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.groups, public.group_members, public.invites, public.jobs, public.applications, public.match_scores TO authenticated;
GRANT ALL ON public.profiles, public.groups, public.group_members, public.invites, public.jobs, public.applications, public.match_scores TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user)
$$;
CREATE OR REPLACE FUNCTION public.shares_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m1 JOIN public.group_members m2 ON m1.group_id = m2.group_id WHERE m1.user_id = _a AND m2.user_id = _b)
$$;
CREATE OR REPLACE FUNCTION public.job_group(_job uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT group_id FROM public.jobs WHERE id = _job
$$;

-- profiles
CREATE POLICY "own profile rw" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "groupmates can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.shares_group(auth.uid(), id));

-- groups
CREATE POLICY "members view groups" ON public.groups FOR SELECT TO authenticated USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator updates group" ON public.groups FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- group_members (joins happen via functions)
CREATE POLICY "members view members" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "leave group" ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- invites
CREATE POLICY "members view invites" ON public.invites FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()) OR lower(email) = lower(auth.jwt()->>'email'));
CREATE POLICY "members create invites" ON public.invites FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "members delete invites" ON public.invites FOR DELETE TO authenticated USING (public.is_group_member(group_id, auth.uid()));

-- jobs
CREATE POLICY "members view jobs" ON public.jobs FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members post jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id, auth.uid()) AND posted_by = auth.uid());
CREATE POLICY "poster edits job" ON public.jobs FOR UPDATE TO authenticated USING (posted_by = auth.uid());
CREATE POLICY "poster deletes job" ON public.jobs FOR DELETE TO authenticated USING (posted_by = auth.uid());

-- applications
CREATE POLICY "members view applications" ON public.applications FOR SELECT TO authenticated USING (public.is_group_member(public.job_group(job_id), auth.uid()));
CREATE POLICY "own application insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_group_member(public.job_group(job_id), auth.uid()));
CREATE POLICY "own application update" ON public.applications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own application delete" ON public.applications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- match_scores: own only
CREATE POLICY "own scores" ON public.match_scores FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_group_member(public.job_group(job_id), auth.uid()));

-- creator auto-joins
CREATE OR REPLACE FUNCTION public.add_creator_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id) VALUES (NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
CREATE TRIGGER groups_add_creator AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.add_creator_member();

-- 15 cap (members + pending invites)
CREATE OR REPLACE FUNCTION public.enforce_group_cap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int;
BEGIN
  SELECT (SELECT count(*) FROM public.group_members WHERE group_id = NEW.group_id)
       + (SELECT count(*) FROM public.invites WHERE group_id = NEW.group_id AND accepted = false)
  INTO total;
  IF TG_TABLE_NAME = 'invites' AND total >= 15 THEN
    RAISE EXCEPTION 'This group is full (15 people max, including pending invites).';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invites_cap BEFORE INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.enforce_group_cap();

CREATE OR REPLACE FUNCTION public.accept_invite(_invite uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invites;
BEGIN
  SELECT * INTO inv FROM public.invites WHERE id = _invite AND accepted = false;
  IF inv IS NULL OR lower(inv.email) <> lower(auth.jwt()->>'email') THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  INSERT INTO public.group_members(group_id, user_id) VALUES (inv.group_id, auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE public.invites SET accepted = true WHERE id = _invite;
  RETURN inv.group_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
