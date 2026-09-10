-- Enums
CREATE TYPE public.app_role AS ENUM ('commissioner','zonal_officer');
CREATE TYPE public.complaint_status AS ENUM ('pending','assigned','in_progress','resolved','verified','closed','escalated','reopened');
CREATE TYPE public.complaint_priority AS ENUM ('critical','high','medium','low');
CREATE TYPE public.waste_category AS ENUM ('organic','plastic','paper_cardboard','e_waste','construction_debris','hazardous','mixed');

-- Zones
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supervisor_name text NOT NULL DEFAULT '',
  sensitivity_tags text[] NOT NULL DEFAULT '{}',
  center_lat double precision NOT NULL DEFAULT 0,
  center_lng double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_zone()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT zone_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_view_zone(_zone_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'commissioner')
      OR (public.has_role(auth.uid(),'zonal_officer') AND _zone_id IS NOT DISTINCT FROM public.current_zone());
$$;

-- Workers
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  availability text NOT NULL DEFAULT 'on_duty',
  performance_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Complaints
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  citizen_name text NOT NULL DEFAULT '',
  citizen_note text NOT NULL DEFAULT '',
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  address text NOT NULL DEFAULT '',
  waste_category public.waste_category NOT NULL DEFAULT 'mixed',
  priority public.complaint_priority NOT NULL DEFAULT 'medium',
  status public.complaint_status NOT NULL DEFAULT 'pending',
  ai_confidence numeric NOT NULL DEFAULT 0,
  assigned_worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  sla_start timestamptz,
  sla_deadline timestamptz,
  resolved_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0,
  verification_status text,
  priority_override_reason text
);
CREATE INDEX complaints_zone_idx ON public.complaints(zone_id);
CREATE INDEX complaints_status_idx ON public.complaints(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Audit events
CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  actor text NOT NULL DEFAULT 'system',
  event_type text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_events_complaint_idx ON public.complaint_events(complaint_id);
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;

-- Escalations
CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  from_level integer NOT NULL DEFAULT 0,
  to_level integer NOT NULL DEFAULT 1,
  escalated_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT ''
);
CREATE INDEX escalations_complaint_idx ON public.escalations(complaint_id);
GRANT SELECT, INSERT ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

-- SLA config
CREATE TABLE public.sla_config (
  priority public.complaint_priority PRIMARY KEY,
  duration_hours integer NOT NULL,
  warn_at_percent integer[] NOT NULL DEFAULT '{75,90}',
  escalation_extension_hours integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.sla_config TO authenticated;
GRANT ALL ON public.sla_config TO service_role;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "roles readable by owner" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'commissioner'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "zones readable" ON public.zones FOR SELECT TO authenticated USING (public.can_view_zone(id));
CREATE POLICY "workers readable" ON public.workers FOR SELECT TO authenticated USING (public.can_view_zone(zone_id));
CREATE POLICY "complaints readable" ON public.complaints FOR SELECT TO authenticated USING (public.can_view_zone(zone_id));
CREATE POLICY "complaints updatable" ON public.complaints FOR UPDATE TO authenticated USING (public.can_view_zone(zone_id)) WITH CHECK (public.can_view_zone(zone_id));

CREATE POLICY "events readable" ON public.complaint_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.can_view_zone(c.zone_id)));
CREATE POLICY "events insertable" ON public.complaint_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.can_view_zone(c.zone_id)));
CREATE POLICY "escalations readable" ON public.escalations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.can_view_zone(c.zone_id)));

CREATE POLICY "sla readable" ON public.sla_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla updatable by commissioner" ON public.sla_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'commissioner')) WITH CHECK (public.has_role(auth.uid(),'commissioner'));

-- New authority accounts: profile + commissioner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'commissioner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.sla_config (priority,duration_hours,escalation_extension_hours) VALUES
  ('critical',4,2),('high',12,6),('medium',24,12),('low',72,24);

-- Escalation sweep
CREATE OR REPLACE FUNCTION public.run_sla_escalation()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT c.id, c.escalation_level, s.escalation_extension_hours
    FROM public.complaints c
    JOIN public.sla_config s ON s.priority = c.priority
    WHERE c.sla_deadline IS NOT NULL
      AND c.sla_deadline < now()
      AND c.status IN ('assigned','in_progress','escalated','reopened')
  LOOP
    UPDATE public.complaints
      SET status = 'escalated',
          escalation_level = r.escalation_level + 1,
          sla_deadline = now() + make_interval(hours => r.escalation_extension_hours)
      WHERE id = r.id;
    INSERT INTO public.escalations (complaint_id, from_level, to_level, reason)
      VALUES (r.id, r.escalation_level, r.escalation_level + 1, 'SLA deadline passed without resolution.');
    INSERT INTO public.complaint_events (complaint_id, actor, event_type, detail)
      VALUES (r.id, 'system', 'escalated', 'Auto-escalated to level ' || (r.escalation_level + 1) || '.');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

INSERT INTO public.zones (id,name,supervisor_name,sensitivity_tags,center_lat,center_lng) VALUES
  ('11111111-1111-4111-8111-000000000001','Ward 12 - Ashok Nagar','Meera Iyer','{school,market}',12.9716,77.5946),
  ('11111111-1111-4111-8111-000000000002','Ward 27 - Rajaji Puram','Sanjay Rathore','{hospital}',12.9890,77.6100),
  ('11111111-1111-4111-8111-000000000003','Ward 34 - Lake View','Fatima Sheikh','{water_body,park}',12.9550,77.5800),
  ('11111111-1111-4111-8111-000000000004','Ward 41 - Industrial Estate','Devendra Nair','{industrial}',12.9400,77.6300),
  ('11111111-1111-4111-8111-000000000005','Ward 08 - Old Town','Priya Menon','{school,heritage}',12.9800,77.5700);

INSERT INTO public.workers (id,name,phone,zone_id,availability,performance_score) VALUES
  ('22222222-2222-4222-8222-000000000001','Ramesh Kumar','+91 98434 64097','11111111-1111-4111-8111-000000000001','on_duty',4.8),
  ('22222222-2222-4222-8222-000000000002','Anita Devi','+91 98529 92312','11111111-1111-4111-8111-000000000002','on_duty',4.3),
  ('22222222-2222-4222-8222-000000000003','Suresh Patil','+91 98097 22233','11111111-1111-4111-8111-000000000003','on_duty',4.6),
  ('22222222-2222-4222-8222-000000000004','Lakshmi Rao','+91 98126 33920','11111111-1111-4111-8111-000000000004','off_duty',3.8),
  ('22222222-2222-4222-8222-000000000005','Imran Qureshi','+91 98077 84483','11111111-1111-4111-8111-000000000005','on_duty',4.7),
  ('22222222-2222-4222-8222-000000000006','Vijay Shetty','+91 98288 16302','11111111-1111-4111-8111-000000000001','on_duty',3.3),
  ('22222222-2222-4222-8222-000000000007','Kavita Joshi','+91 98582 02938','11111111-1111-4111-8111-000000000002','off_duty',3.9),
  ('22222222-2222-4222-8222-000000000008','Mohan Das','+91 98323 01241','11111111-1111-4111-8111-000000000003','on_duty',3.4),
  ('22222222-2222-4222-8222-000000000009','Reena Pillai','+91 98569 78001','11111111-1111-4111-8111-000000000004','on_duty',4.1),
  ('22222222-2222-4222-8222-000000000010','Arjun Verma','+91 98758 93910','11111111-1111-4111-8111-000000000005','on_duty',3.4),
  ('22222222-2222-4222-8222-000000000011','Sunita Bai','+91 98299 62626','11111111-1111-4111-8111-000000000001','on_duty',4.3),
  ('22222222-2222-4222-8222-000000000012','Prakash Gowda','+91 98782 48519','11111111-1111-4111-8111-000000000002','off_duty',4.8);

WITH nums AS (
  SELECT i,
    abs(('x'||substr(md5('a'||i),1,7))::bit(28)::int) AS h1,
    abs(('x'||substr(md5('b'||i),1,7))::bit(28)::int) AS h2,
    abs(('x'||substr(md5('c'||i),1,7))::bit(28)::int) AS h3,
    abs(('x'||substr(md5('d'||i),1,7))::bit(28)::int) AS h4
  FROM generate_series(1,60) i
), pick AS (
  SELECT n.*,
    (ARRAY['11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002','11111111-1111-4111-8111-000000000003','11111111-1111-4111-8111-000000000004','11111111-1111-4111-8111-000000000005'])[1 + (h1 % 5)]::uuid AS zone_id,
    (ARRAY['organic','plastic','paper_cardboard','e_waste','construction_debris','hazardous','mixed'])[1 + (h2 % 7)] AS cat,
    (ARRAY['pending','assigned','in_progress','resolved','verified','closed','escalated','reopened'])[1 + ((i + h3 % 3) % 8)] AS st,
    2 + (h1 % 600) AS created_h,
    (ARRAY['Arun S.','Divya R.','Naveen K.','Shalini P.','Farhan A.','Geeta M.','Rahul T.','Ananya B.','Vikram J.','Nisha D.'])[1 + (h3 % 10)] AS citizen,
    (ARRAY['MG Road','Church Street','Kalyan Nagar 3rd Cross','Bazaar Lane','Lake Road','Station Road','Gandhi Chowk','Nehru Circle','Temple Street','Industrial Layout Phase 2','School Road','Market Yard'])[1 + (h4 % 12)] AS street,
    (ARRAY['Overflowing bin near the bus stop.','Debris dumped across the footpath.','Strong smell, attracting stray dogs.','','Waste burning reported here last week.','Right beside the school gate.',''])[1 + (h4 % 7)] AS note
  FROM nums n
), cx AS (
  SELECT p.*,
    z.center_lat + ((p.h2 % 2000) - 1000)/80000.0 AS lat,
    z.center_lng + ((p.h3 % 2000) - 1000)/80000.0 AS lng,
    z.name AS zone_name,
    CASE p.cat WHEN 'hazardous' THEN 'critical' WHEN 'construction_debris' THEN 'high' WHEN 'e_waste' THEN 'high'
             WHEN 'paper_cardboard' THEN 'low' ELSE 'medium' END AS prio,
    greatest(1, 2 + (p.h1 % 600) - 1 - (p.h2 % 8)) AS accepted_h
  FROM pick p JOIN public.zones z ON z.id = p.zone_id
)
INSERT INTO public.complaints
  (reference,citizen_name,citizen_note,zone_id,lat,lng,address,waste_category,priority,status,ai_confidence,
   assigned_worker_id,created_at,accepted_at,sla_start,sla_deadline,resolved_at,escalation_level,verification_status)
SELECT
  'CMP-' || lpad((10000+cx.i)::text,5,'0'),
  cx.citizen, cx.note, cx.zone_id, cx.lat, cx.lng,
  (1 + (cx.h2 % 180))::text || ', ' || cx.street || ', ' || split_part(cx.zone_name,' - ',2),
  cx.cat::public.waste_category,
  cx.prio::public.complaint_priority,
  cx.st::public.complaint_status,
  round((0.42 + (cx.h4 % 560)/1000.0)::numeric, 2),
  CASE WHEN cx.st = 'pending' THEN NULL ELSE (SELECT w.id FROM public.workers w WHERE w.zone_id = cx.zone_id ORDER BY md5(w.id::text || cx.i) LIMIT 1) END,
  now() - make_interval(hours => cx.created_h),
  CASE WHEN cx.st IN ('pending','assigned') THEN NULL ELSE now() - make_interval(hours => cx.accepted_h) END,
  CASE WHEN cx.st IN ('pending','assigned') THEN NULL ELSE now() - make_interval(hours => cx.accepted_h) END,
  CASE
    WHEN cx.st IN ('pending','assigned') THEN NULL
    WHEN cx.st = 'escalated' THEN now() - make_interval(hours => 1 + (cx.h3 % 30))
    ELSE now() - make_interval(hours => cx.accepted_h)
         + make_interval(hours => CASE cx.prio WHEN 'critical' THEN 4 WHEN 'high' THEN 12 WHEN 'medium' THEN 24 ELSE 72 END)
  END,
  CASE WHEN cx.st IN ('resolved','verified','closed') THEN now() - make_interval(hours => 1 + (cx.h4 % 20)) ELSE NULL END,
  CASE WHEN cx.st = 'escalated' THEN 1 + (cx.h2 % 3) ELSE 0 END,
  CASE WHEN cx.st = 'resolved' THEN 'awaiting' WHEN cx.st IN ('verified','closed') THEN 'confirmed' WHEN cx.st = 'reopened' THEN 'rejected' ELSE NULL END
FROM cx;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT id,'citizen','created','Complaint submitted with live photo and GPS location.',created_at FROM public.complaints;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT id,'system','assigned','Auto-assigned to the nearest available worker in the zone.',created_at + interval '11 minutes'
FROM public.complaints WHERE assigned_worker_id IS NOT NULL;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT id,'worker','accepted','Worker accepted the task. SLA countdown started.',accepted_at
FROM public.complaints WHERE accepted_at IS NOT NULL;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT id,'worker','resolved','Proof-of-completion photo submitted and task marked resolved.',resolved_at
FROM public.complaints WHERE resolved_at IS NOT NULL;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT id,'citizen','reopened','Citizen rejected the resolution; complaint reopened.',now() - interval '4 hours'
FROM public.complaints WHERE status = 'reopened';

INSERT INTO public.escalations (complaint_id,from_level,to_level,escalated_at,reason)
SELECT c.id, lvl-1, lvl, c.sla_deadline - make_interval(hours => (c.escalation_level - lvl) * 6), 'SLA deadline passed at level ' || (lvl-1) || ' without resolution.'
FROM public.complaints c, generate_series(1,3) lvl
WHERE c.status = 'escalated' AND lvl <= c.escalation_level;

INSERT INTO public.complaint_events (complaint_id,actor,event_type,detail,created_at)
SELECT complaint_id,'system','escalated','Auto-escalated to level ' || to_level || '.',escalated_at FROM public.escalations;