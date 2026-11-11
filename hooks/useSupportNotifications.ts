"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { get } from "@/lib/api";

const ENDPOINT = "/api/v1/report/unread_report_messages";
const BELL_SOUND_URL = "/music/bell_sound.mp3";
const POLL_MS = 10_000; // tab visible
const HIDDEN_POLL_MS = 30_000; // tab in background (the bell still rings when a message arrives)
const MIN_TONE_GAP_MS = 2_000; // never ring twice within 2 s
const MIN_REQUEST_GAP_MS = 1_500; // never hit the API twice within 1.5 s
const STOP_GRACE_MS = 1_500; // keep polling through quick unmount -> mount churn (Strict Mode, route changes)

export interface SupportNotification {
  id: string;
  subject: string;
  displayMessage: string;
  totalMessages: number;
  ticketId: string | null;
}

export function extractNotifications(response: unknown): {
  totalCount: number;
  reports: SupportNotification[];
} {
  const root = response as Record<string, unknown> | null;
  const responseData = root?.responseData;
  const data =
    responseData && typeof responseData === "object"
      ? (responseData as Record<string, unknown>)
      : root;
  const result =
    data?.result && typeof data.result === "object"
      ? (data.result as Record<string, unknown>)
      : data;
  const rawReports = Array.isArray(result)
    ? result
    : (result?.reports ??
      result?.messages ??
      result?.unreadReports ??
      result?.issues ??
      []);
  const reports = Array.isArray(rawReports) ? rawReports : [];
  const normalized = reports.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const report = item as Record<string, unknown>;
    const id = String(
      report.id ?? report.reportId ?? report.issueId ?? "",
    ).trim();
    if (!id) return [];
    const displayMessage = String(
      report.display_message ??
      report.displayMessage ??
      report.message ??
      "You have a new support message.",
    );
    return [
      {
        id,
        subject: String(report.subject ?? "Support ticket"),
        displayMessage,
        totalMessages: Number(
          report.total_messages ?? report.totalMessages ?? 0,
        ),
        ticketId: displayMessage.match(/\bTKT-\d{8}-\d+\b/i)?.[0] ?? null,
      },
    ];
  });
  const totalCount = Number(
    result?.totalCount ?? result?.total_count ?? normalized.length,
  );
  return {
    totalCount: Number.isFinite(totalCount) ? totalCount : normalized.length,
    reports: normalized,
  };
}

/**
 * True only when something NEW arrived since the previous poll (a ticket that was not unread
 * before, or a ticket whose unread count grew, or the total grew). The first poll is only a
 * baseline, and reading messages (counts going down) never rings the bell.
 */
function hasNewUnread(
  previous: Map<string, number> | null,
  previousTotal: number | null,
  next: { totalCount: number; reports: SupportNotification[] },
) {
  if (!previous || previousTotal === null) return false;
  return (
    next.reports.some(
      (report) =>
        !previous.has(report.id) ||
        report.totalMessages > (previous.get(report.id) ?? 0),
    ) || next.totalCount > previousTotal
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE shared store + ONE poller for the whole browser window.
//
// All mutable state lives in a single object that is stored on `window`. Even if the bundler (or
// Fast Refresh / HMR in dev) ends up with two copies of this module, both copies read and write the
// SAME state, so they share one in-flight request, one timer and one set of listeners. That is what
// guarantees a single unread request per poll for Navbar, the tickets list and any other component.
//
// Debug: run  localStorage.setItem("debug:notifications", "1")  in the console and reload. Every real
// request is then logged ("[notifications] GET ..."). If the Network tab shows more requests than
// that log, the extra one is made by some other code that calls this endpoint directly.
// ─────────────────────────────────────────────────────────────────────────────
type Store = { notifications: SupportNotification[]; total: number };
type Subscriber = { token: string | null; playSound: boolean };
type Reason = "start" | "poll" | "visible" | "token";
interface Shared {
  empty: Store;
  store: Store;
  listeners: Set<() => void>;
  subscribers: Set<Subscriber>;
  activeToken: string | null;
  running: boolean;
  pollTimer: number | undefined;
  stopTimer: number | undefined;
  inflight: Promise<void> | null;
  lastRequestAt: number;
  generation: number;
  previousCounts: Map<string, number> | null;
  previousTotal: number | null;
  lastToneAt: number;
  audio: HTMLAudioElement | null;
  audioContext: AudioContext | null;
  bellBuffer: AudioBuffer | null;
  bellLoadPromise: Promise<AudioBuffer | null> | null;
  audioUnlocked: boolean;
  pendingTone: boolean;
  unlockBound: boolean;
  onVisibility: () => void;
  onUnlock: () => void;
  runVisibility: () => void;
  runUnlock: () => void;
}

const SHARED_KEY = Symbol.for("scaninfoga.supportNotifications.v3");

function createShared(): Shared {
  const empty: Store = { notifications: [], total: 0 };
  const shared: Shared = {
    empty,
    store: empty,
    listeners: new Set(),
    subscribers: new Set(),
    activeToken: null,
    running: false,
    pollTimer: undefined,
    stopTimer: undefined,
    inflight: null,
    lastRequestAt: 0,
    generation: 0,
    previousCounts: null,
    previousTotal: null,
    lastToneAt: 0,
    audio: null,
    audioContext: null,
    bellBuffer: null,
    bellLoadPromise: null,
    audioUnlocked: false,
    pendingTone: false,
    unlockBound: false,
    onVisibility: () => shared.runVisibility(),
    onUnlock: () => shared.runUnlock(),
    runVisibility: () => undefined,
    runUnlock: () => undefined,
  };
  return shared;
}

function getShared(): Shared {
  if (typeof window === "undefined") return createShared(); // server render: throw-away state
  const host = globalThis as unknown as Record<symbol, Shared | undefined>;
  let shared = host[SHARED_KEY];
  if (!shared) {
    shared = createShared();
    host[SHARED_KEY] = shared;
  }
  shared.bellBuffer ??= null;
  shared.bellLoadPromise ??= null;
  shared.runVisibility = () => onVisibilityChange();
  shared.runUnlock = () => unlockAudio();
  return shared;
}

const S = getShared();

function debug(...args: unknown[]) {
  try {
    if (window.localStorage.getItem("debug:notifications") === "1") {
      console.debug("[notifications]", ...args);
    }
  } catch {
    /* ignore */
  }
}

function setStore(next: Store) {
  S.store = next;
  S.listeners.forEach((listener) => listener());
}

function pickToken(): string | null {
  let found: string | null = null;
  S.subscribers.forEach((subscriber) => {
    if (!found && subscriber.token) found = subscriber.token;
  });
  return found;
}

function soundWanted(): boolean {
  let wanted = false;
  S.subscribers.forEach((subscriber) => {
    if (subscriber.playSound) wanted = true;
  });
  return wanted;
}

// ── Bell sound ───────────────────────────────────────────────────────────────
// Preload and decode /music/bell_sound.mp3 into Web Audio (with HTMLAudioElement
// fallback) so playback is instant and reliable across polls once unlocked.
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

function bindUnlock() {
  if (S.unlockBound || typeof window === "undefined") return;
  S.unlockBound = true;
  UNLOCK_EVENTS.forEach((event) =>
    window.addEventListener(event, S.onUnlock, { capture: true, passive: true }),
  );
}

function unbindUnlock() {
  if (!S.unlockBound) return;
  S.unlockBound = false;
  UNLOCK_EVENTS.forEach((event) =>
    window.removeEventListener(event, S.onUnlock, true),
  );
}

function onAudioReady() {
  S.audioUnlocked = true;
  debug("bell sound unlocked and ready");
  unbindUnlock();
  if (S.pendingTone) {
    S.pendingTone = false;
    void playBellSound();
  }
}

function getFallbackAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!S.audio) {
    const audio = new Audio(BELL_SOUND_URL);
    audio.preload = "auto";
    S.audio = audio;
  }
  return S.audio;
}

async function loadBellBuffer(): Promise<AudioBuffer | null> {
  if (S.bellBuffer) return S.bellBuffer;
  if (S.bellLoadPromise) return S.bellLoadPromise;
  const audioContext = S.audioContext;
  if (!audioContext || typeof window === "undefined") return null;
  if (!S.activeToken && !pickToken()) return null;

  const promise = (async () => {
    try {
      const response = await fetch(BELL_SOUND_URL, {
        credentials: "same-origin",
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) return null;
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      S.bellBuffer = decoded;
      return decoded;
    } catch (error) {
      debug("failed to load bell sound", error);
      return null;
    }
  })();

  S.bellLoadPromise = promise;
  void promise.finally(() => {
    if (S.bellLoadPromise === promise) S.bellLoadPromise = null;
  });
  return promise;
}

function initAudio() {
  if (typeof window === "undefined") return;

  if (!S.audioContext) {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const audioContext = new AudioCtx();
        S.audioContext = audioContext;
        audioContext.addEventListener("statechange", () => {
          if (S.audioContext !== audioContext) return;
          if (audioContext.state === "running") {
            onAudioReady();
          } else {
            S.audioUnlocked = false;
          }
        });
      }
    } catch (error) {
      console.error("Notifications: could not initialize bell sound", error);
    }
  }

  if (S.audioContext) {
    if (S.audioContext.state === "running") {
      onAudioReady();
    } else {
      S.audioUnlocked = false;
      bindUnlock();
    }
    if (S.activeToken || pickToken()) {
      void loadBellBuffer();
    }
    return;
  }

  if (S.activeToken || pickToken()) {
    getFallbackAudio();
  }
  if (!S.audioUnlocked) bindUnlock();
}

function unlockAudio() {
  if (S.audio && S.pendingTone) {
    S.pendingTone = false;
    void playFallbackAudio();
    return;
  }

  const audioContext = S.audioContext;
  if (audioContext) {
    if (audioContext.state === "running") {
      onAudioReady();
    } else {
      void audioContext
        .resume()
        .then(() => {
          if (audioContext.state === "running") {
            onAudioReady();
          }
        })
        .catch((error) => {
          debug("browser rejected bell sound unlock", error);
        });
    }
  }

  const audio =
    S.audio ??
    (!audioContext && (S.activeToken || pickToken())
      ? getFallbackAudio()
      : null);
  if (!audio) return;

  if (S.pendingTone && !audioContext) {
    S.pendingTone = false;
    void playFallbackAudio();
    return;
  }

  audio.muted = true;
  void audio
    .play()
    .then(() => {
      if (!S.pendingTone) {
        audio.pause();
        audio.currentTime = 0;
      }
      audio.muted = false;
      if (!audioContext) {
        onAudioReady();
      } else if (S.pendingTone && !S.bellBuffer) {
        S.pendingTone = false;
        void playFallbackAudio();
      }
    })
    .catch((error) => {
      audio.muted = false;
      debug("browser rejected fallback bell sound unlock", error);
    });
}

async function playFallbackAudio(): Promise<boolean> {
  const now = Date.now();
  if (now - S.lastToneAt < MIN_TONE_GAP_MS) return false;
  const audio = getFallbackAudio();
  if (!audio) return false;

  const previousToneAt = S.lastToneAt;
  try {
    audio.muted = false;
    if (audio.readyState > 0) {
      audio.currentTime = 0;
    }
    S.lastToneAt = now;
    await audio.play();
    S.audioUnlocked = true;
    unbindUnlock();
    debug("ring");
    return true;
  } catch (error) {
    S.lastToneAt = previousToneAt;
    const name = (error as { name?: string } | null)?.name;
    if (name === "NotAllowedError") {
      debug(
        "new message, but the browser still blocks sound (no click / tap / key yet)",
      );
      S.pendingTone = true;
      bindUnlock();
    } else {
      debug("bell sound playback failed", error);
    }
    return false;
  }
}

async function playBellSound() {
  const now = Date.now();
  if (now - S.lastToneAt < MIN_TONE_GAP_MS) return;

  initAudio();

  const audioContext = S.audioContext;
  if (audioContext) {
    if (audioContext.state !== "running") {
      debug(
        "new message, but the browser still blocks sound (no click / tap / key yet)",
      );
      S.audioUnlocked = false;
      S.pendingTone = true;
      bindUnlock();
      return;
    }

    const buffer = S.bellBuffer ?? (await loadBellBuffer());
    if (buffer) {
      const playAt = Date.now();
      if (playAt - S.lastToneAt < MIN_TONE_GAP_MS) return;
      if (audioContext.state !== "running") {
        S.audioUnlocked = false;
        S.pendingTone = true;
        bindUnlock();
        return;
      }
      S.lastToneAt = playAt;
      debug("ring");
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
      return;
    }
  }

  await playFallbackAudio();
}

// ── Single-flight request ────────────────────────────────────────────────────
function load(reason: Reason): Promise<void> {
  if (!S.activeToken) return Promise.resolve();
  if (S.inflight) return S.inflight; // everyone shares the request that is already running
  const now = Date.now();
  if (now - S.lastRequestAt < MIN_REQUEST_GAP_MS) return Promise.resolve();
  S.lastRequestAt = now;
  debug("GET", ENDPOINT, `(${reason})`);

  const requestGeneration = S.generation;
  const request = (async () => {
    try {
      const next = extractNotifications(await get(ENDPOINT));
      if (requestGeneration !== S.generation) return; // logged out / reset while loading

      const unread = Math.max(
        next.totalCount > 0 ? next.totalCount : next.reports.length,
        0,
      );
      const hasMessages = unread > 0 || next.reports.length > 0;
      if (!hasMessages) {
        S.pendingTone = false;
      }
      const isInitialUnread =
        S.previousCounts === null &&
        S.previousTotal === null &&
        hasMessages;
      const hasNewMessage = hasNewUnread(S.previousCounts, S.previousTotal, {
        totalCount: unread,
        reports: next.reports,
      });
      if (soundWanted() && (isInitialUnread || hasNewMessage)) {
        void playBellSound();
      }

      S.previousTotal = unread;
      S.previousCounts = new Map(
        next.reports.map((report) => [report.id, report.totalMessages]),
      );
      setStore({ notifications: next.reports, total: unread });
    } catch (error) {
      console.error("Notifications: fetch failed", error);
    }
  })();

  S.inflight = request;
  void request.finally(() => {
    if (S.inflight === request) S.inflight = null;
  });
  return request;
}

// ── Poll loop (one chain, 10 s visible / 30 s hidden) ────────────────────────
function nextDelay() {
  return document.visibilityState === "visible" ? POLL_MS : HIDDEN_POLL_MS;
}

function schedule() {
  window.clearTimeout(S.pollTimer);
  if (!S.running) return;
  S.pollTimer = window.setTimeout(() => void tick("poll"), nextDelay());
}

async function tick(reason: Reason) {
  await load(reason);
  schedule();
}

function onVisibilityChange() {
  if (!S.running) return;
  if (document.visibilityState === "visible") void tick("visible"); // refresh right away when the tab returns
  else schedule();
}

function startLoop() {
  if (S.running) return;
  S.running = true;
  document.addEventListener("visibilitychange", S.onVisibility);
  void tick("start"); // first request immediately
}

function stopLoop() {
  S.running = false;
  window.clearTimeout(S.pollTimer);
  document.removeEventListener("visibilitychange", S.onVisibility);
}

function resetState() {
  S.generation += 1;
  S.inflight = null;
  S.lastRequestAt = 0;
  S.previousCounts = null;
  S.previousTotal = null;
  S.pendingTone = false;
  if (S.store !== S.empty) setStore(S.empty);
}

function cancelStop() {
  if (S.stopTimer === undefined) return;
  window.clearTimeout(S.stopTimer);
  S.stopTimer = undefined;
}

function scheduleStop() {
  if (S.stopTimer !== undefined) return;
  S.stopTimer = window.setTimeout(() => {
    S.stopTimer = undefined;
    if (pickToken()) return; // somebody registered again in the meantime
    stopLoop();
    S.activeToken = null;
    resetState(); // logout: the next login starts from a clean baseline
  }, STOP_GRACE_MS);
}

/** Called whenever a component registers / unregisters. Starts or stops the single poller. */
function sync() {
  const token = pickToken();
  if (!token) {
    if (soundWanted()) initAudio();
    scheduleStop();
    return;
  }

  cancelStop();
  const tokenChanged = token !== S.activeToken;
  S.activeToken = token;

  if (soundWanted()) initAudio();

  if (!S.running) startLoop();
  else if (tokenChanged) void load("token");
  // same token and already running (e.g. a second component mounted): nothing to do, no extra request
}

function register(subscriber: Subscriber) {
  S.subscribers.add(subscriber);
  sync();
  return () => {
    S.subscribers.delete(subscriber);
    sync();
  };
}

function subscribe(listener: () => void) {
  S.listeners.add(listener);
  return () => {
    S.listeners.delete(listener);
  };
}

const getSnapshot = () => S.store;
const getServerSnapshot = () => S.empty;

export function useSupportNotifications(
  token: string | null,
  { playSound = true }: { playSound?: boolean } = {},
) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => register({ token, playSound }), [token, playSound]);

  // Optimistic removal when the user opens a ticket. The snapshots used for the "new message" check
  // are left untouched on purpose: if the server is slow to mark the ticket as read, the next poll
  // returns the same counts and must not ring the bell.
  const markAsRead = useCallback((id: string) => {
    setStore({
      notifications: S.store.notifications.filter(
        (notification) => notification.id !== id,
      ),
      total: Math.max(0, S.store.total - 1),
    });
  }, []);

  return {
    notifications: snapshot.notifications,
    total: snapshot.total,
    markAsRead,
  };
}