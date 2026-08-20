import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  CircuitBoard,
  Cpu,
  MapPin,
  Phone,
  PlayCircle,
  Terminal,
} from "lucide-react";
import { AppShell } from "@/components/noc/app-shell";
import { Pill, severityTone, statusTone } from "@/components/noc/severity";
import { ago } from "@/components/noc/incident-card";
import { Button } from "@/components/ui/button";
import { deviceByHostname } from "@/lib/noc-data";
import { useNoc } from "@/lib/noc-store";

export const Route = createFileRoute("/incidents/$id")({
  head: () => ({
    meta: [
      { title: "Incident Detail — NOC Bot Console" },
      {
        name: "description",
        content:
          "Full incident card: AI diagnosis, matched runbook, live CLI diagnostics and the self-heal action log.",
      },
      { property: "og:title", content: "Incident Detail — NOC Bot Console" },
      {
        property: "og:description",
        content: "AI diagnosis, matched runbook, live CLI evidence and self-heal log.",
      },
    ],
  }),
  component: IncidentDetail,
});

function IncidentDetail() {
  const { id } = useParams({ from: "/incidents/$id" });
  const { incidents, knowledge, runAutoHeal, updateIncident, settings } = useNoc();
  const incident = incidents.find((i) => i.id === id);
  const [healing, setHealing] = useState(false);

  if (!incident) {
    return (
      <AppShell>
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Incident {id} is not in this feed.</p>
          <Link to="/incidents" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to feed
          </Link>
        </div>
      </AppShell>
    );
  }

  const device = deviceByHostname(incident.hostname);
  const kb = knowledge.find((k) => k.category === incident.category);
  const steps = incident.remediation ?? kb?.remediation ?? [];

  function heal() {
    setHealing(true);
    updateIncident(incident!.id, { status: "healing" });
    setTimeout(() => {
      runAutoHeal(incident!.id);
      setHealing(false);
      toast.success(`${incident!.id} healed`, {
        description: `Runbook ${kb?.title ?? incident!.runbook} applied on ${incident!.hostname}.`,
      });
    }, 1600);
  }

  return (
    <AppShell>
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Incident feed
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={severityTone[incident.severity]} dot={incident.status !== "resolved"}>
                {incident.severity}
              </Pill>
              <Pill tone={statusTone[incident.status]}>{incident.status}</Pill>
              <span className="font-mono text-xs text-muted-foreground">
                {incident.id} · {ago(incident.receivedAt)}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold">{incident.summary}</h1>
            <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs text-warning">
              {incident.rawAlert}
            </pre>

            <div className="mt-5">
              <p className="label-caps">Bot diagnosis</p>
              <p className="mt-2 text-sm leading-relaxed">{incident.diagnosis}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-primary/25 bg-primary/5 p-3 text-xs">
              <Bot className="size-4 text-primary" />
              <span>
                Matched runbook <strong className="font-mono">{incident.runbook}</strong>
              </span>
              <span className="text-muted-foreground">
                confidence {(incident.matchConfidence * 100).toFixed(0)}%
              </span>
              <div className="ml-auto h-1.5 w-28 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${incident.matchConfidence * 100}%` }}
                />
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <p className="label-caps">Live diagnostics collected on device</p>
            </div>
            <div className="mt-4 space-y-3">
              {incident.diagnostics.map((d) => (
                <div key={d.command} className="rounded-md border border-border bg-background/60">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <code className="font-mono text-xs text-primary">
                      {device?.hostname}# {d.command}
                    </code>
                    <span className="font-mono text-[0.65rem] text-muted-foreground">
                      {d.durationMs}ms
                    </span>
                  </div>
                  <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {d.output}
                  </pre>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <p className="label-caps">Recommended actions</p>
            <ol className="mt-3 space-y-2.5">
              {incident.recommendedActions.map((a, idx) => (
                <li key={a} className="flex gap-3 text-sm">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[0.65rem] text-primary">
                    {idx + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          </section>

          {incident.healLog?.length ? (
            <section className="panel p-6">
              <p className="label-caps">Self-heal action log</p>
              <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed text-success">
                {incident.healLog.join("\n")}
              </pre>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="panel p-5">
            <p className="label-caps">Device</p>
            <p className="mt-2 font-mono text-sm text-foreground">{incident.hostname}</p>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <Cpu className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="font-mono">
                    {device?.vendor} · {device?.host}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Site</dt>
                  <dd>{device?.site}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CircuitBoard className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Topology / circuit</dt>
                  <dd>{device?.topology}</dd>
                  <dd className="font-mono text-muted-foreground">{device?.circuit}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">ISP contact</dt>
                  <dd>{device?.ispContact}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="panel p-5">
            <p className="label-caps">Self-heal</p>
            {steps.length ? (
              <>
                <ul className="mt-3 space-y-2">
                  {steps.map((s) => (
                    <li key={s.command} className="rounded-md border border-border bg-background/60 p-2.5">
                      <p className="text-xs">{s.description}</p>
                      <code className="mt-1 block font-mono text-[0.7rem] text-primary">
                        {s.command.replaceAll("{{intf}}", incident.interfaceName ?? "Gi0/1")}
                      </code>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  disabled={healing || incident.status === "resolved"}
                  onClick={heal}
                >
                  <PlayCircle className="size-4" />
                  {incident.status === "resolved"
                    ? "Already resolved"
                    : healing
                      ? "Applying fix…"
                      : "Run self-heal now"}
                </Button>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  {settings.liveMode
                    ? "Live mode: commands are pushed over SSH by the bot."
                    : "Demo mode: the fix is simulated and logged, no device is touched."}
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No remediation steps known for category{" "}
                <span className="font-mono">{incident.category}</span>. Add one on the Knowledge
                page and the bot will handle it next time.
              </p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
