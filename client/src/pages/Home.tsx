import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  DatabaseZap,
  FileCheck2,
  FileText,
  GitBranch,
  History,
  Inbox,
  LockKeyhole,
  MailOpen,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  TriangleAlert,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkerEvent, WorkerRunResponse } from "@shared/worker";

const DEFAULT_REQUEST = "Find the latest invoice from Northstar Office Supply, extract the amount and due date, enter it into AP, and tell me once it is verified.";
const KORAL_REQUEST = "Find the latest invoice from Koral Labs, extract the amount and due date, enter it into AP, and stop if finance approval is required.";

type WorkspaceView = "console" | "inbox" | "ap" | "history";
type RunHistoryItem = Pick<WorkerRunResponse, "runId" | "status" | "planner" | "plannerModel" | "vendor" | "summary" | "durationMs" | "retryCount"> & {
  completedAt: string;
  invoiceId: string;
};

const phaseMeta: Record<string, { tone: string; icon: typeof Bot }> = {
  Understand: { tone: "blue", icon: Sparkles },
  Plan: { tone: "blue", icon: GitBranch },
  Execute: { tone: "cobalt", icon: Zap },
  Observe: { tone: "amber", icon: Search },
  Adapt: { tone: "coral", icon: RotateCcw },
  Verify: { tone: "mint", icon: ShieldCheck },
  Complete: { tone: "mint", icon: CheckCircle2 },
  "Human gate": { tone: "amber", icon: LockKeyhole },
};

function StatusPill({ status }: { status: WorkerRunResponse["status"] }) {
  if (status === "completed") {
    return <span className="status-pill status-pill-success"><CheckCircle2 size={13} /> Verified complete</span>;
  }
  if (status === "approval_required") {
    return <span className="status-pill status-pill-warning"><TriangleAlert size={13} /> Approval required</span>;
  }
  return <span className="status-pill status-pill-danger"><TriangleAlert size={13} /> Worker stopped</span>;
}

function EventRow({ item, index }: { item: WorkerEvent; index: number }) {
  const meta = phaseMeta[item.phase] ?? phaseMeta.Execute;
  const Icon = meta.icon;
  return (
    <div className={`trace-row trace-row-${item.status}`} style={{ animationDelay: `${index * 55}ms` }}>
      <div className={`trace-node trace-node-${meta.tone}`}><Icon size={15} /></div>
      <div className="trace-copy">
        <div className="trace-heading">
          <span className="trace-phase">{item.phase}</span>
          <span className="trace-label">{item.label}</span>
          {item.tool && <code>{item.tool}</code>}
        </div>
        <p>{item.detail}</p>
        {item.data && (
          <div className="trace-data">
            {Object.entries(item.data).map(([key, value]) => <span key={key}><b>{key}</b> {value}</span>)}
          </div>
        )}
      </div>
      <div className={`trace-state trace-state-${item.status}`}>
        {item.status === "recovered" ? "recovered" : item.status === "attention" ? "attention" : "done"}
      </div>
    </div>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <div className="metric-card">
      <div className={`metric-dot metric-dot-${tone}`} />
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-note">{note}</div>
      </div>
    </div>
  );
}

const inboxItems = [
  { vendor: "Northstar Office Supply", subject: "Invoice INV-2025-0142 · October supplies", received: "Today, 08:42 UTC", amount: "$4,820", status: "Unread", ref: "inbox/ap@northstar-office.com/INV-2025-0142.pdf" },
  { vendor: "Koral Labs", subject: "Invoice KOR-884 · Research environment", received: "Today, 07:18 UTC", amount: "$12,440", status: "Unread", ref: "inbox/ap@koral-labs.io/KOR-884.pdf" },
];

const apItems = [
  { invoice: "INV-2025-0142", vendor: "Northstar Office Supply", amount: "$4,820", due: "19 Nov 2025", status: "Open", ref: "AP-2025-0142" },
  { invoice: "KOR-884", vendor: "Koral Labs", amount: "$12,440", due: "21 Nov 2025", status: "Awaiting approval", ref: "Draft · not posted" },
];

function WorkspaceViewPage({ view, history, onBack }: { view: Exclude<WorkspaceView, "console">; history: RunHistoryItem[]; onBack: () => void }) {
  const config = {
    inbox: { eyebrow: "Simulated inbox", title: "Source documents", description: "The worker's read-only source system for incoming AP invoices.", icon: MailOpen },
    ap: { eyebrow: "Accounts payable", title: "AP records", description: "The simulated write target, with approval state kept visible.", icon: TableProperties },
    history: { eyebrow: "Run history", title: "Worker runs", description: "A local audit view of the work completed in this browser session.", icon: History },
  }[view];
  const Icon = config.icon;
  return (
    <section className="workspace-page">
      <div className="workspace-page-header">
        <div>
          <button className="back-link" onClick={onBack}>← Back to worker console</button>
          <div className="eyebrow"><span className="eyebrow-line" /> {config.eyebrow}</div>
          <h1>{config.title}</h1>
          <p className="header-copy">{config.description}</p>
        </div>
        <div className="workspace-page-icon"><Icon size={27} /></div>
      </div>
      {view === "inbox" && <div className="workspace-table panel-shadow">
        <div className="table-toolbar"><div><b>Inbox / Accounts Payable</b><span>2 documents available to the worker</span></div><span className="status-pill status-pill-success"><ShieldCheck size={13} /> Read-only connector</span></div>
        {inboxItems.map((item) => <div className="document-row" key={item.ref}><div className="document-icon"><FileText size={19} /></div><div className="document-main"><b>{item.subject}</b><span>{item.vendor} · {item.received}</span><code>{item.ref}</code></div><div className="document-amount"><b>{item.amount}</b><span>{item.status}</span></div><ArrowUpRight size={15} /></div>)}
        <div className="table-foot"><LockKeyhole size={13} /> Simulated source system · no external mailbox access</div>
      </div>}
      {view === "ap" && <div className="workspace-table panel-shadow">
        <div className="table-toolbar"><div><b>Accounts payable ledger</b><span>Records the worker can create and verify</span></div><span className="status-pill status-pill-success"><DatabaseZap size={13} /> Sandbox write target</span></div>
        <div className="ap-table-head"><span>Invoice</span><span>Vendor</span><span>Amount</span><span>Due</span><span>Status</span></div>
        {apItems.map((item) => <div className="ap-row" key={item.invoice}><b>{item.invoice}</b><span>{item.vendor}</span><b>{item.amount}</b><span>{item.due}</span><span className={item.status === "Open" ? "ap-status-open" : "ap-status-pending"}>{item.status}</span></div>)}
        <div className="table-foot"><ShieldCheck size={13} /> Every posted record requires a successful read-back verification</div>
      </div>}
      {view === "history" && <div className="workspace-table panel-shadow">
        <div className="table-toolbar"><div><b>Recent worker activity</b><span>{history.length ? `${history.length} run${history.length === 1 ? "" : "s"} in this session` : "No runs in this browser session yet"}</span></div><span className="status-pill status-pill-success"><History size={13} /> Auditable trace</span></div>
        {history.length === 0 ? <div className="history-empty"><div className="empty-icon"><History size={23} /></div><h3>Run the worker to create history.</h3><p>Completed and approval-gated runs will appear here with their planner, vendor, outcome, and timing.</p></div> : history.map((item) => <div className="history-row" key={item.runId}><div className={`history-status history-status-${item.status}`}><CheckCircle2 size={17} /></div><div className="history-main"><b>{item.vendor} · {item.invoiceId}</b><span>{item.runId} · {item.completedAt}</span><p>{item.summary}</p></div><div className="history-meta"><b>{item.planner === "llm" ? `AI · ${item.plannerModel}` : "Fallback"}</b><span>{item.durationMs}ms · {item.retryCount} retry</span></div></div>)}
      </div>}
    </section>
  );
}

export default function Home() {
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [retryInjected, setRetryInjected] = useState(true);
  const [run, setRun] = useState<WorkerRunResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState("northstar");
  const [activeView, setActiveView] = useState<WorkspaceView>("console");
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [error, setError] = useState("");

  const visibleEvents = useMemo(() => run?.events.slice(0, visibleCount) ?? [], [run, visibleCount]);
  const traceIsPlaying = isRunning || (Boolean(run) && visibleCount < (run?.events.length ?? 0));

  useEffect(() => {
    if (!run || visibleCount >= run.events.length) {
      if (run && visibleCount >= run.events.length) setIsRunning(false);
      return;
    }
    const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), 250);
    return () => window.clearTimeout(timer);
  }, [run, visibleCount]);

  async function runWorker() {
    if (!request.trim() || isRunning) return;
    setError("");
    setIsRunning(true);
    setRun(null);
    setVisibleCount(0);
    try {
      const response = await fetch("/api/worker/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, retryInjected }),
      });
      if (!response.ok) throw new Error("The worker endpoint did not accept this request.");
      const payload = (await response.json()) as WorkerRunResponse;
      setRun(payload);
      setHistory((items) => [{ runId: payload.runId, status: payload.status, planner: payload.planner, plannerModel: payload.plannerModel, vendor: payload.vendor, summary: payload.summary, durationMs: payload.durationMs, retryCount: payload.retryCount, completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), invoiceId: payload.evidence.invoiceId }, ...items].slice(0, 20));
      setVisibleCount(1);
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : "The worker could not start.");
    }
  }

  function chooseScenario(scenario: "northstar" | "koral") {
    setActiveScenario(scenario);
    setRequest(scenario === "northstar" ? DEFAULT_REQUEST : KORAL_REQUEST);
    setRun(null);
    setVisibleCount(0);
    setError("");
  }

  return (
    <div className="ledger-app">
      <aside className="shell-rail">
        <div className="brand-lockup">
          <div className="brand-mark"><span>LL</span><div className="brand-mark-signal" /></div>
          <div><div className="brand-name">LedgerLoop</div><div className="brand-subtitle">company operator</div></div>
        </div>

        <div className="rail-section-label">Workspace</div>
        <nav className="rail-nav">
          <button className={`rail-item ${activeView === "console" ? "rail-item-active" : ""}`} onClick={() => setActiveView("console")}><Activity size={16} /><span>Worker console</span><span className="rail-count">01</span></button>
          <button className={`rail-item ${activeView === "inbox" ? "rail-item-active" : ""}`} onClick={() => setActiveView("inbox")}><Inbox size={16} /><span>Simulated inbox</span></button>
          <button className={`rail-item ${activeView === "ap" ? "rail-item-active" : ""}`} onClick={() => setActiveView("ap")}><DatabaseZap size={16} /><span>Accounts payable</span></button>
          <button className={`rail-item ${activeView === "history" ? "rail-item-active" : ""}`} onClick={() => setActiveView("history")}><ClipboardCheck size={16} /><span>Run history</span><span className="rail-count">{history.length || 0}</span></button>
        </nav>

        <div className="rail-section-label rail-section-context">Company context</div>
        <div className="context-card">
          <div className="context-card-title"><ShieldCheck size={15} /> AP policy v3.2</div>
          <div className="context-rule"><span>Auto-post threshold</span><b>$10,000</b></div>
          <div className="context-rule"><span>Payment terms</span><b>Net 30</b></div>
          <div className="context-rule"><span>Required checks</span><b>3 controls</b></div>
        </div>

        <div className="rail-footer">
          <div className="online-dot" />
          <div><b>Simulation mode</b><span>No external credentials</span></div>
        </div>
      </aside>

      <main className="workspace">
        {activeView !== "console" && <WorkspaceViewPage view={activeView} history={history} onBack={() => setActiveView("console")} />}
        {activeView === "console" && <>
        <header className="workspace-header">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> Autonomous workbench <span className="eyebrow-muted">/ AP operations</span></div>
            <h1>Good morning, operator.</h1>
            <p className="header-copy">Give the worker an outcome. It will work the path, not just describe it.</p>
          </div>
          <div className="header-status"><span className="online-dot" /> <span>All systems operational</span><span className="header-divider" /><span>25 Oct 2025</span></div>
        </header>

        <section className="metric-strip" aria-label="Worker metrics">
          <Metric label="Runs completed" value="04" note="This workspace" tone="blue" />
          <Metric label="Verification rate" value="100%" note="Last 4 runs" tone="mint" />
          <Metric label="Human handoffs" value="01" note="Approval threshold" tone="amber" />
          <Metric label="Avg. completion" value="1.2s" note="Simulated runtime" tone="coral" />
        </section>

        <section className="request-panel panel-shadow">
          <div className="section-kicker"><span>01</span> New work request</div>
          <div className="request-layout">
            <div className="request-input-wrap">
              <div className="request-input-top"><span className="request-field-label">Natural-language goal</span><span className="simulation-badge"><CircleDot size={11} /> Simulated company</span></div>
              <textarea value={request} onChange={(event) => setRequest(event.target.value)} aria-label="Natural language work request" />
              <div className="request-input-bottom"><span><WandSparkles size={14} /> The worker will infer the steps</span><span className="char-count">{request.length} / 500</span></div>
            </div>
            <div className="run-controls">
              <button className="run-button" onClick={runWorker} disabled={isRunning || !request.trim()}><Play size={16} fill="currentColor" /> {isRunning ? "Worker running…" : "Run worker"}<ArrowUpRight size={15} /></button>
              <label className="retry-toggle"><input type="checkbox" checked={retryInjected} onChange={(event) => setRetryInjected(event.target.checked)} /><span className="fake-checkbox"><Check size={12} /></span><span>Inject transient connector retry</span></label>
              <p>Safe demo mode: no external writes.</p>
            </div>
          </div>
          <div className="scenario-row">
            <span className="scenario-label">Try a scenario</span>
            <button className={`scenario-chip ${activeScenario === "northstar" ? "scenario-chip-active" : ""}`} onClick={() => chooseScenario("northstar")}><span className="scenario-icon scenario-icon-blue">N</span> Northstar · auto-post</button>
            <button className={`scenario-chip ${activeScenario === "koral" ? "scenario-chip-active" : ""}`} onClick={() => chooseScenario("koral")}><span className="scenario-icon scenario-icon-amber">K</span> Koral · approval gate</button>
          </div>
        </section>

        {error && <div className="error-banner"><TriangleAlert size={17} /><span>{error}</span></div>}

        <div className="content-grid">
          <section className="trace-panel panel-shadow">
            <div className="panel-header">
              <div><div className="section-kicker"><span>02</span> Live execution trace</div><h2>{run ? `Run ${run.runId}` : "Ready for a request"}</h2></div>
              <div className="trace-live-status">{traceIsPlaying ? <><span className="pulse-dot" /> Worker active</> : run ? <StatusPill status={run.status} /> : <><span className="idle-dot" /> Standing by</>}</div>
            </div>
            {!run && !isRunning ? (
              <div className="empty-trace"><div className="empty-icon"><Bot size={23} /></div><h3>The worker's next move will appear here.</h3><p>Run the Northstar scenario to see source lookup, extraction, policy checks, AP write, and read-back verification.</p></div>
            ) : (
              <div className="trace-list">
                {visibleEvents.map((item, index) => <EventRow key={`${item.id}-${index}`} item={item} index={index} />)}
                {traceIsPlaying && <div className="trace-loading"><span className="loading-bars"><i /><i /><i /></span> Observing the latest result…</div>}
              </div>
            )}
            {run && !traceIsPlaying && <div className="trace-footer"><span><Clock3 size={14} /> {run.durationMs}ms simulated runtime</span><span><FileCheck2 size={14} /> {run.events.length} auditable events</span><span><ShieldCheck size={14} /> Read-back verification {run.status === "completed" ? "passed" : "paused"}</span></div>}
          </section>

          <aside className="evidence-column">
            <section className="evidence-panel panel-shadow">
              <div className="section-kicker"><span>03</span> Outcome evidence</div>
              {run && !traceIsPlaying ? (
                <>
                  <div className={`outcome-banner outcome-${run.status}`}><div className="outcome-icon">{run.status === "completed" ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}</div><div><b>{run.status === "completed" ? "Outcome verified" : "Safe pause"}</b><span>{run.status === "completed" ? "The requested work is complete." : "A human decision is needed."}</span></div></div>
                  <p className="evidence-summary">{run.summary}</p>
                  <div className="evidence-list">
                    <div className="evidence-item"><span>Planner</span><b>{run.planner === "llm" ? `AI · ${run.plannerModel ?? "managed model"}` : "Safe fallback"}</b></div>
                    <div className="evidence-item"><span>Vendor</span><b>{run.evidence.vendor}</b></div>
                    <div className="evidence-item"><span>Invoice</span><b>{run.evidence.invoiceId}</b></div>
                    <div className="evidence-item"><span>Amount</span><b>{run.evidence.amount}</b></div>
                    <div className="evidence-item"><span>Due date</span><b>{run.evidence.dueDate}</b></div>
                    <div className="evidence-item"><span>Source</span><code>{run.evidence.sourceRef.split("/").slice(-1)[0]}</code></div>
                    <div className="evidence-item"><span>AP record</span><code>{run.evidence.apRef ? run.evidence.apRef.split("/").pop() : "Not posted"}</code></div>
                  </div>
                  {run.approval && <div className="approval-card"><div className="approval-card-head"><LockKeyhole size={15} /> Finance Ops handoff</div><p>{run.approval.reason}</p><span>{run.approval.policy}</span></div>}
                  <div className="evidence-ref"><FileText size={14} /><span>Evidence bundle attached to {run.runId}</span><ArrowUpRight size={13} /></div>
                </>
              ) : <div className="evidence-empty"><div className="evidence-empty-icon"><FileText size={20} /></div><p>When the worker completes or pauses, the extracted fields and source references will be pinned here.</p><span>Evidence beats explanation.</span></div>}
            </section>

            <section className="inbox-panel panel-shadow">
              <div className="inbox-head"><div className="section-kicker"><span>04</span> Source systems</div><span className="system-status"><span className="online-dot" /> Connected</span></div>
              <div className="source-card"><div className="source-icon source-icon-inbox"><Inbox size={16} /></div><div><b>AP inbox</b><span>2 unread invoices</span></div><ChevronRight size={15} /></div>
              <div className="source-card"><div className="source-icon source-icon-database"><DatabaseZap size={16} /></div><div><b>AP records</b><span>Read/write sandbox</span></div><ChevronRight size={15} /></div>
              <div className="source-card"><div className="source-icon source-icon-policy"><ShieldCheck size={16} /></div><div><b>Company policy</b><span>v3.2 · 3 controls</span></div><ChevronRight size={15} /></div>
              <div className="source-foot"><LockKeyhole size={12} /> All connectors are simulated for this demo</div>
            </section>
          </aside>
        </div>

        <footer className="workspace-footer"><span><Bot size={14} /> LedgerLoop worker runtime</span><span>Built for CentrAlign AI · Founding Engineer submission</span><span>v0.2.0 <span className="footer-dot">·</span> AI-planned demo</span></footer>
        </>}
      </main>
    </div>
  );
}
