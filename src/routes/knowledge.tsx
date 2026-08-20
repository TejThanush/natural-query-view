import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { AppShell } from "@/components/noc/app-shell";
import { Pill } from "@/components/noc/severity";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { draftKnowledge } from "@/lib/noc-ai.functions";
import { useNoc } from "@/lib/noc-store";
import type { KnowledgeEntry, RemediationStep } from "@/lib/noc-types";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Runbook Knowledge — NOC Bot Console" },
      {
        name: "description",
        content:
          "Teach the NOC bot new failure signatures and safe remediation commands so it can self-heal future incidents.",
      },
      { property: "og:title", content: "Runbook Knowledge — NOC Bot Console" },
      {
        property: "og:description",
        content: "Feed new troubleshooting knowledge to the bot and clear runbooks for auto-heal.",
      },
    ],
  }),
  component: KnowledgePage,
});

type Draft = Omit<KnowledgeEntry, "id" | "createdAt" | "origin">;

const example =
  "When a Fortinet SD-WAN member flaps, the alert says 'SD-WAN health-check failed'. It's usually the health-check server being unreachable, not the link. Check 'diagnose sys sdwan health-check' and if only one server is failing, disable that member's health check probe and re-enable it.";

function KnowledgePage() {
  const { knowledge, addKnowledge, toggleKnowledgeAutoHeal, removeKnowledge, settings, setSettings } =
    useNoc();
  const structure = useServerFn(draftKnowledge);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!note.trim() || pending) return;
    setPending(true);
    setError(null);
    setDraft(null);
    try {
      const res = await structure({ data: { note } });
      const parsed = JSON.parse(res.json) as Partial<Draft>;
      setDraft({
        title: parsed.title ?? "Untitled runbook",
        category: parsed.category ?? "general",
        vendor: parsed.vendor ?? "any",
        symptoms: (parsed.symptoms ?? []).slice(0, 6),
        rootCause: parsed.rootCause ?? "",
        remediation: (parsed.remediation ?? []).slice(0, 5) as RemediationStep[],
        autoHeal: Boolean(parsed.autoHeal),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not structure that note.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Runbook knowledge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What the bot knows, and what it is allowed to fix on its own.
          </p>
        </div>
        <div className="panel flex items-center gap-3 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium">Global auto-heal</p>
            <p className="text-xs text-muted-foreground">Master switch for unattended fixes</p>
          </div>
          <Switch
            checked={settings.autoHealGlobal}
            onCheckedChange={(v) => setSettings({ autoHealGlobal: v })}
          />
        </div>
      </div>

      <section className="panel mt-6 p-5">
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Teach the bot something new</h2>
          <Pill tone="primary" className="ml-auto">
            AI structured
          </Pill>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Describe a fault the way you would to a colleague. The bot turns it into a matchable
          signature plus remediation commands.
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          placeholder={example}
          className="mt-3 font-mono text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void generate()} disabled={pending || !note.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {pending ? "Structuring" : "Structure this knowledge"}
          </Button>
          <Button variant="outline" onClick={() => setNote(example)}>
            Use example
          </Button>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {draft ? (
          <div className="rise-in mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="label-caps">Proposed runbook entry</p>
            <h3 className="mt-2 text-base font-semibold">{draft.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="primary">{draft.category}</Pill>
              <Pill tone="info">{draft.vendor}</Pill>
              {draft.autoHeal ? <Pill tone="success">auto-heal safe</Pill> : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{draft.rootCause}</p>
            <p className="label-caps mt-4">Match on</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {draft.symptoms.map((s) => (
                <code key={s} className="rounded bg-muted px-2 py-0.5 font-mono text-[0.7rem]">
                  {s}
                </code>
              ))}
            </div>
            <p className="label-caps mt-4">Remediation</p>
            <ul className="mt-1.5 space-y-1.5">
              {draft.remediation.map((r) => (
                <li key={r.command} className="text-xs">
                  <span className="text-muted-foreground">{r.description}</span>
                  <code className="mt-0.5 block font-mono text-primary">{r.command}</code>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  addKnowledge(draft);
                  setDraft(null);
                  setNote("");
                  toast.success("Knowledge added", {
                    description: `${draft.title} is now matchable by the bot.`,
                  });
                }}
              >
                Add to knowledge base
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {knowledge.map((k) => (
          <article key={k.id} className="panel p-5">
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{k.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="primary">{k.category}</Pill>
                  <Pill tone="info">{k.vendor}</Pill>
                  <Pill tone={k.origin === "learned" ? "success" : "info"}>{k.origin}</Pill>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeKnowledge(k.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`Remove ${k.title}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{k.rootCause}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {k.symptoms.map((s) => (
                <code key={s} className="rounded bg-muted px-2 py-0.5 font-mono text-[0.7rem]">
                  {s}
                </code>
              ))}
            </div>

            <ul className="mt-3 space-y-1">
              {k.remediation.map((r) => (
                <li key={r.command} className="font-mono text-[0.7rem] text-primary">
                  {r.command}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="label-caps">Auto-heal</span>
              <Switch
                checked={k.autoHeal}
                onCheckedChange={(v) => toggleKnowledgeAutoHeal(k.id, v)}
              />
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
