// === js/services/config-service.js — Configuration Service ===
//
// Wraps ConfigLoader (from js/config.js) and adds runtime mutation
// capability. Config values can be overridden at runtime (stored in DB),
// falling back to YAML defaults.

const ConfigService = {
  /** @param {object} db — DBManager (optional, for persisted overrides) */
  create(db) {
    let _apps = {};
    let _dock = {};
    let _system = {};

    const api = {
      /** Load configs from YAML + DB overrides */
      async load() {
        const cfg = await ConfigLoader.loadAll();
        _apps = cfg.apps;
        _dock = cfg.dock;
        _system = cfg.system;
        return cfg;
      },

      // ---- Accessors ----
      get apps() { return _apps; },
      get dock() { return _dock; },
      get system() { return _system; },

      getApps() { return _apps; },
      getApp(key) { return _apps[key] || null; },
      getDockItems() { return _dock.items || []; },
      getSystemMenus() { return _system.menus || []; },
      getDesktopIcons() { return _system.desktop_icons || []; },

      /** Get wallpaper setting (from DB override or config default) */
      getWallpaper() {
        if (db) {
          const saved = db.getSetting('wallpaper');
          if (saved && saved !== 'default') return saved;
        }
        return _system.wallpaper || 'default';
      },

      /** Set wallpaper (persisted to DB) */
      setWallpaper(name) {
        if (db) db.setSetting('wallpaper', name);
      },
    };

    return api;
  }
};
