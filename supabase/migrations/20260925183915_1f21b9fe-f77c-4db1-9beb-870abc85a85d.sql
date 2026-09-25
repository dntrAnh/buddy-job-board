CREATE TABLE public.saved_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  resume text NOT NULL DEFAULT '',
  score_before integer,
  score_after integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_resumes TO authenticated;
GRANT ALL ON public.saved_resumes TO service_role;

ALTER TABLE public.saved_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own saved resumes view"
ON public.saved_resumes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "own saved resumes create"
ON public.saved_resumes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_group_member(public.job_group(job_id), auth.uid()));

CREATE POLICY "own saved resumes update"
ON public.saved_resumes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_group_member(public.job_group(job_id), auth.uid()));

CREATE POLICY "own saved resumes delete"
ON public.saved_resumes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER saved_resumes_touch
BEFORE UPDATE ON public.saved_resumes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();