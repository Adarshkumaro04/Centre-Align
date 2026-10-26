# LedgerLoop architecture

## Why this shape

The hiring brief asks for an operator that can understand an outcome, choose actions, execute, observe, adapt, verify, and return evidence. LedgerLoop implements that loop with a live LLM planner plus a server-side state machine. The model handles the ambiguous request-to-plan step; code validates the plan and owns every consequential action. The scope is intentionally narrow: one invoice workflow, two simulated vendors, and a clear boundary between orchestration, tools, policy, and presentation.

## Runtime loop

1. **Understand.** The worker sends the natural-language task and company context to the managed `gpt-5-mini` model. The model must select exactly one supported vendor, state the objective, propose actions, and describe approval handling as JSON.
2. **Validate.** The server parses and validates the returned plan: supported vendor, non-empty objective, at least three actions, and confidence between 0 and 1. The accepted plan is recorded with the model name.
3. **Execute.** The worker calls the simulated inbox search tool. A retry-injection switch can make the first call return a transient 503.
4. **Observe.** It extracts the invoice fixture and records invoice ID, amount, due date, PO, source, and line items. It then evaluates approved-vendor, PO-match, duplicate, and approval-threshold policy.
5. **Adapt.** If the connector returns the injected 503, a bounded retry policy classifies the error as retryable and performs one retry while preserving the original task and model plan. Non-retryable errors would stop the run rather than fabricate a result.
6. **Human gate.** If the amount exceeds `$10,000`, the worker pauses before the AP write and returns `approval_required` with the policy and requested owner.
7. **Verify.** On the compliant Northstar path, the worker writes a simulated AP record and immediately reads it back. It compares a deterministic fingerprint for vendor, invoice number, amount, and due date.
8. **Complete.** Only after read-back succeeds does it return `completed`, a concise summary, and source/AP evidence references.

If the LLM call fails or returns invalid output, the worker records `AI planner unavailable; safe fallback selected`, applies a constrained vendor match, and keeps every policy gate active. The UI and response label this as `fallback`; it is never presented as a successful AI plan.

## Boundaries

```text
React operator console
        │ POST /api/worker/run
        ▼
Express execution boundary
        │
        ├── Managed LLM planner (gpt-5-mini)
        ├── Plan validator / safe fallback
        ├── Simulated inbox connector
        ├── Invoice extraction tool
        ├── Policy engine
        ├── Simulated AP create/read tools
        └── Structured trace + evidence response
```

The frontend never decides that work succeeded. It renders what the server returned. The server owns the model call, plan validation, simulated side effects, and verification result. `shared/worker.ts` contains the contract shared by the endpoint and UI, keeping the trace schema explicit. The response identifies whether the run used the live model or a safe fallback, making the AI boundary visible to a reviewer.

## Reliability choices

The prototype uses bounded retries, explicit statuses, a stop-before-write approval gate, and a separate read-back verification. Every event names the phase, human-readable result, tool, status, and small structured data payload. This makes a run inspectable and provides the minimum material for replay or evaluation.

The LLM is not allowed to invent invoice values or call arbitrary tools. It only proposes a plan against company context supplied by the server. The code validates the proposal before execution; deterministic adapters own all simulated side effects. This is the reliability seam a production connector runtime should preserve.

## What changes for production

The first production step would preserve the orchestration contract while replacing in-memory fixtures with versioned connectors. Each connector would advertise capabilities, required scopes, idempotency support, and evidence methods. A task table and append-only event table would make runs durable; a queue would own leases, retries, cancellation, and dead-letter states.

The current model planner should graduate to schema-capable output, capability discovery, plan evaluation, and replayable test cases. High-impact actions would require approval tokens bound to exact action arguments, tenant, policy version, and expiry. Browser or desktop sessions would run in isolated sandboxes with scoped credentials and captured screenshots or DOM evidence.

The evaluation layer would replay fixtures for duplicate invoices, missing fields, mismatched POs, vendor ambiguity, connector drift, partial writes, and approval timeouts. A production worker should be judged on verified outcomes, not on how plausible its text sounds.
