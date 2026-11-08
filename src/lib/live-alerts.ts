/**
 * Live alerts: the pop-ups that make sure nobody misses a booking, a
 * confirmation or an emergency. The same file is used by the patient app,
 * the provider portal and the super-admin dashboard; only the pop-up UI differs.
 *
 * How alerts arrive
 * - Live: GET /portal/notifications/stream (server-sent events over fetch, so
 *   the normal Authorization header works). The server replays anything
 *   unread since the last event when we reconnect.
 * - Fallback: when the stream is not available (older API, proxy that buffers,
 *   network trouble) we ask for unread notifications every 20 seconds.
 * - On start we also pick up unread important alerts from the last 24 hours,
 *   so something that arrived while the app was closed still pops up.
 *
 * What the person can do
 * - OK / open: marks the notification read (it leaves every tab and device).
 * - Later: hides the pop-up on this browser for a while; it stays unread in
 *   the bell, so it is never lost.
 * - Light alerts fade on their own and stay unread in the bell.
 *
 * Several tabs: every tab shows the pop-up, but a dismissal in one closes it
 * in the others, and only one visible tab plays the sound.
 */
import { api, authorizedFetch } from './api';

export type AlertLevel = 'critical' | 'important' | 'light';
export interface AlertMeta { kind: string; id: string; providerId?: string; status?: string }
export interface LiveAlert { id: string; templateKey: string; level: AlertLevel; title: string; body: string; link: string | null; meta: AlertMeta | null; createdAt: string }
export type Connection = 'off' | 'connecting' | 'live' | 'polling';
/** soundBlocked: the browser refused to play (nobody has clicked the page yet); the pop-up offers a button. */
interface State { alerts: LiveAlert[]; connection: Connection; muted: boolean; soundBlocked: boolean }

interface RawNotice { id: string; templateKey?: string | null; level?: string | null; title?: string | null; body?: string | null; link?: string | null; meta?: AlertMeta | null; createdAt: string; readAt?: string | null; channel?: string }

const POLL_MS = 20_000;
/** While the stream is live we still check now and then, so a silent stream can never lose an alert. */
const SAFETY_POLL_MS = 30_000;
/** Alerts created this long before sign-in still count as new (clock differences, slow first load). */
const START_GRACE_MS = 60_000;
const BACKLOG_MS = 24 * 3_600_000;
const SNOOZE_MS = 12 * 3_600_000;
const LIGHT_MS = 7_000;
const MAX_VISIBLE = 20;
const MUTE_KEY = 'carevanta.alerts.muted';
const SNOOZE_KEY = 'carevanta.alerts.snoozed';

/**
 * Level for notifications sent before the API tagged them (or by an older API).
 * The server's `level` always wins when present.
 */
const FALLBACK_LEVEL: Record<string, AlertLevel> = {
  'portal.dispatch_offer': 'critical',
  'portal.appointment_booked': 'important',
  'portal.diagnostic_order_placed': 'important',
  'portal.pharmacy_order_placed': 'important',
  'portal.affiliation_invited': 'important',
  'portal.affiliation_requested': 'important',
  'appointment.confirmed': 'important',
  'appointment.rejected': 'important',
  'appointment.cancelled_by_provider': 'important',
  'appointment.cancelled_by_platform': 'important',
  'appointment.rescheduled': 'important',
  'patient.report_published': 'important',
};

export function levelOf(n: Pick<RawNotice, 'level' | 'templateKey' | 'title'>): AlertLevel {
  if (n.level === 'critical' || n.level === 'important' || n.level === 'light') return n.level;
  // A walk-in is recorded by the desk itself: nobody needs a pop-up for it.
  if (n.templateKey === 'portal.appointment_booked' && /walk-in/i.test(n.title ?? '')) return 'light';
  return FALLBACK_LEVEL[n.templateKey ?? ''] ?? 'light';
}

export function toAlert(n: RawNotice): LiveAlert {
  return { id: n.id, templateKey: n.templateKey ?? '', level: levelOf(n), title: n.title ?? 'Notification', body: n.body ?? '', link: n.link ?? null, meta: n.meta ?? null, createdAt: n.createdAt };
}

/** Parse a chunk of server-sent events. Returns complete events and the unfinished remainder. */
export function parseSse(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

// ── Small browser helpers (all safe on the server and in private mode) ─────
const readJson = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

function snoozed(): Record<string, number> {
  const now = Date.now();
  const all = readJson<Record<string, number>>(SNOOZE_KEY, {});
  return Object.fromEntries(Object.entries(all).filter(([, until]) => until > now));
}

// ── Sound: recorded CC0 alert sounds in /public/sounds (see CREDITS.md there) ─
export type AlertTone = 'important' | 'success' | 'critical';
const SOUND_FILES: Record<AlertTone, { src: string; volume: number }> = {
  important: { src: '/sounds/alert-important.mp3', volume: 0.8 },
  success: { src: '/sounds/alert-success.mp3', volume: 1 },
  critical: { src: '/sounds/alert-urgent.mp3', volume: 1 },
};
const players: Partial<Record<AlertTone, HTMLAudioElement>> = {};
function player(tone: AlertTone): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  players[tone] ??= Object.assign(new Audio(SOUND_FILES[tone].src), { preload: 'auto', volume: SOUND_FILES[tone].volume });
  return players[tone];
}
/**
 * Browsers only allow sound after the person has touched the page once. On the
 * first tap or key press, play each sound silently for a moment so later
 * alerts can be heard (this is what iOS Safari and Chrome require).
 */
function unlockAudioOnFirstGesture() {
  if (typeof window === 'undefined') return;
  (Object.keys(SOUND_FILES) as AlertTone[]).forEach((t) => player(t)?.load());
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    for (const t of Object.keys(SOUND_FILES) as AlertTone[]) {
      const el = player(t);
      if (!el) continue;
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
/** Important: a bright chime. Success: a softer good-news chime. Critical: an urgent triple ping. Light: silent. */
export async function playAlertSound(level: AlertLevel, tone?: AlertTone): Promise<'played' | 'blocked' | 'skipped'> {
  if (level === 'light') return 'skipped';
  try { navigator.vibrate?.(level === 'critical' ? [300, 120, 300, 120, 300] : [180, 80, 180]); } catch { /* not supported */ }
  const el = player(tone ?? (level === 'critical' ? 'critical' : 'important'));
  if (!el) return 'skipped';
  el.currentTime = 0;
  try {
    await el.play();
    return 'played';
  } catch (e) {
    // NotAllowedError: the browser wants one click on the page first. The pop-up still shows and offers a button.
    return e instanceof DOMException && e.name === 'NotAllowedError' ? 'blocked' : 'skipped';
  }
}

// ── The store ───────────────────────────────────────────────────────────────
let state: State = { alerts: [], connection: 'off', muted: false, soundBlocked: false };
/** When each alert last made a sound in any tab, so two tabs never ring together. */
const lastSounded = new Map<string, number>();
const listeners = new Set<() => void>();
const handled = new Set<string>(); // ids this tab has shown or dismissed
let startedAt = 0;
let onNewHandlers: (() => void)[] = [];
let channel: BroadcastChannel | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
export const liveAlerts = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => state,
  /** Server snapshot: nothing pops up during server rendering. */
  getServer: (): State => SERVER_STATE,

  /** Called when anything new arrives, e.g. to refresh the bell count. */
  onNew(fn: () => void) { onNewHandlers.push(fn); return () => { onNewHandlers = onNewHandlers.filter((h) => h !== fn); }; },

  /** OK / opened: read everywhere. */
  async dismiss(id: string) {
    remove([id]);
    channel?.postMessage({ type: 'read', ids: [id] });
    try { await api.post('/portal/notifications/read', { ids: [id] }); } catch { /* the bell still has it; harmless */ }
    onNewHandlers.forEach((h) => h());
  },
  /** Later: hide here for a while; stays unread in the bell. */
  snooze(id: string) {
    writeJson(SNOOZE_KEY, { ...snoozed(), [id]: Date.now() + SNOOZE_MS });
    remove([id]);
    channel?.postMessage({ type: 'snooze', id });
  },
  /** Light alerts fade without being marked read. */
  fade(id: string) { remove([id]); },
  setMuted(muted: boolean) { writeJson(MUTE_KEY, muted); set({ muted }); },
  /**
   * Ring for an alert in exactly one tab. A visible tab rings at once; a tab in the background
   * (the desk has another tab open) waits a moment and rings only if no other tab did, so the
   * alert is heard even when the portal is not the tab on screen.
   */
  sound(alert: LiveAlert, tone?: AlertTone) {
    if (state.muted || alert.level === 'light') return;
    const recentlyRang = () => Date.now() - (lastSounded.get(alert.id) ?? 0) < 1_500;
    const ring = async () => {
      if (recentlyRang()) return;
      lastSounded.set(alert.id, Date.now());
      channel?.postMessage({ type: 'sounded', id: alert.id, at: Date.now() });
      const result = await playAlertSound(alert.level, tone);
      if (result === 'blocked') set({ soundBlocked: true });
      else if (result === 'played' && state.soundBlocked) set({ soundBlocked: false });
    };
    if (visible()) void ring();
    else setTimeout(() => void ring(), 600);
  },
  /** The "Enable Sound" button: runs inside a click, which is what browsers need to allow audio. */
  enableSound() {
    set({ soundBlocked: false, muted: false });
    writeJson(MUTE_KEY, false);
    void playAlertSound('important');
  },

  /** Start listening for the signed-in person. Returns a stop function. */
  start(): () => void {
    const abort = new AbortController();
    handled.clear();
    startedAt = Date.now();
    set({ alerts: [], connection: 'connecting', muted: readJson<boolean>(MUTE_KEY, false), soundBlocked: false });
    unlockAudioOnFirstGesture();
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('carevanta-alerts');
      channel.onmessage = (e: MessageEvent<{ type: string; ids?: string[]; id?: string; at?: number }>) => {
        if (e.data.type === 'read' && e.data.ids) remove(e.data.ids);
        if (e.data.type === 'snooze' && e.data.id) remove([e.data.id]);
        if (e.data.type === 'sounded' && e.data.id) { soundedElsewhere.add(e.data.id); lastSounded.set(e.data.id, e.data.at ?? Date.now()); }
      };
    }
    void run(abort.signal);
    return () => {
      abort.abort();
      channel?.close();
      channel = null;
      set({ alerts: [], connection: 'off' });
    };
  },
};
const SERVER_STATE: State = { alerts: [], connection: 'off', muted: false, soundBlocked: false };
/** Ids another tab has already played a sound for. */
export const soundedElsewhere = new Set<string>();

function remove(ids: string[]) {
  ids.forEach((id) => handled.add(id));
  if (state.alerts.some((a) => ids.includes(a.id))) set({ alerts: state.alerts.filter((a) => !ids.includes(a.id)) });
}

/** Add alerts we have not shown yet. Light ones fade by themselves. */
function enqueue(raw: RawNotice[]) {
  const sleeping = snoozed();
  const now = Date.now();
  const fresh = raw
    .filter((n) => !n.readAt && (!n.channel || n.channel === 'IN_APP'))
    .map(toAlert)
    .filter((a) => !handled.has(a.id) && !sleeping[a.id] && !state.alerts.some((x) => x.id === a.id))
    // New since sign-in: always. Older: only unread important or critical ones from the last day.
    .filter((a) => { const at = new Date(a.createdAt).getTime(); return at >= startedAt - START_GRACE_MS || (a.level !== 'light' && now - at < BACKLOG_MS); });
  if (!fresh.length) return;
  fresh.forEach((a) => handled.add(a.id));
  // Newest first, critical always on top.
  const rank = (a: LiveAlert) => (a.level === 'critical' ? 0 : a.level === 'important' ? 1 : 2);
  const alerts = [...fresh, ...state.alerts].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_VISIBLE);
  set({ alerts });
  for (const a of fresh) if (a.level === 'light') setTimeout(() => liveAlerts.fade(a.id), LIGHT_MS);
  onNewHandlers.forEach((h) => h());
}

async function fetchUnread(): Promise<RawNotice[]> {
  const res = await api.get<{ data: RawNotice[] | { items: RawNotice[] } }>('/portal/notifications?unread=true&limit=20');
  const d = res.data;
  return Array.isArray(d) ? d : d.items;
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

/** Background check while the stream is live (a stream can stay open yet deliver nothing, e.g. behind a buffering proxy). */
async function safetyPoll(signal: AbortSignal) {
  while (!signal.aborted) {
    await sleep(SAFETY_POLL_MS, signal);
    if (signal.aborted) return;
    if (state.connection === 'live') { try { enqueue(await fetchUnread()); } catch { /* offline */ } }
  }
}

/** Main loop: backlog once, then live stream with reconnects, or polling when the stream is not there. */
async function run(signal: AbortSignal) {
  try { enqueue(await fetchUnread()); } catch { /* offline: the loop below retries */ }
  void safetyPoll(signal);
  // Reconnects ask the server to replay from the newest alert it sent (server time, so clocks never matter).
  let since = new Date(startedAt - START_GRACE_MS).toISOString();
  let backoff = 2_000;
  let streamMissing = false;
  while (!signal.aborted) {
    if (!streamMissing) {
      const outcome = await stream(signal, since, (at) => { if (at && at > since) since = at; backoff = 2_000; });
      if (signal.aborted) return;
      if (outcome === 'missing') streamMissing = true;
      else {
        // Dropped: catch up with one poll, then reconnect after a growing pause.
        set({ connection: 'polling' });
        try { enqueue(await fetchUnread()); } catch { /* offline */ }
        await sleep(backoff, signal);
        backoff = Math.min(backoff * 2, 30_000);
        continue;
      }
    }
    // No stream on this API: poll, and look for the stream again every few minutes.
    set({ connection: 'polling' });
    for (let i = 0; i < 9 && !signal.aborted; i++) {
      try { enqueue(await fetchUnread()); } catch { /* offline */ }
      await sleep(POLL_MS, signal);
    }
    streamMissing = false;
  }
}

/** One stream connection. Resolves when it ends: 'missing' when the API has no stream, 'dropped' otherwise. */
async function stream(signal: AbortSignal, since: string, alive: (latestCreatedAt: string | null) => void): Promise<'missing' | 'dropped'> {
  let res: Response;
  try {
    res = await authorizedFetch(`/portal/notifications/stream?since=${encodeURIComponent(since)}`, { headers: { accept: 'text/event-stream' }, signal, cache: 'no-store' });
  } catch {
    return 'dropped';
  }
  if (res.status === 404 || res.status === 405 || res.status === 501) return 'missing';
  if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) return res.ok ? 'missing' : 'dropped';
  set({ connection: 'live' });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return 'dropped';
      buffer += value;
      const parsed = parseSse(buffer);
      buffer = parsed.rest;
      alive(null);
      for (const ev of parsed.events) {
        try {
          const data = JSON.parse(ev.data) as RawNotice & { ids?: string[] | 'all' };
          if (ev.event === 'notification') { enqueue([data]); alive(data.createdAt); }
          else if (ev.event === 'read') remove(data.ids === 'all' ? state.alerts.map((a) => a.id) : (data.ids ?? []));
        } catch { /* ignore a malformed event */ }
      }
    }
  } catch {
    return 'dropped';
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
