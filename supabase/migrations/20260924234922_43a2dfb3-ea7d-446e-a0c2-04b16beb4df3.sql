ALTER TABLE public.profiles
  ADD COLUMN email_new_jobs boolean NOT NULL DEFAULT true,
  ADD COLUMN email_nudges boolean NOT NULL DEFAULT true,
  ADD COLUMN email_weekly boolean NOT NULL DEFAULT true;

CREATE POLICY "owner removes members" ON public.group_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()) AND user_id <> auth.uid());

CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  kind text NOT NULL,
  subject_label text,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or owned group events" ON public.email_events FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()));
CREATE INDEX email_events_recipient_idx ON public.email_events(recipient_id, created_at DESC);
CREATE INDEX email_events_group_idx ON public.email_events(group_id, created_at DESC);