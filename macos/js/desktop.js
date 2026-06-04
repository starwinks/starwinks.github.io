// === js/desktop.js — Desktop Bootstrap ===
//
// Assembles all services, boots the kernel, and renders the desktop.
// Now a thin ~100-line orchestrator instead of a 718-line monolith.
//
// Service dependency graph:
//   EventBus → Kernel → ConfigService → DB → WindowManager
//                                            → DockService → MenubarService
//                                            → DesktopService → NotificationService
//                                            → Shell (for terminal)

(async function init() {
  // ---- 1. Boot kernel (loads config + DB) ----
  await Kernel.boot();
  const cfg = Kernel.get('config');
  const db  = Kernel.get('db');
  const bus = Kernel.get('events');
  if (!cfg || !bus) { console.error('Kernel boot failed'); return; }

  // ---- 2. Create config service first (all other services depend on it) ----
  const configService = ConfigService.create(db);
  await configService.load();

  // ---- 3. Create other services ----
  const wm = WindowManager.create({
    container: document.getElementById('windows-container'),
    events: bus,
    config: configService,
    ipc: IPC,
  });

  const notify = NotificationService.create();
  const clipboard = ClipboardService.create(bus);
  const settings = SettingsService.create(db, bus);
  const proc = ProcessManager.create(bus);
  proc.seedSystem();

  // ---- 3. Register services with kernel ----
  Kernel.register('wm', wm);
  Kernel.register('configService', configService);
  Kernel.register('notify', notify);
  Kernel.register('clipboard', clipboard);
  Kernel.register('settings', settings);
  Kernel.register('proc', proc);

  // ---- 4. Create filesystem ----
  const fs = FileSystem.create(db);
  Kernel.register('fs', fs);

  // ---- 5. Create shell ----
  const env = ShellEnvironment.create({
    hostname: cfg.system.hostname || 'MacBook-Pro',
    user: 'starwink',
    home: '/Users/starwink',
  });
  const shell = Shell.create({ fs, proc, env, events: bus, config: cfg.system });
  shell.registerCommands(AllCommands);
  Kernel.register('shell', shell);

  // ---- 6. Render UI ----
  const dock = DockService.create(document.getElementById('dock'), configService, wm);
  dock.render();

  const menu = MenubarService.create(
    document.getElementById('menubar-left'),
    document.getElementById('context-menu'),
    configService, wm, notify, clipboard, bus
  );
  menu.init(cfg.system);

  const desktop = DesktopService.create(
    document.getElementById('desktop'),
    configService, wm, notify
  );
  desktop.render();

  // ---- 7. Sync dock indicators on window events ----
  bus.on('window:opened', () => dock.updateIndicators());
  bus.on('window:closed', () => dock.updateIndicators());
  bus.on('window:minimized', () => dock.updateIndicators());
  bus.on('window:restored', () => dock.updateIndicators());

  // Sync process manager with window open/close
  bus.on('window:opened', (data) => {
    proc.spawn(configService.getApp(data.app)?.name || data.app);
  });
  bus.on('window:closed', (data) => {
    const p = proc.list().find(p => p.name === configService.getApp(data.app)?.name);
    if (p) proc.kill(p.pid);
  });

  // ---- 8. Setup IPC (iframe message handling) ----
  IPC.setupListener();
  const wSrc = (s) => wm.getWindows().find(w => w.el.querySelector('iframe')?.contentWindow === s);

  IPC.on('window:set-title', (m, s) => { const w = wSrc(s); if (w) wm.setTitle(w.id, m.title); });
  IPC.on('window:close',    (m, s) => { const w = wSrc(s); if (w) wm.close(w.id); });
  IPC.on('window:minimize', (m, s) => { const w = wSrc(s); if (w) wm.minimize(w.id); });
  IPC.on('window:maximize', (m, s) => { const w = wSrc(s); if (w) wm.toggleMaximize(w.id); });
  IPC.on('notification:show', (m) => { notify.show(m.title || 'App', m.body || ''); });
  IPC.on('clipboard:copy', (m) => { clipboard.copy(m.text); });

  // Backward compat: old app message format (set-title, close, notify, etc.)
  IPC.on('set-title', (m, s) => { const w = wSrc(s); if (w) wm.setTitle(w.id, m.title); });
  IPC.on('close',     (m, s) => { const w = wSrc(s); if (w) wm.close(w.id); });
  IPC.on('minimize',  (m, s) => { const w = wSrc(s); if (w) wm.minimize(w.id); });
  IPC.on('maximize',  (m, s) => { const w = wSrc(s); if (w) wm.toggleMaximize(w.id); });
  IPC.on('notify',    (m) => { notify.show(m.title || 'App', m.body || ''); });

  // ---- 9. Keyboard shortcuts ----
  bindShortcuts(wm, clipboard, notify);

  // ---- 10. Clock ----
  updateClock();
  setInterval(updateClock, 10000);

  // ---- 11. Expose globals for iframe apps (backward compat) ----
  window.kernel = Kernel;
  window.appConfigs = cfg.apps;
  window.dbManager = db;
  window.markdownUtils = MarkdownUtils;

  // ---- 12. Auto-launch Finder ----
  const finderCfg = configService.getApp('finder');
  if (finderCfg && finderCfg.default_open) {
    setTimeout(() => wm.open('finder'), 500);
  }

  // ---- 13. Process ticker ----
  setInterval(() => proc.tick(), 3000);

  console.log(`macOS Desktop ready — ${AllCommands.length} shell commands, ${Kernel.services.size} services`);
})();

// ---- Clock ----
function updateClock() {
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = now.getHours(), m = now.getMinutes();
  const ts = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}  ${h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
  const el = document.getElementById('menubar-clock');
  if (el) el.textContent = ts;
}

// ---- Shortcuts ----
function bindShortcuts(wm, clipboard, notify) {
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      showAppSwitcher(true);
      return;
    }
    if (meta && e.key === 'q') { e.preventDefault(); const a = wm.getActive(); if (a) wm.close(a.id); }
    if (meta && e.key === 'w') { e.preventDefault(); const a = wm.getActive(); if (a) wm.close(a.id); }
    if (meta && e.key === 'm') { e.preventDefault(); const a = wm.getActive(); if (a) wm.minimize(a.id); }
    if (meta && e.key === 'c' && !e.target.closest('input,textarea,[contenteditable]')) {
      e.preventDefault();
      try { clipboard.copy(window.getSelection()?.toString() || ''); notify.show('Edit', 'Copied'); } catch(_){}
    }
    if (meta && e.key === 'v' && !e.target.closest('input,textarea,[contenteditable]')) {
      e.preventDefault();
      const txt = clipboard.paste();
      if (txt) notify.show('Edit', 'Pasted: ' + txt.substring(0, 30));
    }
    if (meta && e.key === 'n') { e.preventDefault(); wm.open('finder'); }
    if (meta && e.key === 't') { e.preventDefault(); wm.open('terminal'); }
    if (meta && e.key === ',') { e.preventDefault(); wm.open('settings'); }
  });
  document.addEventListener('keyup', (e) => {
    if (!e.metaKey && !e.ctrlKey) showAppSwitcher(false);
  });
}

// ---- App Switcher ----
function showAppSwitcher(show) {
  const el = document.getElementById('app-switcher');
  if (!el) return;
  if (show) {
    const cfg = Kernel.get('configService');
    if (!cfg) return;
    el.innerHTML = '';
    Object.entries(cfg.getApps()).forEach(([key, app]) => {
      const div = document.createElement('div');
      div.className = 'switcher-item';
      div.innerHTML = `<div class="sw-icon">${app.icon}</div><div>${app.name}</div>`;
      el.appendChild(div);
    });
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

// Sleep/Shutdown wake
document.body.addEventListener('click', () => {
  if (document.body.style.filter === 'brightness(0.3)') {
    document.body.style.filter = '';
  } else if (document.body.style.filter === 'brightness(0)') {
    document.body.style.filter = '';
    location.reload();
  }
});
