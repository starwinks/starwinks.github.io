// === js/shell/commands/ext-cmds.js — External/toy commands ===
// python3, node, curl, ssh

const ExternalCommands = [
  {
    name: 'python3', description: 'Python 3 interpreter', usage: 'python3 [-c code]', category: 'ext',
    execute(args, ctx) {
      const code = args.join(' ');
      if (code.includes('print(')) {
        const m = code.match(/print\(["'](.+?)["']\)/);
        return m ? m[1] : '>>>';
      }
      if (args.includes('-c') && args.length > 1) {
        return '>>>';
      }
      return 'Python 3.12.4 (Jun 6 2025) [Clang 16.0.0] on darwin\nType "help", "copyright", "credits" or "license" for more information.\n>>>';
    }
  },

  {
    name: 'node', description: 'Node.js runtime', usage: 'node [-e code]', category: 'ext',
    execute(args, ctx) {
      return 'Welcome to Node.js v22.4.0.\nType ".help" for more information.\n>';
    }
  },

  {
    name: 'curl', description: 'Transfer data from/to servers', usage: 'curl <url>', category: 'ext',
    execute(args, ctx) {
      const url = args.find(a => !a.startsWith('-'));
      if (!url) return { stderr: 'curl: try "curl --help" for more information', exitCode: 1 };
      return '<html><body><h1>200 OK</h1><p>Simulated HTTP response</p></body></html>';
    }
  },

  {
    name: 'ssh', description: 'Secure shell client', usage: 'ssh [user@]host', category: 'ext',
    execute(args, ctx) {
      return { stderr: `ssh: connect to host ${args[0]||'localhost'} port 22: Connection refused`, exitCode: 255 };
    }
  },

  {
    name: 'ping', description: 'Send ICMP echo requests', usage: 'ping <host>', category: 'ext',
    execute(args, ctx) {
      if (!args[0]) return { stderr: 'usage: ping <host>', exitCode: 1 };
      let out = `PING ${args[0]} (127.0.0.1): 56 data bytes\n`;
      for (let i = 0; i < 3; i++) {
        out += `64 bytes from 127.0.0.1: icmp_seq=${i} ttl=64 time=${(Math.random()*10+1).toFixed(2)} ms\n`;
      }
      return out;
    }
  },
];
