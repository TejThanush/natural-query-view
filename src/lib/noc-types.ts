export type Severity = "critical" | "major" | "minor" | "info";

export type IncidentStatus = "new" | "triaged" | "healing" | "resolved";

export interface Device {
  hostname: string;
  vendor: "cisco_xe" | "fortinet";
  host: string;
  site: string;
  topology: string;
  circuit: string;
  ispContact: string;
}

export interface DiagnosticRun {
  command: string;
  output: string;
  durationMs: number;
}

export interface RemediationStep {
  description: string;
  command: string;
}

export interface Incident {
  id: string;
  receivedAt: string;
  severity: Severity;
  status: IncidentStatus;
  hostname: string;
  interfaceName?: string | undefined;
  category: string;
  rawAlert: string;
  summary: string;
  diagnosis: string;
  runbook: string;
  matchConfidence: number;
  diagnostics: DiagnosticRun[];
  recommendedActions: string[];
  remediation?: RemediationStep[] | undefined;
  healedAt?: string | undefined;
  healLog?: string[] | undefined;
  source: "sample" | "live";
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  vendor: "cisco_xe" | "fortinet" | "any";
  symptoms: string[];
  rootCause: string;
  remediation: RemediationStep[];
  autoHeal: boolean;
  origin: "builtin" | "learned";
  createdAt: string;
}

export interface Settings {
  liveMode: boolean;
  botUrl: string;
  autoHealGlobal: boolean;
}
