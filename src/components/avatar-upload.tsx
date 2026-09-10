import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrlQuery, myAccessQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function AvatarUpload({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: me } = useQuery(myAccessQuery);
  const { data: url } = useQuery(avatarUrlQuery(me?.avatarUrl ?? null));

  async function pick(file: File) {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You need to be signed in.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", uid);
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["my_access"] });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative h-20 w-20 shrink-0", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="h-20 w-20 overflow-hidden rounded-full border-2 border-border bg-muted"
      >
        {url ? (
          <img src={url} alt="Your profile" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UserIcon className="h-8 w-8" />
          </span>
        )}
      </button>
      <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
        <Camera className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
    </div>
  );
}
