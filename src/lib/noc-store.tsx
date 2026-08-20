import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deviceByHostname, seedIncidents, seedKnowledge } from "./noc-data";
import { fetchLiveIncidents, mergeIncidents } from "./noc-live";
import type { Incident, KnowledgeEntry, Settings, Severity } from "./noc-types";

const STORAGE_KEY = "noc-bot-console-v1";

interface Persisted {
  incidents: Incident[];
  knowledge: KnowledgeEntry[];
  settings: Settings;
}

const defaultSettings: Settings = {
  liveMode: false,
  botUrl: "http://127.0.0.1:5000",
  autoHealGlobal: true,
};

type LiveStatus = "offline" | "connecting" | "connected" | "error";

interface NocContextValue extends Persisted {
  liveStatus: LiveStatus;
  liveError: string | null;
  lastSyncAt: string | null;
  liveCount: number;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: string, patch: Partial<Incident>) => void;
  injectRandomAlert: () => Incident;
  runAutoHeal: (id: string) => void;
  addKnowledge: (entry: Omit<KnowledgeEntry, "id" | "createdAt" | "origin">) => void;
  toggleKnowledgeAutoHeal: (id: string, value: boolean) => void;
  removeKnowledge: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  testConnection: () => Promise<void>;
  resetDemo: () => void;
  snapshot: () => string;
}

const NocContext = createContext<NocContextValue | null>(null);

const templates: Array<{
  severity: Severity;
  hostname: string;
  interfaceName?: string;
  category: string;
  rawAlert: string;
  summary: string;
  diagnosis: string;
  runbook: string;
  recommendedActions: string[];
}> = [
  {
    severity: "critical",
    hostname: "sw-lab-access-04",
    interfaceName: "GigabitEthernet0/48",
    category: "port-down",
    rawAlert: "CRIT: gi0/48 down on sw-lab-access-04 (uplink lost)",
    summary: "Access switch lost its uplink to the core.",
    diagnosis:
      "Uplink Gi0/48 shows notconnect with no recent config change; matches the port-down runbook (physical link branch).",
    runbook: "port-down.md",
    recommendedActions: [
      "Bounce the uplink port to clear a possible err-disable state.",
      "If it stays down, check the far-end port on sw-lab-core-01.",
    ],
  },
  {
    severity: "major",
    hostname: "rtr-lab-edge-01",
    category: "high-latency",
    rawAlert: "MAJOR: RTT to 1.1.1.1 = 268ms avg over 5m (baseline 19ms)",
    summary: "WAN latency spike on the primary circuit.",
    diagnosis:
      "Elevated RTT with egress queue drops on Gi0/0/0 — circuit congestion rather than an ISP transit fault.",
    runbook: "high-latency.md",
    recommendedActions: [
      "Check the top talkers on the WAN edge.",
      "Escalate to Airtel with circuit AIR-CHN-88412 if drops persist.",
    ],
  },
  {
    severity: "major",
    hostname: "sw-blr-access-02",
    interfaceName: "GigabitEthernet0/9",
    category: "interface-errors",
    rawAlert: "MAJOR: 1,904 CRC errors in 5m on gi0/9 (sw-blr-access-02)",
    summary: "CRC errors climbing on a Bengaluru access port.",
    diagnosis:
      "CRC-heavy input errors with clean output counters — cabling or duplex mismatch at the host end.",
    runbook: "interface-errors.md",
    recommendedActions: ["Reseat/replace the patch lead.", "Pin speed and duplex on both ends."],
  },
  {
    severity: "minor",
    hostname: "fw-lab-perim-01",
    category: "ha-sync",
    rawAlert: "MINOR: HA peer out of sync 41s on fw-lab-perim-01",
    summary: "Brief HA sync lag on the perimeter firewall pair.",
    diagnosis: "Session-sync lag after a policy install; expected to self-clear within 2 minutes.",
    runbook: "fortigate-ha.md",
    recommendedActions: ["Monitor — re-check HA checksum if it persists past 3 minutes."],
  },
];

function makeIncident(seq: number): Incident {
  const t = templates[seq % templates.length]!;
  const device = deviceByHostname(t.hostname);
  return {
    id: `INC-${2042 + seq}`,
    receivedAt: new Date().toISOString(),
    severity: t.severity,
    status: "new",
    hostname: t.hostname,
    interfaceName: t.interfaceName,
    category: t.category,
    rawAlert: t.rawAlert,
    summary: t.summary,
    diagnosis: t.diagnosis,
    runbook: t.runbook,
    matchConfidence: 0.72 + ((seq * 7) % 23) / 100,
    diagnostics: [
      {
        command: t.interfaceName
          ? `show interface ${t.interfaceName} status`
          : "show interface Gi0/0/0 | include rate|drops",
        output: t.interfaceName
          ? `Port      Name        Status      Vlan  Duplex  Speed Type\n${t.interfaceName.replace("GigabitEthernet", "Gi")}  auto-collected  notconnect  110   auto    auto  1000BaseSX`
          : "  5 minute output rate 191,004,000 bits/sec\n     Output queue: 64/64 (size/max), 9,214 drops",
        durationMs: 600 + (seq % 5) * 120,
      },
      {
        command: "show logging | include %LINK|%LINEPROTO",
        output: `*${new Date().toLocaleTimeString()}: %LINK-3-UPDOWN: state change detected on ${device?.hostname ?? t.hostname}`,
        durationMs: 540,
      },
    ],
    recommendedActions: t.recommendedActions,
    remediation: t.interfaceName
      ? [
          {
            description: "Bounce the interface",
            command: `interface ${t.interfaceName} ; shutdown ; no shutdown`,
          },
        ]
      : undefined,
    source: "sample",
  };
}

function load(): Persisted {
  if (typeof window === "undefined") {
    return { incidents: seedIncidents, knowledge: seedKnowledge, settings: defaultSettings };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      incidents: parsed.incidents?.length ? parsed.incidents : seedIncidents,
      knowledge: parsed.knowledge?.length ? parsed.knowledge : seedKnowledge,
      settings: { ...defaultSettings, ...parsed.settings },
    };
  } catch {
    return { incidents: seedIncidents, knowledge: seedKnowledge, settings: defaultSettings };
  }
}

export function NocProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => ({
    incidents: seedIncidents,
    knowledge: seedKnowledge,
    settings: defaultSettings,
  }));
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("offline");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const hydrated = useRef(false);
  const seq = useRef(0);

  useEffect(() => {
    setState(load());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Live mode: poll the local Python bot's incident feed every 5s. Failures are
  // surfaced as a status pill only — the console keeps rendering whatever it
  // already has, so a flaky laptop connection never breaks the demo flow.
  const botUrl = state.settings.botUrl;
  const liveMode = state.settings.liveMode;
  useEffect(() => {
    if (!liveMode) {
      setLiveStatus("offline");
      setLiveError(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLiveStatus("connecting");

    const tick = async () => {
      const { incidents, error } = await fetchLiveIncidents(botUrl, controller.signal);
      if (cancelled) return;
      if (error) {
        setLiveStatus("error");
        setLiveError(error);
        return;
      }
      setLiveStatus("connected");
      setLiveError(null);
      setLastSyncAt(new Date().toISOString());
      setLiveCount(incidents.length);
      if (incidents.length) {
        setState((s) => ({ ...s, incidents: mergeIncidents(s.incidents, incidents) }));
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [liveMode, botUrl]);

  const updateIncident = useCallback((id: string, patch: Partial<Incident>) => {
    setState((s) => ({
      ...s,
      incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const addIncident = useCallback((incident: Incident) => {
    setState((s) => ({ ...s, incidents: [incident, ...s.incidents] }));
  }, []);

  const runAutoHeal = useCallback(
    (id: string) => {
      setState((s) => {
        const incident = s.incidents.find((i) => i.id === id);
        if (!incident) return s;
        const kb = s.knowledge.find((k) => k.category === incident.category);
        const steps = incident.remediation ?? kb?.remediation ?? [];
        const stamp = () => new Date().toLocaleTimeString();
        const log = [
          `${stamp()}  Matched runbook ${kb?.title ?? incident.runbook} (confidence ${incident.matchConfidence.toFixed(2)})`,
          `${stamp()}  Opened session to ${deviceByHostname(incident.hostname)?.host ?? incident.hostname}`,
          ...steps.map(
            (step) =>
              `${stamp()}  Executed: ${step.command.replaceAll("{{intf}}", incident.interfaceName ?? "Gi0/1")}`,
          ),
          `${stamp()}  Verified state — incident closed by auto-heal`,
        ];
        return {
          ...s,
          incidents: s.incidents.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "resolved",
                  healedAt: new Date().toISOString(),
                  healLog: [...(i.healLog ?? []), ...log],
                }
              : i,
          ),
        };
      });
    },
    [],
  );

  const injectRandomAlert = useCallback(() => {
    const incident = makeIncident(seq.current++);
    setState((s) => ({ ...s, incidents: [incident, ...s.incidents] }));
    setTimeout(() => {
      setState((s) => {
        const kb = s.knowledge.find((k) => k.category === incident.category);
        if (!s.settings.autoHealGlobal || !kb?.autoHeal) {
          return {
            ...s,
            incidents: s.incidents.map((i) =>
              i.id === incident.id ? { ...i, status: "triaged" } : i,
            ),
          };
        }
        return {
          ...s,
          incidents: s.incidents.map((i) =>
            i.id === incident.id ? { ...i, status: "healing" } : i,
          ),
        };
      });
    }, 1400);
    return incident;
  }, []);

  const addKnowledge = useCallback(
    (entry: Omit<KnowledgeEntry, "id" | "createdAt" | "origin">) => {
      setState((s) => ({
        ...s,
        knowledge: [
          {
            ...entry,
            id: `KB-${String(s.knowledge.length + 1).padStart(3, "0")}-L`,
            createdAt: new Date().toISOString(),
            origin: "learned",
          },
          ...s.knowledge,
        ],
      }));
    },
    [],
  );

  const toggleKnowledgeAutoHeal = useCallback((id: string, value: boolean) => {
    setState((s) => ({
      ...s,
      knowledge: s.knowledge.map((k) => (k.id === id ? { ...k, autoHeal: value } : k)),
    }));
  }, []);

  const removeKnowledge = useCallback((id: string) => {
    setState((s) => ({ ...s, knowledge: s.knowledge.filter((k) => k.id !== id) }));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const testConnection = useCallback(async () => {
    setLiveStatus("connecting");
    setLiveError(null);
    try {
      const res = await fetch(`${state.settings.botUrl.replace(/\/$/, "")}/health`, {
        method: "GET",
        mode: "cors",
      });
      if (!res.ok) throw new Error(`Bot replied ${res.status}`);
      setLiveStatus("connected");
    } catch (err) {
      setLiveStatus("error");
      setLiveError(
        err instanceof Error
          ? `${err.message} — check the bot is running and CORS is allowed for this origin.`
          : "Unknown error",
      );
    }
  }, [state.settings.botUrl]);

  const resetDemo = useCallback(() => {
    seq.current = 0;
    setState({ incidents: seedIncidents, knowledge: seedKnowledge, settings: defaultSettings });
  }, []);

  const snapshot = useCallback(() => {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      incidents: state.incidents.map((i) => ({
        id: i.id,
        receivedAt: i.receivedAt,
        severity: i.severity,
        status: i.status,
        hostname: i.hostname,
        site: deviceByHostname(i.hostname)?.site,
        circuit: deviceByHostname(i.hostname)?.circuit,
        interface: i.interfaceName,
        category: i.category,
        alert: i.rawAlert,
        diagnosis: i.diagnosis,
        runbook: i.runbook,
        confidence: i.matchConfidence,
        actions: i.recommendedActions,
        healed: Boolean(i.healedAt),
      })),
      knowledge: state.knowledge.map((k) => ({
        id: k.id,
        title: k.title,
        category: k.category,
        vendor: k.vendor,
        symptoms: k.symptoms,
        rootCause: k.rootCause,
        autoHeal: k.autoHeal,
      })),
    });
  }, [state.incidents, state.knowledge]);

  const value = useMemo<NocContextValue>(
    () => ({
      ...state,
      liveStatus,
      liveError,
      addIncident,
      updateIncident,
      injectRandomAlert,
      runAutoHeal,
      addKnowledge,
      toggleKnowledgeAutoHeal,
      removeKnowledge,
      setSettings,
      testConnection,
      resetDemo,
      snapshot,
    }),
    [
      state,
      liveStatus,
      liveError,
      addIncident,
      updateIncident,
      injectRandomAlert,
      runAutoHeal,
      addKnowledge,
      toggleKnowledgeAutoHeal,
      removeKnowledge,
      setSettings,
      testConnection,
      resetDemo,
      snapshot,
    ],
  );

  return <NocContext.Provider value={value}>{children}</NocContext.Provider>;
}

export function useNoc() {
  const ctx = useContext(NocContext);
  if (!ctx) throw new Error("useNoc must be used inside NocProvider");
  return ctx;
}
