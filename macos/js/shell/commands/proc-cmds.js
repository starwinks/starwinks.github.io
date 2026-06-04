// === js/shell/commands/proc-cmds.js — Process Commands ===
// kill, jobs, fg, bg, nice

const ProcessCommands = [
  {
    name: 'kill', description: 'Terminate a process', usage: 'kill [-9] <pid>', category: 'proc',
    execute(args, ctx) {
      if (args.length === 0) return { stderr: 'usage: kill <pid>', exitCode: 1 };
      const signal = args.includes('-9') ? 'KILL' : 'TERM';
      const pid = parseInt(args[args.length-1]);
      if (isNaN(pid)) return { stderr: `kill: ${args[args.length-1]}: invalid pid`, exitCode: 1 };
      if (!ctx.proc) return { stderr: 'kill: no process manager', exitCode: 1 };
      const ok = ctx.proc.kill(pid, signal);
      if (!ok) return { stderr: `kill: ${pid}: No such process`, exitCode: 1 };
      return `Process ${pid} terminated (${signal})`;
    }
  },

  {
    name: 'jobs', description: 'List background jobs', usage: 'jobs', category: 'proc',
    execute(args, ctx) {
      return '(no background jobs)';
    }
  },

  {
    name: 'fg', description: 'Bring job to foreground', usage: 'fg [job_id]', category: 'proc',
    execute(args, ctx) {
      return { stderr: 'fg: no job control in this shell', exitCode: 1 };
    }
  },

  {
    name: 'bg', description: 'Put job in background', usage: 'bg [job_id]', category: 'proc',
    execute(args, ctx) {
      return { stderr: 'bg: no job control in this shell', exitCode: 1 };
    }
  },

  {
    name: 'nice', description: 'Run with modified priority', usage: 'nice [-n N] <command>', category: 'proc',
    execute(args, ctx) {
      return { stderr: 'nice: priority modification is simulated', exitCode: 0 };
    }
  },
];
