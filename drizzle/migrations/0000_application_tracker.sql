ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'applied';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_notes text NOT NULL DEFAULT '';