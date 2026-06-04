// === js/config.js — YAML configuration loader ===
//
// Fetches .yaml files from config/ and parses them with js-yaml.
// Falls back to hardcoded defaults if fetch fails (e.g. when opened as file://).
//
// Usage:
//   const configs = await ConfigLoader.loadAll();
//   console.log(configs.apps.finder.name);

const ConfigLoader = {
  _cache: {},

  /** Fetch and parse a single YAML file */
  async load(name) {
    if (this._cache[name]) return this._cache[name];

    try {
      const resp = await fetch(`config/${name}.yaml`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const data = (typeof jsyaml !== 'undefined')
        ? jsyaml.load(text)
        : this._fallbackParse(text);   // crude fallback
      this._cache[name] = data;
      return data;
    } catch (e) {
      console.warn(`ConfigLoader: failed to load config/${name}.yaml — using fallback`, e.message);
      const fb = FALLBACK_CONFIGS[name];
      this._cache[name] = fb;
      return fb;
    }
  },

  /** Load all configs in parallel */
  async loadAll() {
    const [apps, dock, system] = await Promise.all([
      this.load('apps'),
      this.load('dock'),
      this.load('system'),
    ]);
    return { apps: apps.apps, dock: dock.dock, system: system.system };
  },

  /** Crude YAML subset parser for when js-yaml isn't available */
  _fallbackParse(text) {
    const result = {};
    const lines = text.split('\n');
    let currentObj = result;
    const stack = [];

    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);
      const content = trimmed.replace(/#.*$/, '');

      // Pop stack to match indent
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        currentObj = stack.pop().parent;
      }

      const listMatch = content.match(/^\s*-\s+(.+)/);
      const kvMatch = content.match(/^([^:]+):\s*(.*)/);

      if (listMatch) {
        if (!Array.isArray(currentObj._arr)) {
          currentObj._arr = [];
          const parentKey = stack.length > 0 ? stack[stack.length-1].key : null;
          if (parentKey) currentObj[parentKey] = currentObj._arr;
        }
        const val = this._parseValue(listMatch[1]);
        currentObj._arr.push(val);
      } else if (kvMatch) {
        const key = kvMatch[1].trim();
        let value = kvMatch[2].trim();

        if (value === '') {
          const newObj = {};
          currentObj[key] = newObj;
          stack.push({ key, obj: newObj, indent, parent: currentObj });
          currentObj = newObj;
        } else {
          currentObj[key] = this._parseValue(value);
        }
      }
    }
    return result;
  },

  _parseValue(v) {
    v = v.trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+\.?\d*$/.test(v)) return parseFloat(v);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      return v.slice(1, -1);
    return v;
  }
};

// ===== Fallback configs (used when fetch fails, e.g. file://) =====
const FALLBACK_CONFIGS = {
  apps: {
    apps: {
      finder:    { name:'Finder',    icon:'💾', url:'apps/finder.html',    width:800, height:520, default_open:true },
      terminal:  { name:'Terminal',  icon:'💻', url:'apps/terminal.html',  width:700, height:440 },
      notes:     { name:'Notes',     icon:'📝', url:'apps/notes.html',     width:720, height:500 },
      calculator:{ name:'Calculator',icon:'🔢', url:'apps/calculator.html',width:280, height:420 },
      settings:  { name:'Settings',  icon:'⚙️', url:'apps/settings.html',  width:680, height:500 },
      textedit:  { name:'TextEdit',  icon:'📄', url:'apps/textedit.html',  width:650, height:460 },
      monitor:   { name:'Monitor',   icon:'📊', url:'apps/monitor.html',   width:600, height:420 },
      browser:   { name:'Browser',   icon:'🌐', url:'apps/browser.html',   width:900, height:560 },
    }
  },
  dock: {
    dock: {
      position: 'bottom', auto_hide: false, magnification: false,
      items: [
        { app:'finder' }, { app:'terminal' }, { app:'notes' },
        { app:'calculator' }, { app:'settings' },
        { separator: null },
        { app:'textedit' }, { app:'monitor' }, { app:'browser' },
      ]
    }
  },
  system: {
    system: {
      name: 'macOS Browser Edition', version:'15.0', build:'24A335', hostname:'MacBook-Pro',
      desktop_icons: ['finder','terminal','notes','calculator','settings','textedit','monitor','browser'],
      wallpaper: 'default',
      menus: [
        { id:'finder', label:'Finder', items:[
          {label:'About This Mac', action:'about'},{separator:null},
          {label:'Settings...', shortcut:'⌘,', action:'open_settings'},{separator:null},
          {label:'Force Quit...', shortcut:'⌘⌥Esc', action:'force_quit'},{separator:null},
          {label:'Sleep', action:'sleep'},{label:'Restart...', action:'restart'},{label:'Shut Down...', action:'shutdown'}
        ]},
        { id:'file', label:'File', items:[
          {label:'New Finder Window', shortcut:'⌘N', action:'new_finder'},
          {label:'New Folder', shortcut:'⌘⇧N', action:'new_folder'},{separator:null},
          {label:'Open', shortcut:'⌘O', action:'open_file'},
          {label:'Close Window', shortcut:'⌘W', action:'close_window'},{separator:null},
          {label:'Get Info', shortcut:'⌘I', action:'get_info'}
        ]},
        { id:'edit', label:'Edit', items:[
          {label:'Undo', shortcut:'⌘Z', action:'undo'},{label:'Redo', shortcut:'⌘⇧Z', action:'redo'},{separator:null},
          {label:'Cut', shortcut:'⌘X', action:'cut'},{label:'Copy', shortcut:'⌘C', action:'copy'},
          {label:'Paste', shortcut:'⌘V', action:'paste'},{label:'Select All', shortcut:'⌘A', action:'select_all'}
        ]},
        { id:'view', label:'View', items:[
          {label:'as Icons', shortcut:'⌘1', action:'view_icons'},
          {label:'as List', shortcut:'⌘2', action:'view_list'},
          {label:'as Columns', shortcut:'⌘3', action:'view_columns'},{separator:null},
          {label:'Show Path Bar', action:'toggle_path_bar'},{label:'Show Tab Bar', action:'toggle_tab_bar'},{separator:null},
          {label:'Enter Full Screen', shortcut:'⌃⌘F', action:'fullscreen'}
        ]},
        { id:'go', label:'Go', items:[
          {label:'Back', shortcut:'⌘[', action:'go_back'},{label:'Forward', shortcut:'⌘]', action:'go_forward'},{separator:null},
          {label:'Desktop', action:'go_desktop'},{label:'Documents', action:'go_documents'},
          {label:'Downloads', action:'go_downloads'},{label:'Home', shortcut:'⌘⇧H', action:'go_home'},
          {label:'Computer', shortcut:'⌘⇧C', action:'go_computer'},{separator:null},
          {label:'Go to Folder...', shortcut:'⌘⇧G', action:'go_to_folder'}
        ]},
        { id:'window', label:'Window', items:[
          {label:'Minimize', shortcut:'⌘M', action:'minimize'},{label:'Zoom', action:'zoom'},{separator:null},
          {label:'Show Previous Tab', shortcut:'⌃⇧⇥', action:'prev_window'},
          {label:'Show Next Tab', shortcut:'⌃⇥', action:'next_window'},{separator:null},
          {label:'Bring All to Front', action:'bring_all_front'}
        ]},
        { id:'help', label:'Help', items:[
          {label:'macOS Help', action:'help'},{separator:null},
          {label:'Keyboard Shortcuts', action:'shortcuts'},{label:'About This Simulation', action:'about'}
        ]}
      ]
    }
  }
};
