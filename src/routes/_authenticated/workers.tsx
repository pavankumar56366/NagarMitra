import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { complaintsQuery, workersQuery, zonesQuery } from "@/lib/queries";
import { createWorkerAccount } from "@/lib/worker-accounts.functions";
import { formatHours, isOpen } from "@/lib/waste";


export const Route = createFileRoute("/_authenticated/workers")({
  head: () => ({
    meta: [
      { title: "Worker Performance — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Compare sanitation worker workload, SLA compliance, average resolution time and rejection rates.",
      },
      { property: "og:title", content: "Worker Performance — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Sanitation worker workload and SLA compliance at a glance.",
      },
    ],
  }),
  component: WorkersPage,
});

function WorkersPage() {
  const { data: workers = [] } = useQuery(workersQuery);
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const [open, setOpen] = useState(false);



  const rows = workers
    .map((w) => {
      const mine = complaints.filter((c) => c.assigned_worker_id === w.id);
      const done = mine.filter((c) => c.resolved_at);
      const active = mine.filter((c) => isOpen(c.status));
      const breached = mine.filter(
        (c) =>
          c.resolved_at && c.sla_deadline
            ? new Date(c.resolved_at) > new Date(c.sla_deadline)
            : c.sla_deadline
              ? new Date(c.sla_deadline).getTime() < Date.now() && isOpen(c.status)
              : false,
      );
      const avg = done.length
        ? done.reduce(
            (s, c) =>
              s + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()),
            0,
          ) /
          done.length /
          3600000
        : 0;
      const compliance = mine.length
        ? Math.round(((mine.length - breached.length) / mine.length) * 100)
        : 100;
      return { w, total: mine.length, active: active.length, avg, compliance };
    })
    .sort((a, b) => b.compliance - a.compliance);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unzoned";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Worker Performance</h1>
          <p className="text-sm text-muted-foreground">{workers.length} sanitation workers</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Add worker account
        </button>
      </div>

      {open ? <NewWorkerDialog zones={zones} onClose={() => setOpen(false)} /> : null}



      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Worker</th>
              <th className="px-4 py-3 font-semibold">Ward</th>
              <th className="px-4 py-3 font-semibold">Availability</th>
              <th className="px-4 py-3 font-semibold">Active</th>
              <th className="px-4 py-3 font-semibold">Total handled</th>
              <th className="px-4 py-3 font-semibold">Avg. resolution</th>
              <th className="px-4 py-3 font-semibold">SLA compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ w, total, active, avg, compliance }) => (
              <tr key={w.id} className="hover:bg-accent">
                <td className="px-4 py-3">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.phone}</p>
                </td>
                <td className="px-4 py-3 text-xs">{zoneName(w.zone_id)}</td>
                <td className="px-4 py-3 text-xs capitalize">{w.availability}</td>
                <td className="px-4 py-3">{active}</td>
                <td className="px-4 py-3">{total}</td>
                <td className="px-4 py-3">{total ? formatHours(avg) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${compliance}%`,
                          backgroundColor: compliance >= 80 ? "#2A7C13" : "#C00707",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold">{compliance}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewWorkerDialog({
  zones,
  onClose,
}: {
  zones: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createWorkerAccount);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [password, setPassword] = useState(() => randomPassword());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: { fullName, email, password, phone, zoneId: zoneId || null },
      });
      await queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success(`Worker account created for ${email}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "h-11 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-[3px] focus:ring-primary/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="card-surface w-full max-w-[460px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Issue worker credentials</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The worker signs in with this email and password on the field app.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className={field}
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            className={field}
            type="email"
            placeholder="worker.id@ward.gov"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={field}
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select className={field} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">No ward yet</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="shrink-0 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-accent"
            >
              New
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this password with the worker — it cannot be shown again later.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create worker account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

