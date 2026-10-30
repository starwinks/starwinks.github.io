// === js/services/menubar-service.js — Menu Bar rendering & dropdowns ===

const MenubarService = {
  /**
   * @param {HTMLElement} menubarLeft  — #menubar-left element
   * @param {HTMLElement} contextMenu  — #context-menu element
   * @param {object} config             — ConfigService instance
   * @param {object} wm                 — WindowManager instance
   * @param {object} notify             — NotificationService instance
   * @param {object} clipboard          — ClipboardService instance (optional)
   * @param {object} events             — EventBus instance
   */
  create(menubarLeft, contextMenu, config, wm, notify, clipboard, events) {
    let menuActions = {};
    let systemConfig = {};

    function buildActions(sys, wmInst, notif, clip) {
      return {
        about:    () => notif.show('About', `${sys.name} v${sys.version}\nBrowser-based macOS simulation`),
        open_settings: () => wmInst.open('settings'),
        force_quit:  () => { const a = wmInst.getActive(); if (a) wmInst.close(a.id); },
        sleep:       () => document.body.style.filter = 'brightness(0.3)',
        restart:     () => location.reload(),
        shutdown:    () => document.body.style.filter = 'brightness(0)',
        new_finder:  () => wmInst.open('finder'),
        new_folder:  () => notif.show('Finder', 'New folder created'),
        open_file:   () => notif.show('Finder', 'Open dialog shown'),
        close_window:() => { const a = wmInst.getActive(); if (a) wmInst.close(a.id); },
        get_info:    () => notif.show('Finder', 'Info panel opened'),
        undo:        () => notif.show('Edit', 'Undo'),
        redo:        () => notif.show('Edit', 'Redo'),
        cut:         () => { if (clip) clip.copy(''); notif.show('Edit', 'Cut'); },
        copy:        () => { if (clip) clip.copy('Simulated clipboard content'); notif.show('Edit', 'Copied'); },
        paste:       () => { const t = clip ? clip.paste() : ''; notif.show('Edit', t ? 'Pasted' : 'Clipboard empty'); },
        select_all:  () => notif.show('Edit', 'Select All'),
        view_icons:   () => notif.show('View', 'Icon view'),
        view_list:    () => notif.show('View', 'List view'),
        view_columns: () => notif.show('View', 'Column view'),
        toggle_path_bar: () => notif.show('View', 'Path bar toggled'),
        toggle_tab_bar:  () => notif.show('View', 'Tab bar toggled'),
        fullscreen:  () => { const a = wmInst.getActive(); if (a) wmInst.toggleMaximize(a.id); },
        go_back:     () => {},
        go_forward:  () => {},
        go_desktop:   () => notif.show('Go', 'Desktop'),
        go_documents: () => notif.show('Go', 'Documents'),
        go_downloads: () => notif.show('Go', 'Downloads'),
        go_home:      () => notif.show('Go', 'Home'),
        go_computer:  () => notif.show('Go', 'Computer'),
        go_to_folder: () => notif.show('Go', 'Go to Folder'),
        minimize:     () => { const a = wmInst.getActive(); if (a) wmInst.minimize(a.id); },
        zoom:         () => { const a = wmInst.getActive(); if (a) wmInst.toggleMaximize(a.id); },
        prev_window:  () => _cycle(wmInst, -1),
        next_window:  () => _cycle(wmInst, 1),
        bring_all_front: () => { wmInst.getWindows().forEach(w => { if (!w.minimized) wmInst.focus(w.id); }); },
        help:      () => notif.show('Help', 'Help viewer would open here'),
        shortcuts: () => notif.show('Shortcuts', '⌘N Finder  ⌘T Terminal  ⌘, Settings  ⌘W Close  ⌘M Minimize  ⌘Q Quit  ⌘Tab Switcher  ⌘C Copy  ⌘V Paste'),
      };
    }

    function _cycle(wmInst, dir) {
      const visible = wmInst.getWindows().filter(w => !w.minimized);
      if (visible.length === 0) return;
      const idx = visible.findIndex(w => w.id === wmInst.focusedId);
      const next = (idx + dir + visible.length) % visible.length;
      wmInst.focus(visible[next].id);
    }

    function getMenuItems(menuId) {
      const menu = (systemConfig.menus || []).find(m => m.id === menuId);
      if (!menu) return [];
      return (menu.items || []).map(item => {
        if (item.separator !== undefined) return '-';
        return {
          label: item.label,
          shortcut: item.shortcut || '',
          action: menuActions[item.action] || (() => notify.show(menu.label, item.label)),
        };
      });
    }

    function showContextMenu(items, x, y) {
      contextMenu.innerHTML = '';
      items.forEach(item => {
        if (item === '-') {
          const sep = document.createElement('div');
          sep.className = 'menu-sep';
          contextMenu.appendChild(sep);
        } else {
          const row = document.createElement('div');
          row.className = 'menu-row';
          row.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            contextMenu.classList.add('hidden');
            if (item.action) item.action();
          });
          contextMenu.appendChild(row);
        }
      });
      contextMenu.classList.remove('hidden');
      contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
      contextMenu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
    }

    const api = {
      init(sysCfg) {
        systemConfig = sysCfg;
        menuActions = buildActions(sysCfg, wm, notify, clipboard);
        this.render(sysCfg);
        this._bind();
      },

      render(sysCfg) {
        if (!menubarLeft) return;
        // Keep apple icon, remove old menu items
        menubarLeft.querySelectorAll('.menu-item').forEach(el => el.remove());
        const menus = sysCfg.menus || [];
        menus.forEach(menu => {
          const span = document.createElement('span');
          span.className = 'menu-item';
          span.dataset.menu = menu.id;
          span.textContent = menu.label;
          menubarLeft.appendChild(span);
        });
      },

      _bind() {
        // Apple menu
        const apple = document.querySelector('.menu-apple');
        if (apple) {
          apple.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            showContextMenu(getMenuItems('finder'), rect.left, rect.bottom);
          });
        }
        // Other menus
        document.querySelectorAll('.menu-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = item.getBoundingClientRect();
            showContextMenu(getMenuItems(item.dataset.menu), rect.left, rect.bottom);
          });
        });
        // Click away hides
        document.addEventListener('click', () => contextMenu.classList.add('hidden'));
      },

      refresh(sysCfg) {
        if (sysCfg) systemConfig = sysCfg;
        menuActions = buildActions(systemConfig, wm, notify, clipboard);
        this.render(systemConfig);
        this._bind();
      },
    };

    return api;
  }
};
