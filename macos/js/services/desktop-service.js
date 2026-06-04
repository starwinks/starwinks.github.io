// === js/services/desktop-service.js — Desktop icons & wallpaper ===

const DesktopService = {
  /**
   * @param {HTMLElement} desktopEl — the #desktop element
   * @param {object} config          — ConfigService instance
   * @param {object} wm              — WindowManager instance
   * @param {object} notify          — NotificationService instance
   */
  create(desktopEl, config, wm, notify) {
    const api = {
      render() {
        if (!desktopEl) return;
        desktopEl.innerHTML = '';
        const icons = config.getDesktopIcons();
        icons.forEach(appKey => {
          const app = config.getApp(appKey);
          if (!app) return;
          const div = document.createElement('div');
          div.className = 'desktop-icon';
          div.dataset.app = appKey;
          div.innerHTML = `<div class="desktop-icon-img">${app.icon}</div><span>${app.name}</span>`;
          desktopEl.appendChild(div);
        });
        this._bind();
      },

      _bind() {
        if (!desktopEl) return;
        desktopEl.querySelectorAll('.desktop-icon').forEach(icon => {
          icon.addEventListener('dblclick', () => {
            const appKey = icon.dataset.app;
            if (appKey && config.getApp(appKey)) wm.open(appKey);
          });
          icon.addEventListener('click', () => {
            desktopEl.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
            icon.classList.add('selected');
          });
        });

        desktopEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          // Delegate to menubar service's context menu logic via a simple inline menu
          // (uses the same context-menu element if accessible)
          const ctx = document.getElementById('context-menu');
          if (!ctx) return;
          ctx.innerHTML = '';
          const items = [
            { label: 'New Folder', shortcut: '⌘⇧N' },
            { label: 'New File' },
            '-',
            { label: 'Change Wallpaper...' },
            '-',
            { label: 'Use Stacks' },
            { label: 'Show View Options' },
          ];
          items.forEach(item => {
            if (item === '-') {
              const sep = document.createElement('div'); sep.className = 'menu-sep'; ctx.appendChild(sep);
            } else {
              const row = document.createElement('div'); row.className = 'menu-row';
              row.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
              row.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.classList.add('hidden');
                if (item.label === 'Change Wallpaper...') wm.open('settings');
                else notify.show('Desktop', item.label);
              });
              ctx.appendChild(row);
            }
          });
          ctx.classList.remove('hidden');
          ctx.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
          ctx.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
        });
      },

      refresh() { this.render(); },
    };
    return api;
  }
};
