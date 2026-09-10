import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Complaint } from "./queries";

export type SegregationRule = {
  id: string;
  waste_category_id: string;
  waste_stream: string;
  bin_label: string;
  bin_color: string;
  disposal_guidance: string;
  warning_text: string | null;
  waste_categories: { key: string; name: string } | null;
};

export const segregationRulesQuery = queryOptions({
  queryKey: ["segregation_rules"],
  queryFn: async (): Promise<SegregationRule[]> => {
    const { data, error } = await supabase
      .from("segregation_rules")
      .select("*, waste_categories(key,name)")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as SegregationRule[];
  },
});

export const myComplaintsQuery = queryOptions({
  queryKey: ["my_complaints"],
  queryFn: async (): Promise<Complaint[]> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("citizen_id", uid)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Complaint[];
  },
});

/** Photos live in a private bucket, so they are shown through short-lived signed links. */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("complaint-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function photoUrlQuery(path: string | null) {
  return queryOptions({
    queryKey: ["photo_url", path],
    queryFn: () => signedPhotoUrl(path),
    staleTime: 1000 * 60 * 30,
  });
}

export async function uploadReportPhoto(dataUrl: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be signed in.");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("complaint-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
