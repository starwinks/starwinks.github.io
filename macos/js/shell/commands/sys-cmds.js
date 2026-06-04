// === js/shell/commands/sys-cmds.js — System Commands ===
// ps, df, du, free, uptime, uname, whoami, hostname, neofetch

const SystemCommands = [
  {
    name: 'ps', description: 'List processes', usage: 'ps [aux]', category: 'sys',
    execute(args, ctx) {
      const procs = ctx.proc ? ctx.proc.list() : [];
      let out = '  PID TTY           TIME CMD\n';
      for (const p of procs) {
        out += `${String(p.pid).padStart(5)} ttys000    0:00.00 ${p.name}\n`;
      }
      return out.trimEnd();
    }
  },

  {
    name: 'df', description: 'Disk free space', usage: 'df [-h]', category: 'sys',
    execute(args, ctx) {
      return 'Filesystem    512-blocks      Used Available Capacity Mounted on\n' +
             '/dev/disk3s1   976490584 423145600 552344984    44%   /';
    }
  },

  {
    name: 'du', description: 'Disk usage', usage: 'du [-sh] [path]', category: 'sys',
    execute(args, ctx) {
      return '128K\t./Desktop\n2.4M\t./Documents\n856M\t./Downloads\n1.2G\t.';
    }
  },

  {
    name: 'free', description: 'Memory usage', usage: 'free [-h]', category: 'sys',
    execute(args, ctx) {
      return '              total        used        free      shared  buff/cache   available\n' +
             'Mem:           16Gi       6.2Gi       5.1Gi       1.2Gi       4.7Gi       8.8Gi\n' +
             'Swap:          4Gi          0B          4Gi';
    }
  },

  {
    name: 'uptime', description: 'System uptime', usage: 'uptime', category: 'sys',
    execute(args, ctx) {
      const h = Math.floor(Math.random() * 48 + 2), m = Math.floor(Math.random() * 60);
      return `up ${h}:${String(m).padStart(2,'0')}, 3 users, load averages: ${(Math.random()*2+0.5).toFixed(2)} ${(Math.random()+0.5).toFixed(2)} ${(Math.random()+0.3).toFixed(2)}`;
    }
  },

  {
    name: 'uname', description: 'System information', usage: 'uname [-a] [-s] [-r]', category: 'sys',
    execute(args, ctx) {
      if (args.includes('-a'))
        return 'Darwin MacBook-Pro 24.0.0 Darwin Kernel Version 24.0.0: Mon May 25 20:15:00 PDT 2026; root:xnu-11215.1.12~1/RELEASE_ARM64_T8112 arm64';
      if (args.includes('-s')) return 'Darwin';
      if (args.includes('-r')) return '24.0.0';
      return 'Darwin';
    }
  },

  {
    name: 'whoami', description: 'Current user', usage: 'whoami', category: 'sys',
    execute(args, ctx) {
      return ctx.env.get('USER');
    }
  },

  {
    name: 'hostname', description: 'System hostname', usage: 'hostname', category: 'sys',
    execute(args, ctx) {
      return ctx.env.get('HOSTNAME');
    }
  },

  {
    name: 'neofetch', description: 'System info (pretty)', usage: 'neofetch', category: 'sys',
    execute(args, ctx) {
      const user = ctx.env.get('USER');
      const host = ctx.env.get('HOSTNAME');
      return [
        `      #####     #####     ${user}@${host}`,
        `     #######   #######    --------------------`,
        `     ##  ###   ###  ##    OS: macOS 15.0 Sonoma`,
        `     ##   '## ##'   ##    Host: MacBook Pro (14-inch, 2026)`,
        `     ##    ##.##    ##    Kernel: Darwin 24.0.0`,
        `     ##     ###     ##    Shell: zsh 5.9`,
        `     ###    ###    ###    Resolution: 3024x1964 @ 120Hz`,
        `      ###   ###   ###     CPU: Apple M5 Pro (12 cores)`,
        `       #### ### ####      GPU: Apple M5 Pro (18-core)`,
        `         #########        Memory: 16 GB LPDDR5X`,
        `           '###'          Disk: 512 GB SSD`,
      ].join('\n');
    }
  },
];
