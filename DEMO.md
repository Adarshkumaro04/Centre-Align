# LedgerLoop demo script

## 1. Establish the product in 15 seconds

Open the live app and say: “LedgerLoop is a simulated company portal for an autonomous invoice worker. I give it an outcome, the server calls a live LLM to make the plan, and the console shows the worker choosing tools, handling a failure, applying policy, and verifying the final record.” Point out the left rail: worker console, simulated inbox, AP records, and the company policy card.

## 2. Run the reliable success path in 60 seconds

Leave **Northstar · auto-post** selected and keep **Inject transient connector retry** enabled. Click **Run worker**. As the trace reveals, call out:

- The worker understood the desired outcome rather than requiring a checklist.
- The evidence card identifies the planner as `AI · gpt-5-mini`, proving this run used the live managed model for request understanding and planning.
- It assembled a plan before acting.
- The first inbox lookup returned a simulated 503, so it classified the error as retryable and recovered with a bounded retry.
- It extracted invoice ID, amount, due date, and PO, then evaluated vendor, duplicate, PO, and threshold checks.
- It created a simulated AP record and performed a separate read-back verification.

When the outcome card says **Outcome verified**, point to the source file and AP record evidence. The key proof is that completion appears only after the verification event.

## 3. Show the human gate in 30 seconds

Click **Koral · approval gate** and run again. Koral Labs is over the `$10,000` threshold. The worker extracts the invoice and passes the safe checks, then pauses before the AP write. Point to the amber **Finance Ops handoff** card. This demonstrates that the worker can ask for help when it cannot safely proceed rather than silently taking a consequential action.

## 4. Close with architecture in 15 seconds

Say: “The model handles the ambiguous request-to-plan step, but the tool boundary is deliberately deterministic. Real inbox, browser, OCR, and AP connectors can replace the fixtures while the orchestration, approval, verification, evidence, and evaluation contracts stay in place.”

## What the demo proves

The walkthrough covers understanding, planning, tool selection, execution, observation, recovery, state/context, human-in-the-loop control, verification, and evidence without claiming access to a real company system.
