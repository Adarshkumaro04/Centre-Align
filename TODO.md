# LedgerLoop delivery checklist

## Live invoice worker workflow

- [x] A user can enter a natural-language invoice-processing request and run it from the live app.
- [x] The worker identifies the intended outcome instead of requiring every individual step.
- [x] The worker breaks the request into an explicit sequence of actions and exposes the plan.
- [x] The worker uses a simulated company inbox and accounts-payable system, with company context and permitted actions represented in code.
- [x] The worker observes the result of each action and chooses the next action from that result.
- [x] The worker remembers relevant invoice fields and policy facts during execution.
- [x] The worker detects a transient connector failure and performs a bounded retry with a recovery event.
- [x] The worker applies approval policy and asks for human approval when an invoice is over the configured threshold.
- [x] The worker verifies that the AP record exists and matches the extracted invoice fingerprint before declaring completion.
- [x] The worker returns a concise summary, trace, and useful evidence references.

## Submission quality

- [x] The app is responsive and communicates the simulation boundary clearly.
- [x] `README.md` includes setup/run instructions, architecture summary, design decisions, assumptions, limitations, next steps, and technology/API details.
- [x] `ARCHITECTURE.md` explains the runtime loop, tool boundary, recovery, verification, and production evolution path.
- [x] `DEMO.md` provides a short walkthrough script for the live demo.
- [x] `client/public/manus-routes.json` lists the current page routes.
- [x] TypeScript diagnostics and build complete successfully.
- [x] A checkpoint is saved and the live app is published.
