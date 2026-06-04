// === js/services/clipboard-service.js — System Clipboard ===
//
// In-memory text clipboard with event emission on changes.
// Wired to Edit menu actions and ⌘C/⌘V shortcuts.

const ClipboardService = {
  create(events) {
    let text = '';

    const api = {
      copy(content) {
        text = String(content);
        if (events) events.emit('clipboard:changed', { text });
      },

      paste() { return text; },

      clear() {
        text = '';
        if (events) events.emit('clipboard:changed', { text: '' });
      },

      hasContent() { return text.length > 0; },
    };

    return api;
  }
};
