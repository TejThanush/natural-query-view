import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, MapPin, Wrench } from "lucide-react";
import { Pill, severityTone, statusTone } from "./severity";
import { deviceByHostname } from "@/lib/noc-data";
import type { Incident } from "@/lib/noc-types";
import { cn } from "@/lib/utils";

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function IncidentCard({
  incident,
  highlighted,
}: {
  incident: Incident;
  highlighted?: boolean;
}) {
  const device = deviceByHostname(incident.hostname);
  return (
    <Link
      to="/incidents/$id"
      params={{ id: incident.id }}
      className={cn(
        "panel rise-in group block p-4 transition-all hover:border-primary/50",
        highlighted && "border-primary/60 shadow-[var(--shadow-glow)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={severityTone[incident.severity]} dot={incident.status !== "resolved"}>
          {incident.severity}
        </Pill>
        <Pill tone={statusTone[incident.status]}>{incident.status}</Pill>
        <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {ago(incident.receivedAt)}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold">{incident.summary}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{incident.diagnosis}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{incident.hostname}</span>
        {incident.interfaceName ? <span>{incident.interfaceName}</span> : null}
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" />
          {device?.site ?? "unknown site"}
        </span>
        <span className="flex items-center gap-1">
          <Wrench className="size-3.5" />
          {incident.runbook} · {(incident.matchConfidence * 100).toFixed(0)}%
        </span>
        <span className="ml-auto flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

export { ago };
