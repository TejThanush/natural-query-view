import { Link } from "@tanstack/react-router";
import { Activity, BookOpen, LayoutDashboard, Radio, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNoc } from "@/lib/noc-store";
import { Pill } from "./severity";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", icon: Activity },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings, liveStatus, injectRandomAlert, incidents } = useNoc();
  const open = incidents.filter((i) => i.status !== "resolved").length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <Radio className="size-4.5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-bold tracking-tight">NOC BOT</span>
              <span className="label-caps block">Autonomous ops console</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Pill tone={open > 0 ? "critical" : "success"} dot={open > 0}>
              {open} open
            </Pill>
            <Pill tone={settings.liveMode && liveStatus === "connected" ? "success" : "info"}>
              {settings.liveMode
                ? liveStatus === "connected"
                  ? "Live bot"
                  : "Live · offline"
                : "Demo data"}
            </Pill>
            <Button
              size="sm"
              onClick={() => {
                const inc = injectRandomAlert();
                toast.success(`Alert ingested — ${inc.id}`, { description: inc.rawAlert });
              }}
            >
              <Zap className="size-4" />
              Simulate alert
            </Button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <p className="label-caps">
          NOC Bot POC · alert ingest → runbook match → live diagnostics → self-heal
        </p>
      </footer>
    </div>
  );
}
