// === js/shell/environment.js — Shell environment variables ===

const ShellEnvironment = {
  /** @param {object} opts — { hostname, user, home } from system config */
  create(opts = {}) {
    const vars = new Map();

    // Defaults
    const defaults = {
      HOME:     opts.home || '/Users/starwink',
      USER:     opts.user || 'starwink',
      HOSTNAME: opts.hostname || 'MacBook-Pro',
      SHELL:    '/bin/zsh',
      PWD:      opts.home || '/Users/starwink',
      OLDPWD:   '',
      PATH:     '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      LANG:     'en_US.UTF-8',
      TERM:     'xterm-256color',
      EDITOR:   'nano',
      LOGNAME:  opts.user || 'starwink',
    };

    for (const [k, v] of Object.entries(defaults)) vars.set(k, v);

    const api = {
      get(key) { return vars.has(key) ? vars.get(key) : ''; },

      set(key, value) { vars.set(key, String(value)); },

      getAll() {
        const obj = {};
        for (const [k, v] of vars) obj[k] = v;
        return obj;
      },

      /** Expand $VAR and ${VAR} in a string */
      expand(input) {
        return input.replace(/\$(\w+)|\$\{(\w+)\}/g, (_, name, name2) => {
          const key = name || name2;
          return vars.has(key) ? vars.get(key) : '';
        });
      },

      /** Expand vars in each arg */
      expandArgs(args) {
        return (args || []).map(a => api.expand(a));
      },

      /** Get current working directory */
      get cwd() { return vars.get('PWD') || '/'; },
      /** Set current working directory */
      set cwd(v) { vars.set('OLDPWD', vars.get('PWD')); vars.set('PWD', v); },
      get oldpwd() { return vars.get('OLDPWD') || vars.get('PWD'); },

      /** @deprecated legacy support: also expose .PWD for direct access */
      get PWD() { return vars.get('PWD'); },
      set PWD(v) { vars.set('PWD', v); },
    };

    return api;
  }
};
