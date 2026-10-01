import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";
import {
  PAGE_IDLE_MS,
  advancePageVisit,
  createPageVisit,
  persistedPageVisit,
  routeKeyForPath,
} from "../utils/pageUsage";
import { upsertPageUsageSession } from "../api/pageUsageApi";

const QUEUE_PREFIX = "hsb:page-usage:v1:";
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const nowMono = () => performance.now();

function readQueue(ownerId) {
  try {
    const value = JSON.parse(localStorage.getItem(`${QUEUE_PREFIX}${ownerId}`) || "[]");
    return Array.isArray(value) ? value.slice(-100) : [];
  } catch { return []; }
}

function writeQueue(ownerId, rows) {
  try { localStorage.setItem(`${QUEUE_PREFIX}${ownerId}`, JSON.stringify(rows.slice(-100))); } catch { /* best effort */ }
}

async function flushQueue(ownerId) {
  const rows = readQueue(ownerId);
  if (!rows.length) return;
  const remaining = [];
  for (const row of rows) {
    try { await upsertPageUsageSession(row, ownerId); }
    catch { remaining.push(row); }
  }
  writeQueue(ownerId, remaining);
}

export default function usePageUsageTracker() {
  const location = useLocation();
  const lastInputAt = useRef(0);

  useEffect(() => {
    let ownerId;
    try { ownerId = captureEstablishedOwnerId(); } catch { return undefined; }
    lastInputAt.current = Date.now();
    let visit = createPageVisit({
      visitId: newId(),
      routeKey: routeKeyForPath(location.pathname),
      wallNow: Date.now(),
      monotonicNow: nowMono(),
    });
    let stopped = false;

    const isActive = () => document.visibilityState === "visible" && document.hasFocus() && Date.now() - lastInputAt.current < PAGE_IDLE_MS;
    const advance = () => { visit = advancePageVisit(visit, { wallNow: Date.now(), monotonicNow: nowMono(), active: isActive() }); };
    const queueCurrent = () => {
      advance();
      const row = persistedPageVisit(visit);
      if (!row) return null;
      const queue = readQueue(ownerId).filter((item) => item.visit_id !== row.visit_id);
      writeQueue(ownerId, [...queue, row]);
      return row;
    };
    const checkpoint = async () => {
      const row = queueCurrent();
      if (!row) return;
      try {
        await upsertPageUsageSession(row, ownerId);
        writeQueue(ownerId, readQueue(ownerId).filter((item) => item.visit_id !== row.visit_id));
      } catch { /* retained locally for replay */ }
    };
    const noteInput = () => {
      lastInputAt.current = Date.now();
      if (visit.monotonic_at == null && document.visibilityState === "visible" && document.hasFocus()) visit.monotonic_at = nowMono();
    };
    const onAttentionChange = () => advance();
    const onPageHide = () => { queueCurrent(); void flushQueue(ownerId); };

    void flushQueue(ownerId);
    const timer = window.setInterval(() => { if (!stopped) void checkpoint(); }, 15000);
    for (const type of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(type, noteInput, { passive: true });
    document.addEventListener("visibilitychange", onAttentionChange);
    window.addEventListener("focus", onAttentionChange);
    window.addEventListener("blur", onAttentionChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      for (const type of ["pointerdown", "keydown", "scroll", "touchstart"]) window.removeEventListener(type, noteInput);
      document.removeEventListener("visibilitychange", onAttentionChange);
      window.removeEventListener("focus", onAttentionChange);
      window.removeEventListener("blur", onAttentionChange);
      window.removeEventListener("pagehide", onPageHide);
      void checkpoint();
    };
  }, [location.pathname]);
}
