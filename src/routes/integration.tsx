import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCopy, Plug } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/noc/app-shell";
import { Pill } from "@/components/noc/severity";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/integration")({
  head: () => ({
    meta: [
      { title: "Backend Integration Guide — NOC Bot Console" },
      {
        name: "description",
        content:
          "Step-by-step instructions to connect this console to the local Python NOC bot without changing its diagnosis or auto-heal flow.",
      },
      { property: "og:title", content: "Backend Integration Guide — NOC Bot Console" },
      {
        property: "og:description",
        content:
          "Add a read-only feed endpoint to the Flask bot and stream real incidents into the console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationPage,
});

function Code({ children }: { children: string }) {
  return (
    <div className="relative mt-3 rounded-md border border-border bg-background/70">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-1.5 top-1.5 h-7 px-2 text-xs"
        onClick={() => {
          void navigator.clipboard.writeText(children);
          toast.success("Copied to clipboard");
        }}
      >
        <ClipboardCopy className="size-3.5" />
        Copy
      </Button>
      <pre className="overflow-x-auto p-4 pr-20 font-mono text-[0.72rem] leading-relaxed text-muted-foreground">
        {children}
      </pre>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary">
          {n}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function IntegrationPage() {
  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <Plug className="size-5 text-primary" />
        <h1 className="text-2xl font-bold">Backend integration</h1>
        <Pill tone="primary" className="ml-auto">
          non-breaking
        </Pill>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        The console reads from your existing bot — it never changes how alerts are parsed, how the
        RAG runbook match is scored, or how remediation is executed. You add one read-only endpoint;
        the Ollama diagnosis flow stays exactly as it is today.
      </p>

      <div className="mt-6 grid gap-4">
        <Step n={1} title="Install the CORS shim (one command)">
          <p>
            The browser runs on a different origin than <code>127.0.0.1:5000</code>, so the bot must
            allow cross-origin reads. This adds no logic to the pipeline.
          </p>
          <Code>{`venv\\Scripts\\activate
pip install flask-cors`}</Code>
        </Step>

        <Step n={2} title="Keep a rolling copy of every incident card">
          <p>
            Your handler already builds the incident card it prints and posts to Teams. Append that
            same object to an in-memory list — do not rebuild or re-order anything.
          </p>
          <Code>{`# main.py — near the top, after app = Flask(__name__)
from collections import deque
from flask_cors import CORS

CORS(app)                      # allow the console to read
INCIDENTS = deque(maxlen=200)  # rolling buffer, newest last`}</Code>
        </Step>

        <Step n={3} title="Record the card at the end of your existing webhook">
          <p>
            One line, placed <em>after</em> the card is fully built and just before you return it, so
            a failure anywhere earlier behaves exactly as before.
          </p>
          <Code>{`@app.post("/alert")
def alert():
    ...                        # existing parse -> RAG match -> diagnose -> heal
    card = build_incident_card(...)   # whatever you already return

    try:
        INCIDENTS.append(card)        # console feed (never breaks the flow)
    except Exception:
        pass

    return jsonify(card), 200`}</Code>
        </Step>

        <Step n={4} title="Expose the read-only feed + health endpoints">
          <p>
            These are pure reads. The console polls <code>/incidents</code> every 5 seconds and uses{" "}
            <code>/health</code> for the connection pill.
          </p>
          <Code>{`@app.get("/health")
def health():
    return {"status": "ok", "live_diagnostics": LIVE_DIAGNOSTICS}

@app.get("/incidents")
def incidents():
    # newest first — the console dedupes by id
    return jsonify({"incidents": list(INCIDENTS)[::-1]})`}</Code>
        </Step>

        <Step n={5} title="Match the field names (or don't — the adapter is tolerant)">
          <p>
            The console accepts snake_case or camelCase and falls back safely on anything missing.
            This is the richest shape it understands:
          </p>
          <Code>{`{
  "id": "INC-2042",
  "received_at": "2026-08-20T11:04:12Z",
  "severity": "critical",           # critical | major | minor | info
  "status": "triaged",              # new | triaged | healing | resolved
  "hostname": "sw-lab-access-04",
  "interface": "GigabitEthernet0/48",
  "category": "port-down",          # matches your runbook slug
  "raw_alert": "CRIT: gi0/48 down on sw-lab-access-04",
  "summary": "Access switch lost its uplink.",
  "diagnosis": "<the Ollama explanation>",
  "runbook": "port-down.md",
  "confidence": 0.87,               # your RAG match score
  "diagnostics": [
    {"command": "show interface Gi0/48 status",
     "output": "...", "duration_ms": 640}
  ],
  "recommended_actions": ["Bounce the uplink port", "Check far-end on core-01"],
  "remediation": [
    {"description": "Bounce the interface",
     "command": "interface Gi0/48 ; shutdown ; no shutdown"}
  ],
  "heal_log": ["11:04:15 Executed shut/no shut", "11:04:22 Link up — closed"],
  "healed_at": "2026-08-20T11:04:22Z"
}`}</Code>
          <p className="flex items-start gap-2 pt-1 text-xs text-success">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            Missing fields are filled with safe defaults, so a partial card still renders instead of
            erroring mid-demo.
          </p>
        </Step>

        <Step n={6} title="Restart the bot and flip the console to live">
          <p>
            Restart <code>python main.py</code>, then go to Settings → toggle{" "}
            <strong>Use live bot</strong>, confirm the URL is{" "}
            <code>http://127.0.0.1:5000</code> and press <strong>Test connection</strong>. Fire a
            test alert and it appears in the feed within five seconds.
          </p>
          <Code>{`python -m alert_source.send_test_alert port_down`}</Code>
        </Step>

        <Step n={7} title="Demo-safe behaviour you can rely on">
          <ul className="list-disc space-y-1 pl-5">
            <li>Live incidents merge over the demo set by id — nothing is ever wiped mid-demo.</li>
            <li>
              If the laptop, VPN or bot drops, the console keeps the last good state and shows an
              amber status pill instead of an error screen.
            </li>
            <li>
              Turning live mode off instantly returns you to the boardroom-safe sample dataset.
            </li>
            <li>
              Natural-language questions are answered from whatever is on screen — live or demo —
              so the answers always match what management is looking at.
            </li>
          </ul>
        </Step>
      </div>
    </AppShell>
  );
}
