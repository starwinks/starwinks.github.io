// === js/kernel.js — System kernel: boot sequence & service registry ===
//
// Boots the system by loading configs, initializing DB, registering services,
// then emits 'kernel:ready' to signal that the desktop can render.
//
// Services register via: Kernel.register('name', instance)
// Services are accessed via: Kernel.get('name')
// Apps (iframes) access via: window.parent.Kernel

const Kernel = {
  services: new Map(),
  _booted: false,

  register(name, instance) {
    this.services.set(name, instance);
  },

  get(name) {
    return this.services.get(name) || null;
  },

  has(name) {
    return this.services.has(name);
  },

  /** Boot sequence — called once from desktop.js */
  async boot() {
    if (this._booted) return;
    console.log('[Kernel] Booting...');

    // 1. Load configs (uses ConfigLoader from config.js)
    let configs;
    try {
      configs = await ConfigLoader.loadAll();
      this.register('config', configs);
      console.log('[Kernel] Configs loaded');
    } catch (e) {
      console.error('[Kernel] Config load failed:', e);
      return;
    }

    // 2. Init database (uses DBManager from db.js — still global during transition)
    try {
      await DBManager.init();
      this.register('db', DBManager);
      console.log('[Kernel] Database ready');
    } catch (e) {
      console.error('[Kernel] DB init failed:', e);
    }

    // 3. Register event bus
    this.register('events', EventBus);

    // 4. Emit ready
    this._booted = true;
    EventBus.emit('kernel:ready', { configs });
    console.log('[Kernel] Ready.');
  },
};
