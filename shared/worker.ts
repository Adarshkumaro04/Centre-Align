export type WorkerRunStatus = "completed" | "approval_required" | "failed";
export type WorkerEventStatus = "complete" | "recovered" | "attention" | "failed";

export interface WorkerEvent {
  id: string;
  phase: string;
  label: string;
  tool?: string;
  status: WorkerEventStatus;
  detail: string;
  data?: Record<string, string>;
}

export interface InvoiceEvidence {
  invoiceId: string;
  vendor: string;
  amount: string;
  dueDate: string;
  sourceRef: string;
  apRef?: string;
}

export interface WorkerRunResponse {
  runId: string;
  status: WorkerRunStatus;
  planner: "llm" | "fallback";
  plannerModel?: string;
  request: string;
  vendor: string;
  summary: string;
  startedAt: string;
  durationMs: number;
  retryInjected: boolean;
  retryCount: number;
  events: WorkerEvent[];
  evidence: InvoiceEvidence;
  approval?: {
    reason: string;
    requestedBy: string;
    policy: string;
  };
}
