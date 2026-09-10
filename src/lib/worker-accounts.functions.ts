import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  phone: z.string().trim().max(30).optional(),
  zoneId: z.string().uuid().nullable().optional(),
});

/** Ward office issues field-worker credentials. Staff only. */
export const createWorkerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const isStaff = (roles ?? []).some(
      (r) => r.role === "commissioner" || r.role === "zonal_officer",
    );
    if (!isStaff) throw new Error("Only ward staff can issue worker credentials.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone ?? "",
        account_type: "worker",
      },
    });
    if (createError) throw new Error(createError.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Could not create the worker account.");

    // The signup trigger creates the worker row; fill in ward and contact details.
    const { error: workerError } = await supabaseAdmin
      .from("workers")
      .update({
        name: data.fullName,
        phone: data.phone ?? "",
        zone_id: data.zoneId ?? null,
      })
      .eq("user_id", newUserId);
    if (workerError) throw new Error(workerError.message);

    if (data.zoneId) {
      await supabaseAdmin.from("profiles").update({ zone_id: data.zoneId }).eq("id", newUserId);
    }

    return { userId: newUserId, email: data.email };
  });
