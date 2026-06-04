// === js/services/dock-service.js — Dock rendering & interaction ===

const DockService = {
  /**
   * @param {HTMLElement} dockEl  — the #dock element
   * @param {object} config        — ConfigService instance
   * @param {object} wm            — WindowManager instance
   */
  create(dockEl, config, wm) {
    const api = {
      render() {
        if (!dockEl) return;
        dockEl.innerHTML = '';
        const items = config.getDockItems();
        items.forEach(item => {
          if (item.separator !== undefined) {
            const sep = document.createElement('div');
            sep.className = 'dock-separator';
            dockEl.appendChild(sep);
            return;
          }
          const app = config.getApp(item.app);
          if (!app) return;
          const div = document.createElement('div');
          div.className = 'dock-item';
          div.dataset.app = item.app;
          div.title = app.name;
          div.innerHTML = `<div class="dock-icon">${app.icon}</div><span class="dock-label">${app.name}</span><div class="dock-indicator"></div>`;
          dockEl.appendChild(div);
        });
        this._bind();
      },

      _bind() {
        dockEl.querySelectorAll('.dock-item').forEach(item => {
          item.addEventListener('click', () => {
            const appKey = item.dataset.app;
            if (!appKey || !config.getApp(appKey)) return;
            const existing = wm.getWindows().find(w => w.app === appKey);
            if (existing && existing.minimized) {
              wm.restore(existing.id);
            } else if (existing && existing.id !== wm.focusedId) {
              wm.focus(existing.id);
            } else if (!existing) {
              wm.open(appKey);
            }
          });
        });
      },

      /** Update running indicators based on open windows */
      updateIndicators() {
        if (!dockEl) return;
        const running = new Set(wm.getWindows().filter(w => !w.minimized).map(w => w.app));
        dockEl.querySelectorAll('.dock-item').forEach(item => {
          item.classList.toggle('running', running.has(item.dataset.app));
        });
      },

      refresh() { this.updateIndicators(); },
    };
    return api;
  }
};
