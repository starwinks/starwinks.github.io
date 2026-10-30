// === js/event-bus.js — Publish/Subscribe event system ===
//
// The central nervous system. All services communicate through this bus
// rather than calling each other directly.
//
// Predefined events:
//   window:opened, window:closed, window:focused, window:minimized, window:restored
//   app:launched, app:terminated
//   clipboard:changed
//   settings:changed
//   process:spawned, process:killed
//   fs:changed
//   kernel:ready

const EventBus = (() => {
  const listeners = new Map();   // eventName → Set<handler>

  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => off(event, handler);  // returns unsubscribe fn
  }

  function off(event, handler) {
    const set = listeners.get(event);
    if (set) set.delete(handler);
  }

  function emit(event, data) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(data); } catch (e) { console.error(`[EventBus] ${event} handler error:`, e); }
    }
  }

  function once(event, handler) {
    const unsub = on(event, (data) => {
      unsub();
      handler(data);
    });
  }

  function clear() { listeners.clear(); }

  function debug() {
    const out = [];
    for (const [event, set] of listeners) out.push(`${event}: ${set.size} listener(s)`);
    return out;
  }

  return { on, off, emit, once, clear, debug };
})();
