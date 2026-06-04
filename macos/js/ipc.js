// === js/ipc.js — iframe ↔ desktop communication protocol ===
//
// Standardizes all messages between app iframes and the desktop shell.
//
// Each message has: { type: string, ...payload }
//
// App → Desktop message types:
//   'window:set-title'   { title }
//   'window:close'        {}
//   'window:minimize'     {}
//   'window:maximize'     {}
//   'notification:show'   { title, body }
//   'clipboard:copy'      { text }
//   'clipboard:paste'     {}          → clipboard content returned in response
//
// Desktop → App message types (via postMessage to iframe):
//   'app:focus'           {}
//   'app:blur'            {}
//   'clipboard:content'   { text }    ← response to clipboard:paste

const IPC = {
  /** Map of handlers registered by service name */
  _handlers: new Map(),

  /** Register a handler for a message type */
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, []);
    this._handlers.get(type).push(handler);
  },

  /** Dispatch an incoming message (call from desktop message listener) */
  async dispatch(msg, source) {
    const { type } = msg;
    const handlers = this._handlers.get(type) || [];
    for (const h of handlers) {
      try {
        await h(msg, source);
      } catch (e) {
        console.error(`[IPC] Handler error for "${type}":`, e);
      }
    }
  },

  /** Send a message to an iframe window */
  send(targetWindow, msg) {
    if (targetWindow) {
      targetWindow.postMessage(msg, '*');
    }
  },

  /** Create the message listener (call once on desktop) */
  setupListener() {
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data.type) return;
      this.dispatch(e.data, e.source);
    });
  },
};
