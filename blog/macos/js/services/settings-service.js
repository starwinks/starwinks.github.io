// === js/services/settings-service.js — System Preferences ===
//
// Thin wrapper around DBManager settings table + event emission.

const SettingsService = {
  /** @param {object} db — DBManager instance */
  /** @param {object} events — EventBus instance */
  create(db, events) {
    const api = {
      get(key, fallback = null) {
        const v = db ? db.getSetting(key) : null;
        return v !== null ? v : fallback;
      },

      set(key, value) {
        if (db) db.setSetting(key, String(value));
        if (events) events.emit('settings:changed', { key, value: String(value) });
      },

      getAll() {
        return db ? db.getSettingsMap() : {};
      },

      /** Toggle a boolean setting */
      toggle(key) {
        const current = api.get(key, 'false');
        api.set(key, current === 'true' ? 'false' : 'true');
      },

      /** Get as boolean */
      getBool(key, fallback = false) {
        return api.get(key, String(fallback)) === 'true';
      },

      /** Get as number */
      getNum(key, fallback = 0) {
        return Number(api.get(key, String(fallback)));
      },
    };

    return api;
  }
};
