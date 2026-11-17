/* Pulse tracker v1: no cookies, no persistent visitor ID, no dependency. */
(() => {
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  const script = document.currentScript;
  const key = script?.dataset.key;
  if (!key) return;
  const endpoint = new URL('/ingest', script.src).href;
  const identity = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  let session;
  try {
    session = sessionStorage.getItem('pulse-session');
    if (!session) sessionStorage.setItem('pulse-session', session = identity());
  } catch { session = String(Date.now()) + Math.random().toString(36); }
  let queue = [], lcp = 0, cls = 0, view = identity(), path = location.pathname;
  let interactions = new Map();
  const referrer = (() => { try { return new URL(document.referrer).hostname; } catch { return ''; } })();
  const base = () => ({ session, view, path: path.slice(0, 128), referrer_host: referrer, device: innerWidth < 768 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop', tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  function flush() {
    while (queue.length) {
      const payload = JSON.stringify({ key, events: queue.splice(0, 3) });
      const blob = new Blob([payload], { type: 'text/plain' });
      if (!navigator.sendBeacon?.(endpoint, blob)) fetch(endpoint, { method: 'POST', body: blob, mode: 'no-cors', keepalive: true }).catch(() => {});
    }
  }
  function event(event_type, timings = {}) {
    queue.push({ ...base(), event_type, timings });
    if (queue.length >= 3) flush();
  }
  function vitals() {
    const nav = performance.getEntriesByType('navigation')[0];
    const durations = [...interactions.values()].sort((a,b) => b-a);
    const timings = {};
    if (nav) Object.assign(timings, { ttfb_ms: nav.responseStart - nav.requestStart, dcl_ms: nav.domContentLoadedEventEnd, load_ms: nav.loadEventEnd });
    if (lcp) timings.lcp_ms = lcp;
    if (supportsCls) timings.cls = cls;
    if (durations.length) timings.inp_ms = durations[Math.min(durations.length - 1, Math.floor(interactions.size / 50))];
    event('vitals', timings);
  }
  function observe(type, callback, extra = {}) {
    try { new PerformanceObserver(list => list.getEntries().forEach(callback)).observe({ type, buffered: true, ...extra }); return true; } catch { return false; }
  }
  observe('largest-contentful-paint', entry => { lcp = entry.startTime; });
  let windowStart = 0, lastShift = 0, windowCls = 0;
  const supportsCls = observe('layout-shift', entry => {
    if (entry.hadRecentInput) return;
    if (entry.startTime - lastShift > 1000 || entry.startTime - windowStart > 5000) { windowStart = entry.startTime; windowCls = 0; }
    lastShift = entry.startTime; windowCls += entry.value; cls = Math.max(cls, windowCls);
  });
  observe('event', entry => {
    if (!entry.interactionId) return;
    interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) || 0, entry.duration));
    if (interactions.size > 500) interactions.delete(interactions.keys().next().value);
  }, { durationThreshold: 16 });
  function pageview() { event('pageview'); flush(); }
  const push = history.pushState;
  function resetPage() { path = location.pathname; lcp = cls = windowCls = windowStart = lastShift = 0; interactions = new Map(); view = identity(); pageview(); }
  history.pushState = function(...args) { vitals(); flush(); push.apply(this, args); resetPage(); };
  addEventListener('popstate', () => { vitals(); flush(); resetPage(); });
  addEventListener('load', () => { setTimeout(() => { vitals(); flush(); }, 0); }, { once: true });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { vitals(); flush(); } });
  setInterval(() => { if (document.visibilityState === 'visible') { event('heartbeat'); flush(); } }, 30000);
  pageview();
})();
