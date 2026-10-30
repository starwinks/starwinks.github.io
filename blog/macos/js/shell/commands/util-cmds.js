// === js/shell/commands/util-cmds.js — Utility Commands ===
// echo, date, cal, clear, help, history, which, env, type

const UtilityCommands = [
  {
    name: 'echo', description: 'Print text', usage: 'echo [-n] [text...]', category: 'util',
    execute(args, ctx) {
      const noNewline = args[0] === '-n';
      const text = (noNewline ? args.slice(1) : args).join(' ');
      return text;
    }
  },

  {
    name: 'date', description: 'Print date and time', usage: 'date', category: 'util',
    execute(args, ctx) {
      return new Date().toString();
    }
  },

  {
    name: 'cal', description: 'Calendar', usage: 'cal [year]', category: 'util',
    execute(args, ctx) {
      const now = new Date();
      const y = parseInt(args[0]) || now.getFullYear();
      let out = [];
      out.push(`                             ${y}`);
      for (let mo = 1; mo <= 12; mo++) {
        out.push(`     ${new Date(y,mo-1,1).toLocaleString('en',{month:'long'})}`);
        out.push('Su Mo Tu We Th Fr Sa');
        const fd = new Date(y, mo-1, 1).getDay();
        const dim = new Date(y, mo, 0).getDate();
        let cal = '   '.repeat(fd);
        for (let d = 1; d <= dim; d++) {
          cal += String(d).padStart(2, ' ') + ' ';
          if ((fd + d) % 7 === 0 && d < dim) { out.push(cal); cal = ''; }
        }
        if (cal.trim()) out.push(cal);
        out.push('');
      }
      return out.join('\n');
    }
  },

  {
    name: 'clear', description: 'Clear terminal', usage: 'clear', category: 'util',
    execute(args, ctx) {
      if (ctx.tty && ctx.tty.clear) ctx.tty.clear();
      return '';
    }
  },

  {
    name: 'help', description: 'List available commands', usage: 'help', category: 'util',
    execute(args, ctx) {
      const cmds = ctx.registry.list();
      let out = 'Available commands:\n\n';
      const cats = { fs: 'File System', sys: 'System', util: 'Utilities', proc: 'Process', ext: 'External' };
      let lastCat = '';
      for (const c of cmds) {
        if (c.category !== lastCat) {
          out += `\n${cats[c.category] || c.category}:\n`;
          lastCat = c.category;
        }
        out += `  ${c.name.padEnd(12)} ${c.description}\n`;
      }
      return out;
    }
  },

  {
    name: 'history', description: 'Command history', usage: 'history', category: 'util',
    execute(args, ctx) {
      const hist = ctx.getHistory ? ctx.getHistory() : [];
      if (hist.length === 0) return '(no history)';
      return hist.map((line, i) => `  ${String(i+1).padStart(4)}  ${line}`).join('\n');
    }
  },

  {
    name: 'which', description: 'Locate a command', usage: 'which <command>', category: 'util',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: which <command>', exitCode: 1 };
      const name = args[0];
      if (ctx.registry.has(name)) return `/usr/bin/${name}`;
      return { stderr: `${name} not found`, exitCode: 1 };
    }
  },

  {
    name: 'env', description: 'Print environment variables', usage: 'env', category: 'util',
    execute(args, ctx) {
      const vars = ctx.env.getAll();
      return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n');
    }
  },

  {
    name: 'type', description: 'Describe command type', usage: 'type <command>', category: 'util',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: type <command>', exitCode: 1 };
      const name = args[0];
      if (ctx.registry.has(name)) return `${name} is a shell builtin`;
      return { stderr: `type: ${name}: not found`, exitCode: 1 };
    }
  },
];
