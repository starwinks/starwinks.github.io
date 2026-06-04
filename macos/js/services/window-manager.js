// === js/services/window-manager.js — Window Management Service ===
//
// Extracted from desktop.js. Manages window state (create, close, focus,
// minimize, maximize, drag, resize) and emits events on state changes.
//
// Dependencies: EventBus, IPC, ConfigService (for app definitions)

const WindowManager = {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container  — the #windows-container element
   * @param {object} opts.events           — EventBus instance
   * @param {object} opts.config           — ConfigService instance
   * @param {object} opts.ipc              — IPC module
   */
  create({ container, events, config, ipc }) {
    let windows = [];
    let idCounter = 0;
    let focusedId = null;
    let zBase = 100;

    const api = {
      get windows() { return windows; },
      get focusedId() { return focusedId; },

      // ---- Window Lifecycle ----

      open(appKey, opts = {}) {
        const app = config.getApp(appKey);
        if (!app) return null;

        const existing = windows.find(w => w.app === appKey && !w.minimized);
        if (existing) { api.focus(existing.id); return existing; }

        const id = ++idCounter;
        const maxW = window.innerWidth - 80;
        const maxH = window.innerHeight - 140;
        let w = Math.min(opts.width || app.width, maxW);
        let h = Math.min(opts.height || app.height, maxH);

        const offset = (windows.filter(w => !w.minimized).length * 30) % 300;
        let x = opts.x ?? (60 + offset), y = opts.y ?? (50 + offset);
        if (x + w > window.innerWidth - 20) x = 20;
        if (y + h > window.innerHeight - 100) y = 20;

        const el = document.createElement('div');
        el.className = 'window focused';
        el.id = `win-${id}`;
        Object.assign(el.style, {
          left: x + 'px', top: y + 'px',
          width: w + 'px', height: h + 'px',
          zIndex: ++zBase,
        });
        el.innerHTML = `
          <div class="window-titlebar" data-win-id="${id}">
            <div class="traffic-lights">
              <div class="traffic-btn close" data-action="close"><span class="icon">✕</span></div>
              <div class="traffic-btn minimize" data-action="minimize"><span class="icon">−</span></div>
              <div class="traffic-btn maximize" data-action="maximize"><span class="icon">＋</span></div>
            </div>
            <div class="window-title">${app.name}</div>
          </div>
          <div class="window-content"><iframe src="${app.url}"></iframe></div>
          <div class="resize-handle resize-n"></div><div class="resize-handle resize-s"></div>
          <div class="resize-handle resize-e"></div><div class="resize-handle resize-w"></div>
          <div class="resize-handle resize-ne"></div><div class="resize-handle resize-nw"></div>
          <div class="resize-handle resize-se"></div><div class="resize-handle resize-sw"></div>
        `;
        container.appendChild(el);

        const winObj = { id, app: appKey, el, minimized: false, maximized: false, prevBounds: null, title: app.name };
        windows.push(winObj);

        // Events
        el.addEventListener('mousedown', () => api.focus(id));
        el.querySelectorAll('.traffic-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const a = btn.dataset.action;
            if (a === 'close') api.close(id);
            else if (a === 'minimize') api.minimize(id);
            else if (a === 'maximize') api.toggleMaximize(id);
          });
        });
        el.querySelector('.window-titlebar').addEventListener('dblclick', () => api.toggleMaximize(id));
        _setupDrag(api, el, el.querySelector('.window-titlebar'), id);
        _setupResize(api, el, id);

        api.focus(id);
        if (events) events.emit('window:opened', { id, app: appKey, title: app.name });
        return winObj;
      },

      close(id) {
        const idx = windows.findIndex(w => w.id === id);
        if (idx === -1) return;
        const win = windows[idx];
        win.el.style.transition = 'all 0.2s ease-in';
        win.el.style.transform = 'scale(0.9)';
        win.el.style.opacity = '0';
        win.el.addEventListener('transitionend', () => win.el.remove());
        windows.splice(idx, 1);
        if (focusedId === id) {
          focusedId = windows.length > 0 ? windows[windows.length-1].id : null;
          if (focusedId) api.focus(focusedId);
        }
        if (events) events.emit('window:closed', { id, app: win.app });
      },

      focus(id) {
        if (focusedId === id) return;
        windows.forEach(w => w.el.classList.remove('focused'));
        const win = windows.find(w => w.id === id);
        if (win) {
          win.el.classList.add('focused');
          win.el.style.zIndex = ++zBase;
          const prev = focusedId;
          focusedId = id;
          if (events) events.emit('window:focused', { id, prev });
        }
      },

      minimize(id) {
        const win = windows.find(w => w.id === id);
        if (!win || win.minimized) return;
        win.minimized = true;
        win.el.classList.add('minimizing');
        win.el.addEventListener('animationend', function h() {
          win.el.removeEventListener('animationend', h);
          win.el.style.display = 'none';
          win.el.classList.remove('minimizing');
        });
        if (focusedId === id) {
          const visible = windows.filter(w => w.id !== id && !w.minimized);
          focusedId = visible.length > 0 ? visible[visible.length-1].id : null;
          if (focusedId) api.focus(focusedId);
        }
        if (events) events.emit('window:minimized', { id });
      },

      restore(id) {
        const win = windows.find(w => w.id === id);
        if (!win || !win.minimized) return;
        win.minimized = false;
        win.el.style.display = '';
        win.el.style.animation = 'windowOpen 0.25s cubic-bezier(0.22, 0.61, 0.36, 1)';
        api.focus(id);
        if (events) events.emit('window:restored', { id });
      },

      toggleMaximize(id) {
        const win = windows.find(w => w.id === id);
        if (!win) return;
        if (win.maximized) {
          win.maximized = false;
          win.el.classList.remove('maximized');
          if (win.prevBounds) {
            Object.assign(win.el.style, {
              left: win.prevBounds.x+'px', top: win.prevBounds.y+'px',
              width: win.prevBounds.w+'px', height: win.prevBounds.h+'px',
            });
          }
        } else {
          win.prevBounds = {
            x: parseInt(win.el.style.left), y: parseInt(win.el.style.top),
            w: parseInt(win.el.style.width), h: parseInt(win.el.style.height),
          };
          win.maximized = true;
          win.el.classList.add('maximized');
        }
      },

      setTitle(id, title) {
        const win = windows.find(w => w.id === id);
        if (win) {
          win.title = title;
          win.el.querySelector('.window-title').textContent = title;
        }
      },

      // Queries
      getActive() { return windows.find(w => w.id === focusedId) || null; },
      getWindows() { return [...windows]; },
      getRunningApps() {
        const set = new Set();
        windows.filter(w => !w.minimized).forEach(w => set.add(w.app));
        return [...set];
      },
      hasWindow(appKey) { return windows.some(w => w.app === appKey && !w.minimized); },
    };

    return api;
  }
};

// === Internal drag/resize helpers ===

function _setupDrag(api, win, handle, id) {
  let sx, sy, wx, wy, dragging = false;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.traffic-btn')) return;
    const wo = api.windows.find(w => w.id === id);
    if (wo && wo.maximized) return;
    dragging = true; sx = e.clientX; sy = e.clientY;
    wx = parseInt(win.style.left); wy = parseInt(win.style.top);
    win.style.transition = 'none'; e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.style.left = Math.max(-100, wx + e.clientX - sx) + 'px';
    win.style.top = Math.max(0, wy + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; win.style.transition = ''; });
}

function _setupResize(api, win, id) {
  win.querySelectorAll('.resize-handle').forEach(h => {
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const wo = api.windows.find(w => w.id === id);
      if (wo && wo.maximized) return;
      const dir = Array.from(h.classList).find(c => c.startsWith('resize-'));
      if (!dir) return;
      const d = dir.replace('resize-', '');
      const sx = e.clientX, sy = e.clientY;
      const sw = parseInt(win.style.width), sh = parseInt(win.style.height);
      const sl = parseInt(win.style.left), st = parseInt(win.style.top);
      win.style.transition = 'none';
      function move(ev) {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        let nw = sw, nh = sh, nl = sl, nt = st;
        if (d.includes('e')) nw = Math.max(320, sw + dx);
        if (d.includes('w')) { nw = Math.max(320, sw - dx); nl = sl + dx; }
        if (d.includes('s')) nh = Math.max(200, sh + dy);
        if (d.includes('n')) { nh = Math.max(200, sh - dy); nt = st + dy; }
        if (nl < -100) nl = -100; if (nt < 26) nt = 26;
        Object.assign(win.style, { width:nw+'px', height:nh+'px', left:nl+'px', top:nt+'px' });
      }
      function up() { win.style.transition = ''; document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); }
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  });
}
