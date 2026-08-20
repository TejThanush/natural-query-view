import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, PlugZap, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/noc/app-shell";
import { Pill } from "@/components/noc/severity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNoc } from "@/lib/noc-store";
import { devices } from "@/lib/noc-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Console Settings — NOC Bot" },
      {
        name: "description",
        content:
          "Point the console at your local NOC bot, control auto-heal policy and reset the demo dataset.",
      },
      { property: "og:title", content: "Console Settings — NOC Bot" },
      {
        property: "og:description",
        content: "Connect the console to your local bot or run it on the built-in demo dataset.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    settings,
    setSettings,
    liveStatus,
    liveError,
    lastSyncAt,
    liveCount,
    testConnection,
    resetDemo,
  } = useNoc();

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Console settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Run the demo self-contained, or point it at the Python bot on your laptop.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Live bot connection</h2>
            <Pill
              tone={
                liveStatus === "connected" ? "success" : liveStatus === "error" ? "critical" : "info"
              }
              className="ml-auto"
            >
              {liveStatus}
            </Pill>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Use live bot</p>
              <p className="text-xs text-muted-foreground">
                Off = built-in demo incidents (safe for the boardroom)
              </p>
            </div>
            <Switch
              checked={settings.liveMode}
              onCheckedChange={(v) => setSettings({ liveMode: v })}
            />
          </div>

          <label className="label-caps mt-4 block" htmlFor="botUrl">
            Bot base URL
          </label>
          <Input
            id="botUrl"
            value={settings.botUrl}
            onChange={(e) => setSettings({ botUrl: e.target.value })}
            className="mt-1.5 font-mono text-sm"
            placeholder="http://127.0.0.1:5000"
          />

          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              void testConnection();
            }}
          >
            Test connection
          </Button>

          {liveStatus === "connected" ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-success">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              Reached the bot at {settings.botUrl}
              {lastSyncAt
                ? ` — ${liveCount} live incident${liveCount === 1 ? "" : "s"} synced at ${new Date(lastSyncAt).toLocaleTimeString()}.`
                : "."}
            </p>
          ) : null}
          {liveError ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-destructive">
              <XCircle className="mt-0.5 size-3.5 shrink-0" />
              {liveError}
            </p>
          ) : null}

          <div className="mt-4 rounded-md border border-border bg-background/60 p-3">
            <p className="label-caps">To enable live mode on the laptop</p>
            <pre className="mt-2 overflow-x-auto font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
{`pip install flask-cors

# in main.py, just after app = Flask(__name__):
from flask_cors import CORS
CORS(app)

# expose a health + feed endpoint the console can poll:
@app.get("/health")
def health():
    return {"status": "ok"}`}
            </pre>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Demo controls</h2>
          <div className="mt-4 flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Global auto-heal</p>
              <p className="text-xs text-muted-foreground">
                Let the bot apply cleared runbooks without an operator
              </p>
            </div>
            <Switch
              checked={settings.autoHealGlobal}
              onCheckedChange={(v) => setSettings({ autoHealGlobal: v })}
            />
          </div>

          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              resetDemo();
              toast.success("Demo dataset reset");
            }}
          >
            <RotateCcw className="size-4" />
            Reset demo data
          </Button>

          <p className="label-caps mt-6">Devices in inventory</p>
          <ul className="mt-2 divide-y divide-border">
            {devices.map((d) => (
              <li key={d.hostname} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <p className="font-mono text-foreground">{d.hostname}</p>
                  <p className="text-muted-foreground">{d.site}</p>
                </div>
                <span className="font-mono text-muted-foreground">{d.host}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
