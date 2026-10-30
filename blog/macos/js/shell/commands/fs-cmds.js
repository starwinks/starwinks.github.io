// === js/shell/commands/fs-cmds.js — File System Commands ===
// ls, cd, pwd, mkdir, touch, rm, cp, mv, cat, head, tail, wc

const FileSystemCommands = [
  {
    name: 'ls', description: 'List directory contents', usage: 'ls [-l] [-a] [path]', category: 'fs',
    execute(args, ctx) {
      const showLong = args.includes('-l');
      const showAll = args.includes('-a');
      const pathArg = args.find(a => !a.startsWith('-'));
      const path = pathArg ? ctx.fs.resolvePath(ctx.env.cwd, pathArg) : ctx.env.cwd;

      const entries = ctx.fs.list(path);
      const names = entries.map(e => e.name);

      if (entries.length === 0) return '(empty)';

      if (showLong) {
        const lines = [];
        for (const e of entries) {
          const isDir = e.type === 'folder';
          const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
          const size = isDir ? '128' : String(Math.floor(Math.random() * 5000 + 100));
          lines.push(`${perms}  1 ${ctx.env.get('USER')}  staff  ${size.padStart(6)} Jan 1 12:00 ${e.name}`);
        }
        return lines.join('\n');
      }

      if (showAll) return '.\n..\n' + names.join('\n');
      return names.join('  ');
    }
  },

  {
    name: 'cd', description: 'Change directory', usage: 'cd [path]', category: 'fs',
    execute(args, ctx) {
      const target = args[0] || ctx.env.get('HOME');
      const path = target === '-' ? ctx.env.oldpwd : ctx.fs.resolvePath(ctx.env.cwd, target);

      if (path === ctx.env.cwd) return '';
      if (!ctx.fs.exists(path)) return { stderr: `cd: ${target}: No such file or directory`, exitCode: 1 };
      if (!ctx.fs.isDir(path)) return { stderr: `cd: ${target}: Not a directory`, exitCode: 1 };

      ctx.env.cwd = path;
      return '';
    }
  },

  {
    name: 'pwd', description: 'Print working directory', usage: 'pwd', category: 'fs',
    execute(args, ctx) {
      return ctx.env.cwd;
    }
  },

  {
    name: 'mkdir', description: 'Create directory', usage: 'mkdir <path>', category: 'fs',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: mkdir <directory>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, args[0]);
      const ok = ctx.fs.mkdir(path);
      if (!ok) return { stderr: `mkdir: ${args[0]}: Cannot create directory`, exitCode: 1 };
      return { stdout: `Created: ${path}`, exitCode: 0 };
    }
  },

  {
    name: 'touch', description: 'Create empty file', usage: 'touch <file>', category: 'fs',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: touch <file>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, args[0]);
      const ok = ctx.fs.touch(path);
      if (!ok) return { stderr: `touch: ${args[0]}: Cannot create`, exitCode: 1 };
      return { stdout: `Created: ${path}`, exitCode: 0 };
    }
  },

  {
    name: 'rm', description: 'Remove file or directory', usage: 'rm [-r] <path>', category: 'fs',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: rm <file>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, args[args.length-1]);
      const ok = ctx.fs.remove(path);
      if (!ok) return { stderr: `rm: ${args[args.length-1]}: No such file or directory`, exitCode: 1 };
      return { stdout: `Removed: ${path}`, exitCode: 0 };
    }
  },

  {
    name: 'cp', description: 'Copy file', usage: 'cp <source> <dest>', category: 'fs',
    execute(args, ctx) {
      if (args.length < 2) return { stderr: 'usage: cp <source> <dest>', exitCode: 1 };
      const src = ctx.fs.resolvePath(ctx.env.cwd, args[0]);
      const dst = ctx.fs.resolvePath(ctx.env.cwd, args[1]);
      const content = ctx.fs.read(src);
      if (content === null) return { stderr: `cp: ${args[0]}: No such file`, exitCode: 1 };
      ctx.fs.write(dst, content);
      return { stdout: `${args[0]} → ${args[1]}`, exitCode: 0 };
    }
  },

  {
    name: 'mv', description: 'Move/rename file', usage: 'mv <source> <dest>', category: 'fs',
    execute(args, ctx) {
      if (args.length < 2) return { stderr: 'usage: mv <source> <dest>', exitCode: 1 };
      const src = ctx.fs.resolvePath(ctx.env.cwd, args[0]);
      const dst = ctx.fs.resolvePath(ctx.env.cwd, args[1]);
      const content = ctx.fs.read(src);
      if (content === null) return { stderr: `mv: ${args[0]}: No such file`, exitCode: 1 };
      ctx.fs.write(dst, content);
      ctx.fs.remove(src);
      return { stdout: `${args[0]} → ${args[1]}`, exitCode: 0 };
    }
  },

  {
    name: 'cat', description: 'Concatenate and print files', usage: 'cat [-n] <file>', category: 'fs',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: cat <file>', exitCode: 1 };
      const showNum = args.includes('-n');
      const path = ctx.fs.resolvePath(ctx.env.cwd, args[args.length-1]);
      const content = ctx.fs.read(path);
      if (content === null) return { stderr: `cat: ${args[args.length-1]}: No such file or directory`, exitCode: 1 };
      if (!content) return '';
      if (showNum) {
        const lines = content.split('\n');
        return lines.map((l, i) => `${String(i+1).padStart(4)}  ${l}`).join('\n');
      }
      return content;
    }
  },

  {
    name: 'head', description: 'Output first part of file', usage: 'head [-n N] <file>', category: 'fs',
    execute(args, ctx) {
      const nIdx = args.indexOf('-n');
      const n = nIdx !== -1 ? parseInt(args[nIdx+1]) || 10 : 10;
      const fileArg = args.filter(a => !a.startsWith('-') && a !== String(n) && a !== args[nIdx+1]).pop();
      if (!fileArg) return { stderr: 'usage: head <file>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, fileArg);
      const content = ctx.fs.read(path);
      if (content === null) return { stderr: `head: ${fileArg}: No such file`, exitCode: 1 };
      return content.split('\n').slice(0, n).join('\n');
    }
  },

  {
    name: 'tail', description: 'Output last part of file', usage: 'tail [-n N] <file>', category: 'fs',
    execute(args, ctx) {
      const nIdx = args.indexOf('-n');
      const n = nIdx !== -1 ? parseInt(args[nIdx+1]) || 10 : 10;
      const fileArg = args.filter(a => !a.startsWith('-') && a !== String(n) && a !== args[nIdx+1]).pop();
      if (!fileArg) return { stderr: 'usage: tail <file>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, fileArg);
      const content = ctx.fs.read(path);
      if (content === null) return { stderr: `tail: ${fileArg}: No such file`, exitCode: 1 };
      return content.split('\n').slice(-n).join('\n');
    }
  },

  {
    name: 'wc', description: 'Word/line/char count', usage: 'wc [-l] [-w] [-c] <file>', category: 'fs',
    execute(args, ctx) {
      const fileArg = args.find(a => !a.startsWith('-'));
      if (!fileArg) return { stderr: 'usage: wc <file>', exitCode: 1 };
      const path = ctx.fs.resolvePath(ctx.env.cwd, fileArg);
      const content = ctx.fs.read(path);
      if (content === null) return { stderr: `wc: ${fileArg}: No such file`, exitCode: 1 };
      const lines = content ? content.split('\n').length : 0;
      const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
      const chars = content ? content.length : 0;
      const showLines = args.includes('-l') || args.length === 1;
      const showWords = args.includes('-w') || args.length === 1;
      const showChars = args.includes('-c') || args.length === 1;
      const parts = [];
      if (showLines) parts.push(String(lines));
      if (showWords) parts.push(String(words));
      if (showChars) parts.push(String(chars));
      return `${parts.join('  ')} ${fileArg}`;
    }
  },
];
