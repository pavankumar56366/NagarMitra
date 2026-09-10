
-- 1. Complaint columns for citizen reporting
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS citizen_id uuid,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS ai_label text,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.complaints
  ALTER COLUMN reference SET DEFAULT ('CMP-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));

CREATE INDEX IF NOT EXISTS complaints_citizen_idx ON public.complaints(citizen_id);

-- 2. Ward auto-match from coordinates
CREATE OR REPLACE FUNCTION public.match_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.zone_id IS NULL THEN
    SELECT z.id INTO NEW.zone_id
    FROM public.zones z
    ORDER BY ((z.center_lat - NEW.lat)^2 + (z.center_lng - NEW.lng)^2) ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.match_zone() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS complaints_match_zone ON public.complaints;
CREATE TRIGGER complaints_match_zone
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.match_zone();

-- 3. New sign-ups are citizens unless they register as staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data->>'account_type','citizen') = 'staff' THEN
    _role := 'commissioner';
  ELSE
    _role := 'citizen';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Citizen access to their own reports
DROP POLICY IF EXISTS "citizen reads own complaints" ON public.complaints;
CREATE POLICY "citizen reads own complaints" ON public.complaints
  FOR SELECT TO authenticated USING (citizen_id = auth.uid());

DROP POLICY IF EXISTS "citizen files complaints" ON public.complaints;
CREATE POLICY "citizen files complaints" ON public.complaints
  FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid());

DROP POLICY IF EXISTS "citizen reads own complaint events" ON public.complaint_events;
CREATE POLICY "citizen reads own complaint events" ON public.complaint_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_events.complaint_id AND c.citizen_id = auth.uid()));

DROP POLICY IF EXISTS "citizen reads assigned worker" ON public.workers;
CREATE POLICY "citizen reads assigned worker" ON public.workers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.complaints c
            WHERE c.assigned_worker_id = workers.id AND c.citizen_id = auth.uid()));

DROP POLICY IF EXISTS "zones readable by signed in users" ON public.zones;
CREATE POLICY "zones readable by signed in users" ON public.zones
  FOR SELECT TO authenticated USING (true);

-- 5. Waste categories and configurable segregation rules
CREATE TABLE IF NOT EXISTS public.waste_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key public.waste_category NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_priority public.complaint_priority NOT NULL DEFAULT 'medium',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.waste_categories TO authenticated;
GRANT ALL ON public.waste_categories TO service_role;
ALTER TABLE public.waste_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories readable" ON public.waste_categories;
CREATE POLICY "categories readable" ON public.waste_categories
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.segregation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_category_id uuid NOT NULL REFERENCES public.waste_categories(id) ON DELETE CASCADE,
  waste_stream text NOT NULL,
  bin_label text NOT NULL,
  bin_color text NOT NULL,
  disposal_guidance text NOT NULL,
  warning_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.segregation_rules TO authenticated;
GRANT ALL ON public.segregation_rules TO service_role;
ALTER TABLE public.segregation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules readable" ON public.segregation_rules;
CREATE POLICY "rules readable" ON public.segregation_rules
  FOR SELECT TO authenticated USING (true);

-- 6. Household segregation scans
CREATE TABLE IF NOT EXISTS public.segregation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL,
  image_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'completed',
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.segregation_sessions TO authenticated;
GRANT ALL ON public.segregation_sessions TO service_role;
ALTER TABLE public.segregation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sessions readable" ON public.segregation_sessions;
CREATE POLICY "own sessions readable" ON public.segregation_sessions
  FOR SELECT TO authenticated USING (citizen_id = auth.uid());
DROP POLICY IF EXISTS "own sessions insertable" ON public.segregation_sessions;
CREATE POLICY "own sessions insertable" ON public.segregation_sessions
  FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.segregation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.segregation_sessions(id) ON DELETE CASCADE,
  waste_category_id uuid REFERENCES public.waste_categories(id),
  label text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  bounding_box_json jsonb,
  recommended_stream text NOT NULL,
  recommended_bin_label text NOT NULL,
  recommended_bin_color text NOT NULL,
  disposal_guidance text NOT NULL,
  warning_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.segregation_results TO authenticated;
GRANT ALL ON public.segregation_results TO service_role;
ALTER TABLE public.segregation_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own results readable" ON public.segregation_results;
CREATE POLICY "own results readable" ON public.segregation_results
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.segregation_sessions s
            WHERE s.id = segregation_results.session_id AND s.citizen_id = auth.uid()));
DROP POLICY IF EXISTS "own results insertable" ON public.segregation_results;
CREATE POLICY "own results insertable" ON public.segregation_results
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.segregation_sessions s
            WHERE s.id = segregation_results.session_id AND s.citizen_id = auth.uid()));

-- 7. Citizen verification of resolutions
CREATE TABLE IF NOT EXISTS public.citizen_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL,
  result text NOT NULL,
  comment text,
  verified_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.citizen_verifications TO authenticated;
GRANT ALL ON public.citizen_verifications TO service_role;
ALTER TABLE public.citizen_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verifications readable" ON public.citizen_verifications;
CREATE POLICY "verifications readable" ON public.citizen_verifications
  FOR SELECT TO authenticated USING (
    citizen_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.complaints c
               WHERE c.id = citizen_verifications.complaint_id AND public.can_view_zone(c.zone_id)));

CREATE OR REPLACE FUNCTION public.citizen_verify(_complaint_id uuid, _confirmed boolean, _comment text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id AND citizen_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF c.status <> 'resolved' THEN RAISE EXCEPTION 'This report is not awaiting verification'; END IF;

  INSERT INTO public.citizen_verifications (complaint_id, citizen_id, result, comment)
  VALUES (_complaint_id, auth.uid(), CASE WHEN _confirmed THEN 'confirmed' ELSE 'rejected' END, _comment);

  IF _confirmed THEN
    UPDATE public.complaints
      SET status = 'closed', verification_status = 'confirmed', sla_deadline = NULL
      WHERE id = _complaint_id;
    INSERT INTO public.complaint_events (complaint_id, actor, event_type, detail)
      VALUES (_complaint_id, 'citizen', 'closed', 'Citizen confirmed the cleanup. Report closed.');
  ELSE
    UPDATE public.complaints
      SET status = 'reopened', verification_status = 'rejected', resolved_at = NULL,
          sla_deadline = now() + interval '6 hours'
      WHERE id = _complaint_id;
    INSERT INTO public.complaint_events (complaint_id, actor, event_type, detail)
      VALUES (_complaint_id, 'citizen', 'reopened', COALESCE(NULLIF(_comment,''), 'Citizen reported the site is still not clean.'));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.citizen_verify(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.citizen_verify(uuid, boolean, text) TO authenticated;

-- 8. Seed categories and prototype bin mapping
INSERT INTO public.waste_categories (key, name, description, default_priority) VALUES
  ('organic','Organic / Wet Waste','Food scraps, garden waste and other biodegradable matter.','medium'),
  ('plastic','Plastic','Bottles, wrappers, containers and packaging film.','medium'),
  ('paper_cardboard','Paper / Cardboard','Newspaper, cartons and paper packaging.','low'),
  ('e_waste','E-Waste','Batteries, cables, chargers and electronics.','high'),
  ('construction_debris','Construction Debris','Rubble, sand, tiles and demolition waste.','high'),
  ('hazardous','Hazardous / Medical','Sharps, chemicals, paint and medical waste.','critical'),
  ('mixed','Mixed / Unsegregated','Mixed household or street waste that needs sorting.','medium')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.segregation_rules (waste_category_id, waste_stream, bin_label, bin_color, disposal_guidance, warning_text)
SELECT c.id, v.stream, v.label, v.color, v.guidance, v.warning
FROM public.waste_categories c
JOIN (VALUES
  ('organic','Wet / Organic','Green bin','#2A7C13','Place it in the wet/organic stream. Compost at home where possible.',NULL),
  ('plastic','Dry / Recyclable','Blue bin','#1F6FEB','Rinse and dry it, then place it in the dry/recyclable stream.',NULL),
  ('paper_cardboard','Dry / Recyclable','Blue bin','#1F6FEB','Flatten it and keep it dry, then place it in the dry/recyclable stream.',NULL),
  ('e_waste','Hazardous / Special','Red bin','#C00707','Do not mix with household waste. Hand it to an e-waste collection point.','Electronic waste can leak heavy metals. Keep it away from children.'),
  ('construction_debris','Special Handling','Grey bin','#5B655F','Debris is not collected with household waste. Arrange a municipal debris pickup.','Do not dump debris on roads or drains.'),
  ('hazardous','Hazardous / Special','Red bin','#C00707','Seal it separately and hand it to hazardous waste collection.','Hazardous item. Handle with gloves and never mix with other waste.'),
  ('mixed','Needs Sorting','Sort first','#FFCB56','Separate wet and dry items before disposal.','Mixed waste cannot be processed. Please segregate it.')
) AS v(key, stream, label, color, guidance, warning) ON v.key = c.key::text
WHERE NOT EXISTS (SELECT 1 FROM public.segregation_rules r WHERE r.waste_category_id = c.id);
