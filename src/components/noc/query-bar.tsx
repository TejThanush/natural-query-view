import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, TerminalSquare } from "lucide-react";
import { askNoc } from "@/lib/noc-ai.functions";
import { useNoc } from "@/lib/noc-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncidentCard } from "./incident-card";
import { Pill } from "./severity";

const suggestions = [
  "Which sites had port-down alerts today?",
  "What is the riskiest open incident right now?",
  "Summarise WAN latency for management",
  "Which incidents did the bot heal on its own?",
];

export function QueryBar() {
  const { snapshot, incidents } = useNoc();
  const ask = useServerFn(askNoc);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);

  async function run(q: string) {
    if (!q.trim() || pending) return;
    setQuestion(q);
    setPending(true);
    setError(null);
    setAnswer(null);
    setMatched([]);
    setFollowUps([]);
    try {
      const res = await ask({ data: { question: q, snapshot: snapshot() } });
      setAnswer(res.answer);
      setMatched(res.incidentIds);
      setFollowUps(res.followUps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The analyst could not be reached.");
    } finally {
      setPending(false);
    }
  }

  const matchedIncidents = incidents.filter((i) => matched.includes(i.id));

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Ask the NOC</h2>
        <Pill tone="primary" className="ml-auto">
          natural language
        </Pill>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. which devices in Chennai are still degraded?"
          className="h-11 flex-1 font-mono text-sm"
        />
        <Button type="submit" size="lg" disabled={pending || !question.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <TerminalSquare className="size-4" />}
          {pending ? "Analysing" : "Ask"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void run(s)}
            className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      ) : null}

      {answer ? (
        <div className="rise-in mt-4 rounded-md border border-primary/25 bg-primary/5 p-4">
          <p className="label-caps mb-2">Analyst response</p>
          <div className="space-y-2 text-sm leading-relaxed">
            {answer
              .split("\n")
              .filter(Boolean)
              .map((line, idx) => (
                <p key={idx} className={line.trimStart().startsWith("-") ? "pl-4" : ""}>
                  {line.replace(/^[-*]\s*/, "• ").replaceAll("**", "")}
                </p>
              ))}
          </div>
        </div>
      ) : null}

      {matchedIncidents.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {matchedIncidents.map((i) => (
            <IncidentCard key={i.id} incident={i} highlighted />
          ))}
        </div>
      ) : null}

      {followUps.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {followUps.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => void run(f)}
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              {f}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
