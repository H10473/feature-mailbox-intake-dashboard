import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeMessage,
  completeMessage,
  createMessage,
  deleteMessage,
  fetchAging,
  fetchConfig,
  fetchHeatmap,
  fetchKpis,
  fetchMessages,
  fetchTrends,
} from "./api";
import {
  CHANNELS,
  PRIORITIES,
  STATUSES,
  type AgingBucket,
  type AppConfig,
  type Heatmap as HeatmapData,
  type IntakeMessage,
  type Kpis,
  type SlaState,
  type Status,
  type TrendPoint,
} from "./types";
import { formatDateTime, formatMinutes } from "./format";
import { KpiCards } from "./components/KpiCards";
import { AgingChart } from "./components/AgingChart";
import { TrendsChart } from "./components/TrendsChart";
import { Heatmap } from "./components/Heatmap";

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const SLA_LABELS: Record<SlaState, string> = {
  met: "met",
  breached: "breached",
  pending: "pending",
};

const emptyForm = {
  sender: "",
  subject: "",
  body: "",
  channel: "email",
  priority: "normal",
};

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [msgs, k, a, t, h] = await Promise.all([
        fetchMessages(filter),
        fetchKpis(),
        fetchAging(),
        fetchTrends(14),
        fetchHeatmap(),
      ]);
      setMessages(msgs);
      setKpis(k);
      setAging(a);
      setTrends(t);
      setHeatmap(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [filter]);

  useEffect(() => {
    fetchConfig().then(setConfig).catch(() => undefined);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createMessage(form);
      setForm({ ...emptyForm });
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log email");
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Mailbox Intake Dashboard</h1>
          <p className="subtitle">
            <span className="mono">{config?.mailbox ?? "…"}</span>
          </p>
        </div>
        <div className="sla-policy">
          <span className="pill">Acknowledge ≤ {config?.ackSlaMinutes ?? 15}m</span>
          <span className="pill">
            Complete ≤ {formatMinutes(config?.completionSlaMinutes ?? 240)}
          </span>
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <KpiCards kpis={kpis} />

      <div className="grid-2">
        <section className="panel">
          <h2>Aging of open emails</h2>
          <AgingChart buckets={aging} />
        </section>
        <section className="panel">
          <h2>Volume &amp; trends (14 days)</h2>
          <TrendsChart points={trends} />
        </section>
      </div>

      <section className="panel">
        <h2>Volume heatmap (day × hour)</h2>
        <Heatmap data={heatmap} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Inbox</h2>
          <div className="controls">
            <div className="filters">
              <button
                className={`chip ${filter === "all" ? "chip--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={`chip ${filter === s ? "chip--active" : ""}`}
                  onClick={() => setFilter(s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              className="btn btn--primary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Close" : "Log email"}
            </button>
          </div>
        </div>

        {showForm && (
          <form className="form form--inline" onSubmit={onSubmit}>
            <input
              type="text"
              required
              placeholder="Sender (name@example.com)"
              value={form.sender}
              onChange={(e) => setForm({ ...form, sender: e.target.value })}
            />
            <input
              type="text"
              required
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Adding…" : "Add"}
            </button>
          </form>
        )}

        {messages.length === 0 ? (
          <p className="empty">No messages in this view.</p>
        ) : (
          <table className="msg-table">
            <thead>
              <tr>
                <th>Subject / Sender</th>
                <th>Folder</th>
                <th>Received</th>
                <th>Age</th>
                <th>First response</th>
                <th>SLA</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-subject">
                      <span className={`badge badge--${m.priority}`}>{m.priority}</span>
                      <span className="subject">{m.subject}</span>
                    </div>
                    <div className="cell-sub">
                      {m.sender}
                      {m.assignee ? ` · ${m.assignee}` : ""}
                    </div>
                  </td>
                  <td className="nowrap">
                    <span className="folder">
                      <span className="folder-icon" aria-hidden="true">📁</span>
                      {m.folder}
                    </span>
                  </td>
                  <td className="nowrap">{formatDateTime(m.receivedAt)}</td>
                  <td className="nowrap">{formatMinutes(m.ageMinutes)}</td>
                  <td className="nowrap">{formatMinutes(m.firstResponseMinutes)}</td>
                  <td>
                    <div className="sla-badges">
                      <span className={`sla sla--${m.ackSla}`}>
                        Ack {SLA_LABELS[m.ackSla]}
                      </span>
                      <span className={`sla sla--${m.completionSla}`}>
                        Done {SLA_LABELS[m.completionSla]}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status status--${m.status}`}>
                      {STATUS_LABELS[m.status]}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {m.webLink ? (
                        <a
                          className="btn btn--sm"
                          href={m.webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open email in Outlook"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="btn btn--sm btn--disabled" title="No mailbox link">
                          Open
                        </span>
                      )}
                      {m.status === "new" && (
                        <button
                          className="btn btn--sm"
                          onClick={() => runAction(() => acknowledgeMessage(m.id))}
                        >
                          Acknowledge
                        </button>
                      )}
                      {m.status !== "resolved" && (
                        <button
                          className="btn btn--sm btn--primary"
                          onClick={() => runAction(() => completeMessage(m.id))}
                        >
                          Complete
                        </button>
                      )}
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() => runAction(() => deleteMessage(m.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
