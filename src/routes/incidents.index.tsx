import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/noc/app-shell";
import { IncidentCard } from "@/components/noc/incident-card";
import { useNoc } from "@/lib/noc-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Severity } from "@/lib/noc-types";

export const Route = createFileRoute("/incidents/")({
  head: () => ({
    meta: [
      { title: "Incident Feed — NOC Bot Console" },
      {
        name: "description",
        content:
          "Real-time NOC incident feed with severity, device, site and runbook match for every ingested alert.",
      },
      { property: "og:title", content: "Incident Feed — NOC Bot Console" },
      {
        property: "og:description",
        content: "Real-time NOC incident feed with runbook match and auto-heal status.",
      },
    ],
  }),
  component: IncidentFeed,
});

const severities: Array<Severity | "all"> = ["all", "critical", "major", "minor", "info"];
const statuses = ["all", "new", "triaged", "healing", "resolved"] as const;

function IncidentFeed() {
  const { incidents } = useNoc();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState<(typeof severities)[number]>("all");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");

  const filtered = useMemo(
    () =>
      incidents.filter((i) => {
        if (sev !== "all" && i.severity !== sev) return false;
        if (status !== "all" && i.status !== status) return false;
        if (!q.trim()) return true;
        const hay = `${i.id} ${i.hostname} ${i.rawAlert} ${i.summary} ${i.category}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      }),
    [incidents, q, sev, status],
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Incident feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {incidents.length} incidents · newest first
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by device, ID or text…"
          className="h-10 w-full max-w-xs font-mono text-sm"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5">
          {severities.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sev === s ? "default" : "outline"}
              onClick={() => setSev(s)}
              className="h-7 px-3 text-xs capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "secondary" : "ghost"}
              onClick={() => setStatus(s)}
              className="h-7 px-3 text-xs capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {filtered.map((i) => (
          <IncidentCard key={i.id} incident={i} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
          No incidents match those filters.
        </p>
      ) : null}
    </AppShell>
  );
}
