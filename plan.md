# LedgerLoop implementation plan

## Product scope

LedgerLoop is a live simulated company portal for the CentrAlign AI Founding Engineer submission. It demonstrates one narrow but complete AI-employee workflow: accept a natural-language invoice request, identify the relevant vendor and source, plan the work, execute against a simulated inbox and accounts-payable system, recover from a transient connector failure, apply company policy, verify the written record, and return evidence.

The prototype uses a live managed LLM for request understanding and action planning, but keeps the tool boundary deterministic and inspectable. The server endpoint is the execution boundary; the UI is an operator console that reveals the worker trace as it runs. The simulated company context includes approved vendors, approval thresholds, duplicate detection, and PO matching rules. The core success path auto-posts a compliant invoice. A second sample scenario stops at an approval gate when the amount exceeds policy. If the model is unavailable, the worker records an explicit safe fallback rather than hiding the degraded mode.

## Implementation approach

- **Frontend:** React + TypeScript + Vite, using the initialized web-db-user starter. A single route (`/`) renders the LedgerLoop control room.
- **Worker API:** Express endpoint `POST /api/worker/run` executes the invoice worker in the server process. It accepts a natural-language request and a retry-injection flag, then returns a structured run trace.
- **Execution model:** `server/worker.ts` calls the managed `gpt-5-mini` model for a constrained JSON plan, validates it, then runs a small state machine with explicit stages: understand, plan, source, extract, policy-check, execute, observe, adapt/retry, verify, complete.
- **Company context:** In-memory simulated data keeps the demo reproducible and safe. Vendor inbox fixtures, policy rules, and AP records are separated from the worker logic so the runtime can later swap in real connectors.
- **Verification:** The worker re-reads the AP record after posting and compares a deterministic invoice fingerprint. The response contains evidence references and an auditable event trace.
- **Persistence:** The prototype does not require application tables; the managed database is provisioned for future task history, but this demo keeps each run self-contained and avoids coupling the walkthrough to seeded data.
- **Documentation:** `README.md`, `ARCHITECTURE.md`, and `DEMO.md` explain setup, architecture, decisions, assumptions, limitations, and a short walkthrough script.

## Project structure

- `client/src/pages/Home.tsx` — operator console and progressive trace presentation.
- `client/src/index.css` — LedgerLoop visual system and responsive layout.
- `server/worker.ts` — deterministic invoice-worker state machine and simulated company tools.
- `server/_core/index.ts` — Express health route plus worker API registration.
- `client/public/manus-routes.json` — page route manifest for the live app.
- `README.md`, `ARCHITECTURE.md`, `DEMO.md` — submission documentation.

## Design direction

Three possible styles were considered:

1. **Control-room editorial** (0.07): warm paper canvas, ink-black type, cobalt signal color, and a calm operator-console rhythm.
2. **Enterprise glass** (0.06): cool slate surfaces, translucent cards, and neon status accents.
3. **Terminal monochrome** (0.04): dark background, phosphor green, and a dense developer-tool aesthetic.

### Chosen: control-room editorial

- **Design movement:** Swiss editorial systems meets modern operations software: clear hierarchy, deliberate whitespace, and data treated as evidence.
- **Core principles:** every status is explainable; the worker is the hero; calm surfaces reduce cognitive load; exception states are prominent rather than hidden.
- **Color philosophy:** warm ivory and graphite make the product feel like a trusted operations desk; cobalt marks action and active state; mint signals verified success; amber marks a human gate; coral is reserved for exceptions.
- **Layout paradigm:** an asymmetric command desk: a narrow context rail anchors the page while the main canvas layers request input, trace, and evidence instead of using a generic centered dashboard grid.
- **Signature elements:** numbered step markers, a cobalt “signal line” through the trace, and small evidence chips that make provenance tangible.
- **Interaction philosophy:** actions should feel consequential but reversible; the run button is explicit, the trace appears progressively, and approvals are framed as deliberate handoffs.
- **Animation:** short ease-out reveals for trace events, a quiet pulse on the active step, and no decorative motion once the run is complete.

- **Typography system:** editorial Georgia-style display headings paired with compact sans-serif operational labels; mono is reserved for tool names, IDs, and evidence references.
- **Brand essence:** the calm, auditable operator for repetitive company work — explainable, careful, decisive.
- **Brand voice:** headlines are direct and human (“Good morning, operator.”); actions are outcome-oriented (“Run worker”); safety copy is explicit (“Evidence beats explanation.”).
- **Wordmark & logo:** the LL mark is a small control-room tile with a signal dot, suggesting a loop that is active and observable.
- **Signature brand color:** Cobalt `#2A75A5`, used for live state, links, and the execution signal line.
