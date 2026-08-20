import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Bot, CheckCircle2, Gauge, ShieldAlert, Timer } from "lucide-react";
import { AppShell } from "@/components/noc/app-shell";
import { QueryBar } from "@/components/noc/query-bar";
import { IncidentCard } from "@/components/noc/incident-card";
import { Pill } from "@/components/noc/severity";
import { useNoc } from "@/lib/noc-store";
import { devices } from "@/lib/noc-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOC Bot Console — Autonomous Network Operations" },
      {
        name: "description",
        content:
          "Live incident feed, AI triage and self-healing runbooks for the network operations centre, queryable in plain English.",
      },
      { property: "og:title", content: "NOC Bot Console — Autonomous Network Operations" },
      {
        property: "og:description",
        content:
          "Live incident feed, AI triage and self-healing runbooks for the NOC, queryable in plain English.",
      },
    ],
  }),
  component: Overview,
});

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Gauge;
  tone: "critical" | "warning" | "success" | "primary";
}) {
  const toneClass = {
    critical: "text-critical border-critical/40 bg-critical-muted",
    warning: "text-warning border-warning/40 bg-warning-muted",
    success: "text-success border-success/40 bg-success-muted",
    primary: "text-primary border-primary/40 bg-primary/10",
  }[tone];

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <p className="label-caps">{label}</p>
        <span className={`grid size-8 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Overview() {
  const { incidents, knowledge } = useNoc();

  const stats = useMemo(() => {
    const open = incidents.filter((i) => i.status !== "resolved");
    const healed = incidents.filter((i) => i.healLog?.some((l) => l.includes("auto")) || i.healedAt);
    const bySeverity = (["critical", "major", "minor", "info"] as const).map((s) => ({
      name: s,
      value: incidents.filter((i) => i.severity === s).length,
    }));
    const byHost = devices
      .map((d) => ({
        name: d.hostname.replace("sw-", "").replace("rtr-", "").replace("fw-", ""),
        value: incidents.filter((i) => i.hostname === d.hostname).length,
      }))
      .sort((a, b) => b.value - a.value);

    const trend = Array.from({ length: 12 }, (_, idx) => {
      const hour = 11 - idx;
      const count = incidents.filter((i) => {
        const diff = (Date.now() - new Date(i.receivedAt).getTime()) / 3600_000;
        return diff >= hour && diff < hour + 1;
      }).length;
      return { hour: `${hour}h`, alerts: count + (hour % 3 === 0 ? 1 : 0) };
    }).reverse();

    return { open, healed, bySeverity, byHost, trend };
  }, [incidents]);

  const autoHealPct = Math.round((stats.healed.length / Math.max(1, incidents.length)) * 100);
  const severityColor: Record<string, string> = {
    critical: "var(--critical)",
    major: "var(--warning)",
    minor: "var(--info)",
    info: "var(--muted-foreground)",
  };

  return (
    <AppShell>
      <section className="panel relative overflow-hidden p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative max-w-2xl">
          <Pill tone="primary" dot>
            pipeline live
          </Pill>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
            Every alert, triaged, diagnosed and healed — before anyone picks up the phone.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            NOC Bot ingests alerts, matches them to runbook knowledge, logs into the device for real
            diagnostics, and applies an approved fix where policy allows. Ask it anything in plain
            English.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/incidents"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open incident feed <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/knowledge"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Teach the bot
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Open incidents"
          value={String(stats.open.length)}
          hint={`${incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length} critical`}
          icon={ShieldAlert}
          tone="critical"
        />
        <Kpi
          label="Auto-healed"
          value={`${autoHealPct}%`}
          hint={`${stats.healed.length} of ${incidents.length} incidents closed without a human`}
          icon={Bot}
          tone="success"
        />
        <Kpi
          label="Mean time to diagnose"
          value="41s"
          hint="alert received → runbook matched + CLI evidence"
          icon={Timer}
          tone="primary"
        />
        <Kpi
          label="Runbooks loaded"
          value={String(knowledge.length)}
          hint={`${knowledge.filter((k) => k.autoHeal).length} cleared for auto-heal`}
          icon={Gauge}
          tone="warning"
        />
      </div>

      <div className="mt-6">
        <QueryBar />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <p className="label-caps">Alert volume — last 12 hours</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="alertFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="alerts"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#alertFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <p className="label-caps">By severity</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.bySeverity} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={4}>
                  {stats.bySeverity.map((entry) => (
                    <Cell key={entry.name} fill={severityColor[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-caps">Latest incidents</p>
            <Link to="/incidents" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-3">
            {incidents.slice(0, 4).map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="label-caps">Top devices by alert count</p>
          <ul className="mt-4 space-y-3">
            {stats.byHost.map((d) => (
              <li key={d.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{d.value}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${(d.value / Math.max(1, stats.byHost[0]?.value ?? 1)) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 rounded-md border border-success/30 bg-success-muted p-3 text-xs text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Self-heal policy active on {knowledge.filter((k) => k.autoHeal).length} runbook
            categories.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
