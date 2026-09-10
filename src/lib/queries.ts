import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComplaintStatus, Priority, WasteCategory } from "./waste";

export type Zone = {
  id: string;
  name: string;
  supervisor_name: string;
  sensitivity_tags: string[];
  center_lat: number;
  center_lng: number;
};

export type Worker = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  zone_id: string | null;
  availability: string;
  performance_score: number;
};

export type Complaint = {
  id: string;
  reference: string;
  citizen_name: string;
  citizen_note: string;
  zone_id: string | null;
  lat: number;
  lng: number;
  address: string;
  waste_category: WasteCategory;
  priority: Priority;
  status: ComplaintStatus;
  ai_confidence: number;
  assigned_worker_id: string | null;
  assigned_worker_user_id: string | null;
  created_at: string;
  accepted_at: string | null;
  sla_start: string | null;
  sla_deadline: string | null;
  resolved_at: string | null;
  escalation_level: number;
  verification_status: string | null;
  priority_override_reason: string | null;
  citizen_id: string | null;
  photo_url: string | null;
  ai_label: string | null;
  captured_at: string | null;
  description: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
};


export type ComplaintEvent = {
  id: string;
  complaint_id: string;
  actor: string;
  event_type: string;
  detail: string;
  created_at: string;
};

export type Escalation = {
  id: string;
  complaint_id: string;
  from_level: number;
  to_level: number;
  escalated_at: string;
  reason: string;
};

export type SlaConfig = {
  priority: Priority;
  duration_hours: number;
  warn_at_percent: number[];
  escalation_extension_hours: number;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const zonesQuery = queryOptions({
  queryKey: ["zones"],
  queryFn: async () =>
    unwrap<Zone[]>(await supabase.from("zones").select("*").order("name")),
});

export const workersQuery = queryOptions({
  queryKey: ["workers"],
  queryFn: async () =>
    unwrap<Worker[]>(await supabase.from("workers").select("*").order("name")),
});

export const myWorkerQuery = queryOptions({
  queryKey: ["my_worker"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Worker | null;
  },
});

export const complaintsQuery = queryOptions({
  queryKey: ["complaints"],
  queryFn: async () =>
    unwrap<Complaint[]>(
      await supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    ),
});

export const escalationsQuery = queryOptions({
  queryKey: ["escalations"],
  queryFn: async () =>
    unwrap<Escalation[]>(
      await supabase.from("escalations").select("*").order("escalated_at", { ascending: false }),
    ),
});

export const slaConfigQuery = queryOptions({
  queryKey: ["sla_config"],
  queryFn: async () =>
    unwrap<SlaConfig[]>(await supabase.from("sla_config").select("*")),
});

export function complaintEventsQuery(complaintId: string) {
  return queryOptions({
    queryKey: ["complaint_events", complaintId],
    queryFn: async () =>
      unwrap<ComplaintEvent[]>(
        await supabase
          .from("complaint_events")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: true }),
      ),
  });
}

export const myAccessQuery = queryOptions({
  queryKey: ["my_access"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user)
      return {
        email: "",
        fullName: "",
        role: "citizen" as const,
        zoneId: null as string | null,
        avatarUrl: null as string | null,
      };
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const role = roles?.[0]?.role ?? "citizen";
    return {
      email: profile?.email || user.email || "",
      fullName: profile?.full_name || "",
      role: role as "commissioner" | "zonal_officer" | "citizen" | "worker",
      zoneId: (profile?.zone_id as string | null) ?? null,
      avatarUrl: ((profile as { avatar_url?: string | null } | null)?.avatar_url ?? null) as
        | string
        | null,
    };
  },
});

/** Avatars live in a private bucket, so they render through short-lived signed links. */
export function avatarUrlQuery(path: string | null) {
  return queryOptions({
    queryKey: ["avatar_url", path],
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
    staleTime: 1000 * 60 * 30,
  });
}

