import type { GuideFacts as GuideFactsData } from "@/services/guide";

/*
  "Did you know" on the Teach mode whiteboard: the few striking facts a teacher
  adds so a topic sticks - a date, a size, a speed, a record, where it's used
  today - each a big value with one line saying what it is. The facts are about
  the subject, never about the document being studied.
*/

const HUES = ["amber", "violet", "teal", "pink"] as const;

export function GuideFacts({ facts }: { facts: GuideFactsData }) {
  return (
    <div className="guide-facts">
      <p className="guide-facts-title">
        <span className="guide-facts-badge">Did you know?</span>
        {facts.title && <span>{facts.title}</span>}
      </p>
      <ul className="guide-facts-grid" data-count={facts.items.length}>
        {facts.items.map((it, i) => (
          <li key={i} className="guide-facts-item" data-hue={HUES[i % HUES.length]} style={{ animationDelay: `${i * 140}ms` }}>
            {/* the tutor's pointer anchor sits on the big value, the thing a finger goes to */}
            <span className="guide-facts-value" data-board-part={`items.${i}`} data-board-label={`${it.value} ${it.text}`}>
              {it.value}
            </span>
            <span className="guide-facts-text">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
