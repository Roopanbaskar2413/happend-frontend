import { AlertBoltIcon, CalendarIcon, RefreshIcon } from "../icons/TravelIcons.jsx";

const STEPS = [
  {
    Icon: CalendarIcon,
    title: "You plan",
    blurb: "Pick your dates, pace, and interests. We build a day-by-day itinerary around them.",
  },
  {
    Icon: AlertBoltIcon,
    title: "Something changes",
    blurb: "You're running late, it starts raining, or a place turns out to be closed.",
  },
  {
    Icon: RefreshIcon,
    title: "It reflows",
    blurb: "One tap reschedules the rest of the day and explains exactly what changed, and why.",
  },
];

const EXAMPLE_CHANGES = [
  {
    action: "dropped",
    title: "Paradise Beach",
    reason: "The last ferry out is 16:00 — you'd reach the jetty at 16:20.",
  },
  {
    action: "added",
    title: "Pondicherry Museum",
    reason: "Indoor, 10 min away, open until 17:00.",
  },
  {
    action: "moved",
    title: "Dinner at Villa Shanti",
    reason: "Pushed from 19:30 to 20:15 so you aren't rushing the museum.",
  },
];

export default function HowItAdapts() {
  return (
    <section className="adapts">
      <h2 className="landing__section-title reveal" style={{ "--reveal-delay": "0ms" }}>
        How it adapts
      </h2>

      <div className="adapts__steps">
        {STEPS.map(({ Icon, title, blurb }, i) => (
          <div key={title} className="adapts__step reveal" style={{ "--reveal-delay": `${i * 100}ms` }}>
            <div className="adapts__step-icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{blurb}</p>
            {i < STEPS.length - 1 && <span className="adapts__connector" aria-hidden="true" />}
          </div>
        ))}
      </div>

      <div className="adapts__example reveal" style={{ "--reveal-delay": "300ms" }}>
        <p className="adapts__example-caption">Example: it started raining at 14:20</p>
        <ul className="change-log">
          {EXAMPLE_CHANGES.map((change) => (
            <li key={change.title} className={`change-log__item change-log__item--${change.action}`}>
              <span className="change-log__action">{change.action}</span>
              <span className="change-log__body">
                <strong>{change.title}</strong>
                <span className="change-log__reason">{change.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
