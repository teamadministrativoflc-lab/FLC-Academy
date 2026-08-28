// Simple stroke SVG icons — no external lib
const Icon = ({ path, size = 18, stroke = 1.6, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
       {...rest}>
    {path}
  </svg>
);

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.5 5-5 2.5 2.5-5z"/></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></>,
  book: <><path d="M4 4h9a3 3 0 0 1 3 3v14"/><path d="M4 4v14a3 3 0 0 1 3 3h9"/><path d="M4 4a3 3 0 0 0 3 3h9"/></>,
  play: <><polygon points="7 5 20 12 7 19 7 5"/></>,
  progress: <><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9"/><path d="m12 7 3 3-3 3"/></>,
  clipboard: <><rect x="7" y="4" width="10" height="17" rx="1"/><path d="M9 4V3h6v1"/><path d="M10 10h4M10 14h4M10 18h2"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></>,
  chat: <><path d="M21 12a8 8 0 1 1-3-6.2L21 4l-.5 3.5A8 8 0 0 1 21 12z"/></>,
  handshake: <><path d="M11 17 8 20l-3-3 3-3"/><path d="m13 17 3 3 3-3-3-3"/><path d="M8 14 4.5 10.5a2 2 0 0 1 0-3l2-2a2 2 0 0 1 3 0L12 8l2.5-2.5a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L16 14"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
  arrow: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
  arrowSmall: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
  download: <><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></>,
  check: <><path d="M20 6 9 17l-5-5"/></>,
  x: <><path d="M18 6 6 18M6 6l12 12"/></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M6 18l4-4M14 10l4-4"/></>,
  filter: <><path d="M3 6h18M6 12h12M10 18h4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></>,
  warning: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
  ban: <><circle cx="12" cy="12" r="9"/><path d="m5 5 14 14"/></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></>,
  bmi: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></>,
};

const I = ({ name, ...rest }) => <Icon path={ICONS[name] || null} {...rest} />;

window.I = I;
window.ICONS = ICONS;
