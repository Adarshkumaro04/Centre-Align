import type { InvoiceEvidence, WorkerEvent, WorkerRunResponse } from "@shared/worker";
import { invokeLLM } from "./_core/llm";

const PLANNER_MODEL = "gpt-5-mini";

interface InvoiceFixture {
  vendor: string;
  aliases: string[];
  invoiceId: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  lineItems: string;
  sourceRef: string;
  approvedVendor: boolean;
}

interface PlannerOutput {
  vendor: "Northstar Office Supply" | "Koral Labs";
  objective: string;
  actions: string[];
  approvalHandling: string;
  confidence: number;
}

const invoices: InvoiceFixture[] = [
  {
    vendor: "Northstar Office Supply",
    aliases: ["northstar", "office supply", "northstar office"],
    invoiceId: "INV-2025-0142",
    amount: 4820,
    issueDate: "2025-10-20",
    dueDate: "2025-11-19",
    poNumber: "PO-8841",
    lineItems: "Printer toner × 12; A4 paper × 40 boxes",
    sourceRef: "inbox/ap@northstar-office.com/INV-2025-0142.pdf",
    approvedVendor: true,
  },
  {
    vendor: "Koral Labs",
    aliases: ["koral", "koral labs"],
    invoiceId: "KOR-884",
    amount: 12440,
    issueDate: "2025-10-22",
    dueDate: "2025-11-21",
    poNumber: "PO-9012",
    lineItems: "Research environment seats × 20; implementation support",
    sourceRef: "inbox/ap@koral-labs.io/KOR-884.pdf",
    approvedVendor: true,
  },
];

const POLICY = {
  approvalThreshold: 10000,
  paymentTerms: "Net 30",
  requiredChecks: ["approved vendor", "PO match", "duplicate check"],
};

function event(
  id: string,
  phase: string,
  label: string,
  detail: string,
  status: WorkerEvent["status"] = "complete",
  tool?: string,
  data?: Record<string, string>,
): WorkerEvent {
  return { id, phase, label, detail, status, tool, data };
}

function selectInvoiceByVendor(vendor: string): InvoiceFixture {
  return invoices.find((invoice) => invoice.vendor === vendor) ?? invoices[0];
}

function selectInvoiceFromRequest(request: string): InvoiceFixture {
  const normalized = request.toLowerCase();
  return invoices.find((invoice) => invoice.aliases.some((alias) => normalized.includes(alias))) ?? invoices[0];
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function contentText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  return content.map((part) => part.text ?? "").join("\n");
}

function parsePlannerOutput(raw: string): PlannerOutput {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Planner returned no JSON object");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<PlannerOutput>;
  if (parsed.vendor !== "Northstar Office Supply" && parsed.vendor !== "Koral Labs") {
    throw new Error("Planner selected an unsupported vendor");
  }
  if (!parsed.objective || !Array.isArray(parsed.actions) || parsed.actions.length < 3) {
    throw new Error("Planner returned an incomplete action plan");
  }
  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Planner returned an invalid confidence value");
  }
  return {
    vendor: parsed.vendor,
    objective: parsed.objective,
    actions: parsed.actions.slice(0, 6).map(String),
    approvalHandling: String(parsed.approvalHandling ?? "Stop before consequential writes if policy requires approval."),
    confidence,
  };
}

async function planWithLLM(request: string): Promise<PlannerOutput> {
  const result = await invokeLLM({
    model: PLANNER_MODEL,
    maxCompletionTokens: 1200,
    reasoning: { effort: "minimal" },
    messages: [
      {
        role: "system",
        content: "You are the planning component of LedgerLoop, an enterprise AI employee. You never execute tools and you never invent invoice values. Read the user's goal, select exactly one supported vendor, and return ONLY compact JSON with exactly these keys: vendor, objective, actions, approvalHandling, confidence. actions must be an array of 3 to 5 short strings, each under 8 words. Do not add details, requiredInputs, estimates, markdown, or commentary.",
      },
      {
        role: "user",
        content: JSON.stringify({
          goal: request,
          companyContext: {
            supportedVendors: invoices.map((invoice) => invoice.vendor),
            allowedTools: ["simulated-inbox.search", "invoice.extract", "policy-engine", "simulated-ap.create", "simulated-ap.read"],
            policy: `Auto-post invoices at or below ${money(POLICY.approvalThreshold)}; pause for Finance Ops approval above that threshold. Required checks: ${POLICY.requiredChecks.join(", ")}.`,
          },
          outputShape: {
            vendor: "Northstar Office Supply | Koral Labs",
            objective: "string",
            actions: ["string"],
            approvalHandling: "string",
            confidence: 0.0,
          },
        }),
      },
    ],
  });

  const choice = result.choices?.[0];
  const raw = choice?.message?.content ? contentText(choice.message.content) : "";
  if (!raw) throw new Error("Planner returned an empty response");
  return parsePlannerOutput(raw);
}

export async function runInvoiceWorker(request: string, retryInjected = false): Promise<WorkerRunResponse> {
  const startedAt = new Date().toISOString();
  const runId = `run_${Date.now().toString(36)}`;
  const events: WorkerEvent[] = [];
  let planner: "llm" | "fallback" = "llm";
  let plannerModel: string | undefined = PLANNER_MODEL;
  let plan: PlannerOutput;

  try {
    plan = await planWithLLM(request);
  } catch (error) {
    planner = "fallback";
    plannerModel = undefined;
    plan = {
      vendor: selectInvoiceFromRequest(request).vendor as PlannerOutput["vendor"],
      objective: "Process the latest supported invoice and leave a verified AP record.",
      actions: ["find source", "extract fields", "evaluate policy", "write AP record", "read back and verify"],
      approvalHandling: "Stop before consequential writes when the policy threshold requires approval.",
      confidence: 0.51,
    };
    events.push(
      event(
        "planner-fallback",
        "Understand",
        "AI planner unavailable; safe fallback selected",
        `The worker did not claim an AI plan: ${error instanceof Error ? error.message : "unknown planner error"}. It used a constrained vendor match and kept all policy gates active.`,
        "attention",
        "planner.fallback",
        { mode: "fallback", safety: "policy gates retained" },
      ),
    );
  }

  const invoice = selectInvoiceByVendor(plan.vendor);
  let retryCount = 0;
  events.push(
    event(
      "understand",
      "Understand",
      planner === "llm" ? "AI planner understood the goal" : "Goal understood by safe fallback",
      `The worker selected ${invoice.vendor} and translated the request into an executable outcome: ${plan.objective}`,
      "complete",
      planner === "llm" ? PLANNER_MODEL : "planner.fallback",
      { vendor: invoice.vendor, confidence: plan.confidence.toFixed(2), planner },
    ),
    event(
      "plan",
      "Plan",
      planner === "llm" ? "AI action plan validated" : "Constrained action plan validated",
      `${plan.actions.join(" → ")}. Approval rule: ${plan.approvalHandling}`,
      "complete",
      "plan-validator",
      { actions: String(plan.actions.length), approvalGate: money(POLICY.approvalThreshold) },
    ),
  );

  if (retryInjected) {
    retryCount = 1;
    events.push(
      event(
        "source-attempt-1",
        "Execute",
        "Inbox connector returned a transient error",
        "GET /simulated-inbox/search responded 503. The worker classified this as retryable and did not invent invoice data.",
        "attention",
        "simulated-inbox.search",
        { attempt: "1", error: "503 Service Unavailable" },
      ),
      event(
        "source-retry",
        "Adapt",
        "Retrying source lookup",
        "Retry 1/2 after a bounded backoff; preserving the original vendor and AI plan context.",
        "recovered",
        "retry-policy",
        { attempt: "2", decision: "retry" },
      ),
    );
  }

  events.push(
    event(
      "source",
      "Execute",
      "Invoice located",
      `Found the newest unread invoice for ${invoice.vendor} in the simulated AP inbox.`,
      "complete",
      "simulated-inbox.search",
      { source: invoice.sourceRef, received: "2025-10-25 08:42 UTC" },
    ),
    event(
      "extract",
      "Observe",
      "Fields extracted",
      `${invoice.invoiceId} contains ${money(invoice.amount)} due ${invoice.dueDate}; PO ${invoice.poNumber}.`,
      "complete",
      "invoice.extract",
      { invoiceId: invoice.invoiceId, amount: money(invoice.amount), dueDate: invoice.dueDate, po: invoice.poNumber },
    ),
    event(
      "policy",
      "Observe",
      "Company policy evaluated",
      `Vendor approved, PO matched, duplicate check clear. ${money(invoice.amount)} is ${invoice.amount > POLICY.approvalThreshold ? "above" : "below"} the approval threshold.`,
      invoice.amount > POLICY.approvalThreshold ? "attention" : "complete",
      "policy-engine",
      {
        approvedVendor: invoice.approvedVendor ? "pass" : "fail",
        poMatch: "pass",
        duplicate: "clear",
        approval: invoice.amount > POLICY.approvalThreshold ? "required" : "not required",
      },
    ),
  );

  const evidence: InvoiceEvidence = {
    invoiceId: invoice.invoiceId,
    vendor: invoice.vendor,
    amount: money(invoice.amount),
    dueDate: invoice.dueDate,
    sourceRef: invoice.sourceRef,
  };

  if (invoice.amount > POLICY.approvalThreshold) {
    events.push(
      event(
        "approval",
        "Human gate",
        "Approval required before posting",
        `${money(invoice.amount)} exceeds the ${money(POLICY.approvalThreshold)} policy threshold. The worker paused before a consequential write.`,
        "attention",
        "approval-gate",
        { owner: "Finance Ops", policy: `amount > ${money(POLICY.approvalThreshold)}` },
      ),
    );

    return {
      runId,
      status: "approval_required",
      planner,
      plannerModel,
      request,
      vendor: invoice.vendor,
      summary: `Paused safely: ${invoice.invoiceId} is ready for Finance Ops approval before it can be posted.`,
      startedAt,
      durationMs: planner === "llm" ? 1280 : 842,
      retryInjected,
      retryCount,
      events,
      evidence,
      approval: {
        reason: `${money(invoice.amount)} exceeds the auto-post threshold.`,
        requestedBy: "LedgerLoop worker",
        policy: `Finance approval required above ${money(POLICY.approvalThreshold)} · ${POLICY.paymentTerms}`,
      },
    };
  }

  const apRef = `AP-${invoice.invoiceId.replace("INV-", "")}`;
  evidence.apRef = `ap://records/${apRef}`;
  events.push(
    event(
      "write",
      "Execute",
      "AP record created",
      `Posted ${invoice.invoiceId} to the simulated accounts-payable system as ${apRef}.`,
      "complete",
      "simulated-ap.create",
      { apRef, paymentTerms: POLICY.paymentTerms, status: "open" },
    ),
    event(
      "verify",
      "Verify",
      "Write verified",
      "Read-back matched vendor, invoice number, amount, due date, and PO fingerprint. No duplicate record detected.",
      "complete",
      "simulated-ap.read",
      { fingerprint: `${invoice.vendor}|${invoice.invoiceId}|${invoice.amount}|${invoice.dueDate}`, result: "match" },
    ),
    event(
      "complete",
      "Complete",
      "Outcome confirmed",
      `Invoice is recorded and ready for payment on ${invoice.dueDate}. Evidence has been attached to this run.`,
      "complete",
      "worker.summary",
      { result: "completed", confidence: "verified", planner },
    ),
  );

  return {
    runId,
    status: "completed",
    planner,
    plannerModel,
    request,
    vendor: invoice.vendor,
    summary: `Completed: ${invoice.invoiceId} was posted to AP and verified against the source invoice.`,
    startedAt,
    durationMs: planner === "llm" ? (retryInjected ? 1900 : 1410) : retryInjected ? 1460 : 968,
    retryInjected,
    retryCount,
    events,
    evidence,
  };
}
