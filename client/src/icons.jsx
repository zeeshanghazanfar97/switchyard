// Icon set — stroke-based, 16px default, currentColor.
// Keep this small and consistent; no per-icon styling.
import React from 'react'

export function Icon({ name, size = 16, strokeWidth = 1.6, style }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const paths = {
    router: <><path {...p} d="M3 8h18" /><path {...p} d="M3 16h18" /><circle {...p} cx="7" cy="8" r="1.5" /><circle {...p} cx="17" cy="16" r="1.5" /></>,
    service: <><rect {...p} x="3" y="4" width="18" height="6" rx="1.5" /><rect {...p} x="3" y="14" width="18" height="6" rx="1.5" /><circle {...p} cx="6.5" cy="7" r=".6" fill="currentColor" /><circle {...p} cx="6.5" cy="17" r=".6" fill="currentColor" /></>,
    middleware: <><path {...p} d="M4 12h4" /><path {...p} d="M16 12h4" /><rect {...p} x="8" y="7" width="8" height="10" rx="1.5" /><path {...p} d="M10 11h4M10 14h3" /></>,
    yaml: <><path {...p} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path {...p} d="M14 3v5h5" /><path {...p} d="M8 13l1.5 2L11 13M8 17h3M13 13l1.5 2L16 13M14.5 15v2" /></>,
    settings: <><circle {...p} cx="12" cy="12" r="3" /><path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    plus: <><path {...p} d="M12 5v14M5 12h14" /></>,
    trash: <><path {...p} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></>,
    edit: <><path {...p} d="M12 20h9" /><path {...p} d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    save: <><path {...p} d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path {...p} d="M17 21v-8H7v8M7 3v5h8" /></>,
    search: <><circle {...p} cx="11" cy="11" r="7" /><path {...p} d="m21 21-4.3-4.3" /></>,
    chev: <><path {...p} d="m9 18 6-6-6-6" /></>,
    chevDown: <><path {...p} d="m6 9 6 6 6-6" /></>,
    copy: <><rect {...p} x="9" y="9" width="13" height="13" rx="2" /><path {...p} d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    check: <><path {...p} d="M20 6 9 17l-5-5" /></>,
    x: <><path {...p} d="M18 6 6 18M6 6l12 12" /></>,
    sun: <><circle {...p} cx="12" cy="12" r="4" /><path {...p} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <><path {...p} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></>,
    eye: <><path {...p} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle {...p} cx="12" cy="12" r="3" /></>,
    eyeOff: <><path {...p} d="M17.94 17.94A10.06 10.06 0 0 1 12 19c-6 0-10-7-10-7a17.6 17.6 0 0 1 3.94-4.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 7 10 7a17.74 17.74 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" /></>,
    lock: <><rect {...p} x="3" y="11" width="18" height="11" rx="2" /><path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    user: <><circle {...p} cx="12" cy="8" r="4" /><path {...p} d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
    shield: <><path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
    git: <><circle {...p} cx="6" cy="6" r="2" /><circle {...p} cx="6" cy="18" r="2" /><circle {...p} cx="18" cy="12" r="2" /><path {...p} d="M6 8v8M8 18h6a4 4 0 0 0 4-4v-2M16 12V8a2 2 0 0 0-2-2H8" /></>,
    drag: <><circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="18" r="1.2" fill="currentColor" /><circle cx="15" cy="6" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="18" r="1.2" fill="currentColor" /></>,
    link: <><path {...p} d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path {...p} d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
    bolt: <><path {...p} d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></>,
    alert: <><path {...p} d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path {...p} d="M12 9v4M12 17h.01" /></>,
    info: <><circle {...p} cx="12" cy="12" r="10" /><path {...p} d="M12 16v-4M12 8h.01" /></>,
    refresh: <><path {...p} d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path {...p} d="M21 3v5h-5" /></>,
    server: <><rect {...p} x="2" y="3" width="20" height="8" rx="2" /><rect {...p} x="2" y="13" width="20" height="8" rx="2" /><circle cx="6" cy="7" r="1" fill="currentColor" /><circle cx="6" cy="17" r="1" fill="currentColor" /></>,
    globe: <><circle {...p} cx="12" cy="12" r="10" /><path {...p} d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>,
    download: <><path {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
    upload: <><path {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></>,
    helm: <><circle {...p} cx="12" cy="12" r="4" /><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" /></>,
    logout: <><path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
    arrow: <><path {...p} d="M5 12h14M13 5l7 7-7 7" /></>,
    history: <><path {...p} d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3L3 8" /><path {...p} d="M3 3v5h5M12 7v5l3 2" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {paths[name] || null}
    </svg>
  )
}
