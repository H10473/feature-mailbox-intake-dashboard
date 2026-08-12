import { useEffect, useState } from "react";
import { REWARDS, type RewardEntry } from "../data/rewards";

const ROTATE_MS = 8000;

function RewardSlide({ entry }: { entry: RewardEntry }) {
  return (
    <article className="rewards-slide" aria-label={`${entry.title} — ${entry.recipients.join(" & ")}`}>
      <div className="rewards-slide__badge">
        <span className="rewards-slide__quarter">{entry.quarter}</span>
        <span className="rewards-slide__award">{entry.title}</span>
      </div>
      <div className="rewards-slide__body">
        <p className="rewards-slide__presented">Proudly presented to</p>
        <h3 className="rewards-slide__names">{entry.recipients.join(" & ")}</h3>
        <p className="rewards-slide__highlight">{entry.highlight}</p>
        <p className="rewards-slide__message">{entry.message}</p>
        <p className="rewards-slide__tagline">{entry.tagline}</p>
      </div>
      <div className="rewards-slide__icons" aria-hidden="true">
        <span title="Automation is my superpower">🤖</span>
        <span title="Innovation in progress">⭐</span>
        <span title="Work smarter, automate better">🦸</span>
      </div>
    </article>
  );
}

export function RewardsTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (REWARDS.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % REWARDS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const entry = REWARDS[index];

  return (
    <section className="rewards-panel" aria-live="polite">
      <div className="rewards-panel__header">
        <h2>Rewards</h2>
        <span className="rewards-panel__label">Rolling recognition</span>
      </div>
      <div className="rewards-ticker">
        <RewardSlide key={entry.id} entry={entry} />
      </div>
      {REWARDS.length > 1 && (
        <div className="rewards-dots" role="tablist" aria-label="Reward slides">
          {REWARDS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${r.title} for ${r.recipients.join(" and ")}`}
              className={`rewards-dot ${i === index ? "rewards-dot--active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
