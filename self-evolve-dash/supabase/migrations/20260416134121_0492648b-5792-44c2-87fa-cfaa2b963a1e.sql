
-- scripts: replace public write policies with authenticated-only
DROP POLICY IF EXISTS "Allow public insert to scripts" ON public.scripts;
DROP POLICY IF EXISTS "Allow public update to scripts" ON public.scripts;
DROP POLICY IF EXISTS "Allow public delete from scripts" ON public.scripts;

CREATE POLICY "Authenticated users can insert scripts"
  ON public.scripts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scripts"
  ON public.scripts FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete scripts"
  ON public.scripts FOR DELETE TO authenticated
  USING (true);

-- script_versions: replace public policies with authenticated-only
DROP POLICY IF EXISTS "Allow public read access to script_versions" ON public.script_versions;
DROP POLICY IF EXISTS "Allow public insert to script_versions" ON public.script_versions;

CREATE POLICY "Authenticated users can read script_versions"
  ON public.script_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert script_versions"
  ON public.script_versions FOR INSERT TO authenticated
  WITH CHECK (true);

-- activity_logs: replace public insert with authenticated-only
DROP POLICY IF EXISTS "Allow public insert to activity_logs" ON public.activity_logs;

CREATE POLICY "Authenticated users can insert activity_logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- tasks: replace public write policies with authenticated-only
DROP POLICY IF EXISTS "Allow public insert to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update to tasks" ON public.tasks;

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (true);
