import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMessage,
  deleteMessage,
  fetchMessages,
  fetchStats,
  updateMessage,
} from "./api";
import {
  CHANNELS,
  PRIORITIES,
  STATUSES,
  type IntakeMessage,
  type Stats,
  type Status,
} from "./types";

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const emptyForm = {
  sender: "",
  subject: "",
  body: "",
  channel: "email",
  priority: "normal",
};

export default function App() {
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [msgs, s] = await Promise.all([fetchMessages(filter), fetchStats()]);
      setMessages(msgs);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createMessage(form);
      setForm({ ...emptyForm });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intake");
    } finally {
      setLoading(false);
    }
  };

  const onStatusChange = async (id: number, status: Status) => {
    try {
      await updateMessage(id, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteMessage(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const statCards = useMemo(() => {
    return [
      { key: "total", label: "Total", value: stats?.total ?? 0 },
      { key: "new", label: "New", value: stats?.byStatus.new ?? 0 },
      {
        key: "in_progress",
        label: "In Progress",
        value: stats?.byStatus.in_progress ?? 0,
      },
      { key: "resolved", label: "Resolved", value: stats?.byStatus.resolved ?? 0 },
    ];
  }, [stats]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Mailbox Intake Dashboard</h1>
          <p className="subtitle">Triage and manage incoming messages</p>
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <section className="stats">
        {statCards.map((card) => (
          <div key={card.key} className={`stat-card stat-card--${card.key}`}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
          </div>
        ))}
      </section>

      <div className="layout">
        <section className="panel">
          <h2>New Intake</h2>
          <form className="form" onSubmit={onSubmit}>
            <label>
              Sender
              <input
                type="text"
                required
                placeholder="name@example.com"
                value={form.sender}
                onChange={(e) => setForm({ ...form, sender: e.target.value })}
              />
            </label>
            <label>
              Subject
              <input
                type="text"
                required
                placeholder="Short summary"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label>
              Message
              <textarea
                rows={3}
                placeholder="Details..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Channel
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
              </label>
              <label>
                Priority
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
              </label>
            </div>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Adding..." : "Add to inbox"}
            </button>
          </form>
        </section>

        <section className="panel panel--wide">
          <div className="panel-header">
            <h2>Inbox</h2>
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
          </div>

          {messages.length === 0 ? (
            <p className="empty">No messages in this view.</p>
          ) : (
            <ul className="message-list">
              {messages.map((m) => (
                <li key={m.id} className="message">
                  <div className="message-main">
                    <div className="message-top">
                      <span className={`badge badge--${m.priority}`}>
                        {m.priority}
                      </span>
                      <span className="message-subject">{m.subject}</span>
                      <span className={`status status--${m.status}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    </div>
                    <div className="message-meta">
                      <span>{m.sender}</span>
                      <span className="dot">·</span>
                      <span>{m.channel}</span>
                      {m.assignee && (
                        <>
                          <span className="dot">·</span>
                          <span>assigned to {m.assignee}</span>
                        </>
                      )}
                    </div>
                    {m.body && <p className="message-body">{m.body}</p>}
                  </div>
                  <div className="message-actions">
                    <select
                      value={m.status}
                      onChange={(e) =>
                        onStatusChange(m.id, e.target.value as Status)
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn--ghost"
                      onClick={() => onDelete(m.id)}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
