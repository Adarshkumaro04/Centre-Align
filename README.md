# LedgerLoop — Autonomous Invoice Worker

LedgerLoop is a live simulated company portal that demonstrates a working AI-employee workflow for the CentrAlign AI Founding Engineer application. Give it a natural-language invoice request and the server calls a managed LLM to understand the request, select a supported vendor, and propose an action plan. The server validates that plan, then executes simulated inbox, policy, and accounts-payable tools, verifies the write, and returns evidence.

The important boundary is **model for understanding, code for control**. The LLM cannot write records directly. Policy checks, approval gates, retries, tool permissions, and read-back verification stay deterministic and visible in the trace. If the model is unavailable or returns invalid output, the worker explicitly reports a constrained safe fallback instead of claiming that the result came from AI.

## Live demo

Open the published app from the delivery link. The default scenario is the Northstar Office Supply invoice. Keep **Inject transient connector retry** enabled to see the worker classify a simulated 503 as retryable, recover, and continue. The Koral Labs scenario demonstrates a human-in-the-loop approval gate because its invoice exceeds the `$10,000` auto-post threshold. The evidence card now identifies the planner as `AI · gpt-5-mini` when the live model succeeds.

## Run locally

The project uses the initialized React + Express + TypeScript starter and pnpm 10.18.0.

```bash
pnpm install
pnpm dev
```

The server listens on `http://localhost:3000` by default. The health endpoint is `GET /api/health`, and the worker endpoint is `POST /api/worker/run`.

```bash
curl -X POST http://localhost:3000/api/worker/run \\
  -H 'content-type: application/json' \\
  -d '{"request":"Process the latest Northstar Office Supply invoice and verify it in AP","retryInjected":true}'
```

Useful checks:

```bash
pnpm check
pnpm build
```

## Architecture at a glance

The React operator console accepts the goal, progressively renders the structured trace, and pins evidence. The Express worker endpoint is the execution boundary. `server/worker.ts` calls the managed `gpt-5-mini` model, validates a JSON-shaped plan, and then runs a state machine with explicit tools and policy decisions. The simulated company context contains two invoices, three policy checks, and an approval threshold. The worker re-reads the AP record and compares an invoice fingerprint before returning `completed`.

```text
Goal → Understand (LLM) → Validate plan → Execute tools → Observe → Adapt → Verify → Complete
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the detailed runtime and production evolution path, and [`DEMO.md`](./DEMO.md) for a two-minute walkthrough script.

## Technical decisions

**Live model, typed boundary.** The managed LLM is used for the ambiguous request-to-plan step. The server constrains the model to the supported vendors and available tools, validates the returned object, and records the model identity in the run response.

**Tool execution stays deterministic.** The simulated inbox, extractor, policy engine, AP writer, and AP reader are represented as tools. This keeps the proof of concept reproducible and gives a future browser/API connector a clean interface.

**Verification is a separate action.** The worker does not infer that a successful write means success. It reads the AP record back and compares vendor, invoice number, amount, due date, and PO-related state.

**Approval is a first-class state.** Koral Labs pauses before a consequential write because the amount is above policy. This is safer than silently posting or burying the request in a text response.

## Assumptions and limitations

This is a proof of concept, not a production AP system. The inbox and AP data are in-memory fixtures, so runs are not durable across server restarts. Authentication, per-company tenancy, durable task history, queue workers, browser automation, real PDF/OCR parsing, and connector credentials are intentionally out of scope. The extraction step operates on structured fixtures rather than arbitrary uploaded documents. The retry injection is a deterministic demonstration of recovery rather than a real network outage.

The UI progressively reveals the server-returned trace to make execution legible during a demo. The server performs the complete workflow before responding; a production runtime would stream signed events over a task channel and persist them.

## What I would build next

The next increment would introduce a connector contract with capability discovery, durable task/event tables, idempotency keys, policy versioning, and a queue with bounded retries. I would tighten the current model planner with schema-capable output and plan evaluation, and build replayable cases for duplicate invoices, mismatched POs, malformed documents, missing vendors, connector drift, partial writes, and approval timeouts. Browser and file connectors would run in isolated sessions with scoped credentials and evidence capture.

## Stack and services

The prototype uses React 19, TypeScript, Vite, Express, Tailwind CSS, Lucide icons, and the initialized Manus Webdev managed runtime. It calls the managed project LLM service server-side using `gpt-5-mini`; no separate model-provider key is required. No real company credentials or third-party systems are used. The managed database is provisioned by the template for future durable task history, but the current vertical slice keeps simulated company fixtures in memory.

## Submission files

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — runtime loop, model boundary, reliability, and production evolution.
- [`DEMO.md`](./DEMO.md) — short walkthrough script and what each interaction proves.
- [`plan.md`](./plan.md) — implementation plan and visual system.
- [`TODO.md`](./TODO.md) — acceptance criteria and delivery checklist.

## Workspace areas

The live console now includes three functional supporting views. **Simulated inbox** exposes the two source invoice documents and their connector references. **Accounts payable** shows the sandbox ledger with posted and approval-pending states. **Run history** records each completed or approval-gated worker run in the current browser session, including vendor, invoice, planner, outcome, timing, and retry count.
