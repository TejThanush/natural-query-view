import type { Incident, Severity } from "./noc-types";

/**
 * Tolerant adapter for the local Python NOC bot.
 *
 * The bot's incident card JSON has evolved across versions, so every field is
 * read defensively: anything missing falls back to a safe default and the
 * console keeps rendering. A live fetch NEVER throws into the UI — callers get
 * `{ incidents, error }` and the demo dataset stays untouched on failure.
 */

const severities: Severity[] = ["critical", "major", "minor", "info"];

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function toSeverity(v: unknown): Severity {
  const s = String(v ?? "").toLowerCase();
  const hit = severities.find((x) => s.includes(x));
  if (hit) return hit;
  if (s.includes("crit") || s.includes("p1")) return "critical";
  if (s.includes("warn") || s.includes("p2")) return "major";
  return "info";
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/\r?\n|(?<=\.)\s+(?=[A-Z])/)
      .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

/** Map one raw incident card from the bot into the console's Incident shape. */
export function normalizeIncident(raw: unknown, index: number): Incident | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const card = (typeof o["incident"] === "object" && o["incident"]
    ? (o["incident"] as Record<string, unknown>)
    : o) as Record<string, unknown>;

  const hostname = str(pick(card, "hostname", "host", "device", "device_name"), "unknown-device");
  const id = str(pick(card, "id", "incident_id", "ticket"), `LIVE-${index + 1}`);
  const rawAlert = str(pick(card, "raw_alert", "rawAlert", "alert", "message"), "(no alert text)");
  const diagnostics = Array.isArray(pick(card, "diagnostics", "commands", "outputs"))
    ? (pick(card, "diagnostics", "commands", "outputs") as unknown[]).map((d) => {
        const x = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
        return {
          command: str(pick(x, "command", "cmd"), typeof d === "string" ? d : "show version"),
          output: str(pick(x, "output", "result", "stdout"), ""),
          durationMs: Number(pick(x, "duration_ms", "durationMs") ?? 0) || 0,
        };
      })
    : [];

  const remediationRaw = pick(card, "remediation", "fix_steps", "actions_taken");
  const remediation = Array.isArray(remediationRaw)
    ? remediationRaw.map((s) => {
        const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        return {
          description: str(pick(x, "description", "step"), typeof s === "string" ? s : "Step"),
          command: str(pick(x, "command", "cmd"), ""),
        };
      })
    : undefined;

  const healLog = toList(pick(card, "heal_log", "healLog", "audit"));
  const healedAt = str(pick(card, "healed_at", "healedAt"));

  return {
    id,
    receivedAt: str(pick(card, "received_at", "receivedAt", "timestamp"), new Date().toISOString()),
    severity: toSeverity(pick(card, "severity", "priority", "level")),
    status: healedAt
      ? "resolved"
      : (["new", "triaged", "healing", "resolved"] as const).find(
            (s) => s === String(pick(card, "status") ?? "").toLowerCase(),
          ) ?? "triaged",
    hostname,
    interfaceName: str(pick(card, "interface", "interface_name", "intf")) || undefined,
    category: str(pick(card, "category", "runbook_category", "type"), "uncategorised"),
    rawAlert,
    summary: str(pick(card, "summary", "headline"), rawAlert),
    diagnosis: str(pick(card, "diagnosis", "analysis", "explanation"), "No diagnosis returned."),
    runbook: str(pick(card, "runbook", "runbook_file", "matched_runbook"), "unmatched"),
    matchConfidence: Number(pick(card, "confidence", "match_confidence", "score") ?? 0.6) || 0.6,
    diagnostics,
    recommendedActions: toList(
      pick(card, "recommended_actions", "recommendedActions", "next_steps", "recommendation"),
    ),
    remediation: remediation && remediation.length ? remediation : undefined,
    healedAt: healedAt || undefined,
    healLog: healLog.length ? healLog : undefined,
    source: "live",
  };
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["incidents", "items", "data", "results"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
    if (o["hostname"] || o["raw_alert"] || o["incident"]) return [payload];
  }
  return [];
}

export interface LiveFetch {
  incidents: Incident[];
  error: string | null;
}

/** Poll the bot's incident feed. Never throws. */
export async function fetchLiveIncidents(botUrl: string, signal?: AbortSignal): Promise<LiveFetch> {
  const base = botUrl.replace(/\/$/, "");
  const paths = ["/incidents", "/api/incidents", "/feed"];
  let lastError = "No incident feed endpoint found on the bot.";

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "GET",
        mode: "cors",
        headers: { accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
      if (!res.ok) {
        lastError = `Bot replied ${res.status} on ${path}`;
        continue;
      }
      const payload: unknown = await res.json();
      const items = extractArray(payload);
      const incidents = items
        .map((raw, i) => normalizeIncident(raw, i))
        .filter((i): i is Incident => Boolean(i));
      return { incidents, error: null };
    } catch (err) {
      if (signal?.aborted) return { incidents: [], error: null };
      lastError =
        err instanceof Error
          ? `${err.message} — is the bot running and is CORS allowed for this origin?`
          : "Unknown error contacting the bot.";
    }
  }
  return { incidents: [], error: lastError };
}

/** Merge live incidents over the existing list, newest first, deduped by id. */
export function mergeIncidents(existing: Incident[], live: Incident[]): Incident[] {
  const byId = new Map<string, Incident>();
  for (const i of live) byId.set(i.id, i);
  const kept = existing.filter((i) => !byId.has(i.id));
  return [...live, ...kept].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}
