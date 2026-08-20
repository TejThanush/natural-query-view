import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(1),
  snapshot: z.string(),
});

const DraftInput = z.object({
  note: z.string().min(1),
});

export const askNoc = createServerFn({ method: "POST" })
  .validator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { createLovableGateway, NOC_MODEL, extractJson } = await import("./ai-gateway.server");
    const gateway = createLovableGateway(key);

    const result = streamText({
      model: gateway(NOC_MODEL),
      system: [
        "You are the NOC Bot analyst for a network operations team.",
        "You answer questions strictly from the JSON snapshot of incidents, devices and runbook knowledge provided by the user.",
        "Be concise and operational: lead with the answer, then 2-5 short supporting bullets. Use device hostnames and incident IDs.",
        "If the snapshot does not contain the answer, say so plainly instead of guessing.",
        "Reply with ONLY a JSON object of the shape:",
        '{"answer": "markdown string", "incidentIds": ["INC-1234"], "followUps": ["short question", "short question"]}',
        "incidentIds must reference incidents relevant to the answer (may be empty). Give at most 3 followUps, each under 60 characters.",
      ].join("\n"),
      prompt: `SNAPSHOT:\n${data.snapshot}\n\nQUESTION: ${data.question}`,
    });

    const text = await result.text;
    const parsed = extractJson<{
      answer?: string;
      incidentIds?: string[];
      followUps?: string[];
    }>(text);

    return {
      answer: parsed?.answer?.trim() || text.trim() || "No answer returned.",
      incidentIds: (parsed?.incidentIds ?? []).slice(0, 8),
      followUps: (parsed?.followUps ?? []).slice(0, 3),
    };
  });

export const draftKnowledge = createServerFn({ method: "POST" })
  .validator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { createLovableGateway, NOC_MODEL, extractJson } = await import("./ai-gateway.server");
    const gateway = createLovableGateway(key);

    const result = streamText({
      model: gateway(NOC_MODEL),
      system: [
        "You convert an engineer's freeform troubleshooting note into a structured NOC runbook entry.",
        "Reply with ONLY a JSON object:",
        '{"title":"","category":"","vendor":"cisco_xe|fortinet|any","symptoms":["..."],"rootCause":"","remediation":[{"description":"","command":""}],"autoHeal":false}',
        "category is a short kebab-case slug such as port-down, interface-errors, high-latency, bgp-flap.",
        "symptoms are short log/alert substrings the bot can match on (max 6).",
        "remediation holds real device CLI commands (max 5 steps); use {{intf}} as a placeholder for the interface.",
        "Set autoHeal true only when the steps are safe, idempotent and non-service-affecting.",
      ].join("\n"),
      prompt: data.note,
    });

    const text = await result.text;
    const parsed = extractJson<Record<string, unknown>>(text);
    if (!parsed) throw new Error("Could not structure that note — try adding more detail.");
    return { json: JSON.stringify(parsed) };
  });
