-- Create scripts table for storing generated userscripts
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'updating')),
  version TEXT NOT NULL DEFAULT '1.0.0',
  iterations INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table for storing AI task requests
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table for tracking AI operations
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'ai')),
  message TEXT NOT NULL,
  details TEXT,
  script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create public access policies (no auth needed for this demo)
CREATE POLICY "Allow public read access to scripts"
  ON public.scripts FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to scripts"
  ON public.scripts FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from scripts"
  ON public.scripts FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to tasks"
  ON public.tasks FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to tasks"
  ON public.tasks FOR UPDATE
  USING (true);

CREATE POLICY "Allow public read access to activity_logs"
  ON public.activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to activity_logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for scripts
CREATE TRIGGER set_scripts_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_scripts_status ON public.scripts(status);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_script_id ON public.activity_logs(script_id);