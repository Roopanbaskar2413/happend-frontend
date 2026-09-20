// Minimal line-art icons, drawn by hand (no icon font, no emoji).
// Single stroke, currentColor, so they inherit the card/hero color context.

const base = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function BeachIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 34c4-3 8-4.5 12-4.5s8 1.5 12 4.5" />
      <path d="M20 29c1.5-6 6-10 12-11" />
      <circle cx="33" cy="14" r="4.5" />
      <path d="M6 40h36" opacity="0.6" />
      <path d="M12 40c1-2.5 2.5-4 4.5-4s3.5 1.5 4.5 4" opacity="0.6" />
    </svg>
  );
}

export function HillsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 33 15 18l7 9 4-5 18 21" />
      <path d="M4 33h40" />
      <circle cx="34" cy="12" r="3.5" />
    </svg>
  );
}

export function BackwatersIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 26v-9l9-3v12" />
      <path d="M17 14h9l3 10" />
      <path d="M4 36c3-2.5 6-2.5 9 0s6 2.5 9 0 6-2.5 9 0 6 2.5 9 0" />
      <path d="M17 26h13" opacity="0.7" />
    </svg>
  );
}

export function CompassIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="17" />
      <path d="M29 19l-3 10-10 3 3-10z" />
    </svg>
  );
}

export function CloudShape(props) {
  return (
    <svg viewBox="0 0 100 60" fill="currentColor" {...props}>
      <ellipse cx="30" cy="38" rx="22" ry="16" />
      <ellipse cx="55" cy="28" rx="26" ry="20" />
      <ellipse cx="76" cy="40" rx="18" ry="14" />
      <rect x="14" y="36" width="72" height="20" rx="10" />
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="10" width="36" height="32" rx="4" />
      <path d="M6 19h36" />
      <path d="M15 6v8" />
      <path d="M33 6v8" />
      <path d="M14 27h6" />
      <path d="M14 34h6" />
      <path d="M28 27h6" />
    </svg>
  );
}

export function AlertBoltIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="18" />
      <path d="M26 14 16 27h8l-2 9 12-15h-8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RefreshIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 22a14 14 0 0 1 24-8.5" />
      <path d="M38 26a14 14 0 0 1-24 8.5" />
      <path d="M34 8v7h-7" />
      <path d="M14 40v-7h7" />
    </svg>
  );
}

export function PlaneIcon(props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" {...props}>
      <path d="M44 24 27 17.5V7c0-1.4-1.1-2.5-2.5-2.5S22 5.6 22 7v10.5L5 24v3l17-4v10l-5 3v2.5l7-1.5 7 1.5V36l-5-3V16l17 4z" />
    </svg>
  );
}
