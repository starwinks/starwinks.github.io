// === js/shell/shell.js — Shell Engine ===
//
// Assembles parser, registry, executor, environment into a working shell.
// This is the main entry point used by terminal.html.
//
// Flow:
//   1. parser.parse(input)
//   2. env.expandArgs(args)
//   3. executor.execute(parsed, ctx)
//   4. tty.write(stdout/stderr)

const Shell = {
  /**
   * @param {object} opts
   * @param {object} opts.fs        — FileSystem instance
   * @param {object} opts.proc      — ProcessManager instance
   * @param {object} opts.env       — ShellEnvironment instance
   * @param {object} opts.events    — EventBus instance
   * @param {object} opts.config    — system config (for hostname etc.)
   */
  create({ fs, proc, env, events, config } = {}) {
    const registry = CommandRegistry.create();
    const executor = CommandExecutor.create(registry);
    const history = [];
    let histIdx = -1;

    /** Build execution context for every command */
    function buildCtx(tty) {
      return {
        env,
        fs,
        proc,
        registry,
        tty,
        events,
        addHistory: (line) => history.push(line),
        getHistory: () => [...history],
      };
    }

    const api = {
      get registry() { return registry; },
      get env() { return env; },
      get history() { return [...history]; },

      /** Execute a single line of input */
      async execute(input, tty) {
        if (!input || !input.trim()) return { stdout: '', stderr: '', exitCode: 0 };

        history.push(input.trim());
        histIdx = history.length;

        const parsed = ShellParser.parse(input);
        const expandedArgs = env.expandArgs(parsed.args);
        parsed.args = expandedArgs;
        const ctx = buildCtx(tty);

        const result = await executor.execute(parsed, ctx);
        return result;
      },

      /** Register commands */
      registerCommand(cmd) { return registry.register(cmd); },
      registerCommands(cmds) { registry.registerAll(cmds); },

      /** Get path entry for a command name (for 'which') */
      which(name) {
        return registry.has(name) ? `/usr/bin/${name}` : null;
      },

      /** Navigate history */
      getHistoryAt(idx) {
        if (idx < 0 || idx >= history.length) return null;
        return history[idx];
      },

      histPrev(currentIdx) {
        if (currentIdx > 0) return { idx: currentIdx - 1, line: history[currentIdx - 1] };
        if (history.length > 0) return { idx: history.length - 1, line: history[history.length - 1] };
        return { idx: -1, line: '' };
      },

      histNext(currentIdx) {
        if (currentIdx < history.length - 1) return { idx: currentIdx + 1, line: history[currentIdx + 1] };
        return { idx: history.length, line: '' };
      },
    };

    return api;
  }
};

// ===== ExecutionContext type definition (for documentation) =====
// {
//   env:       ShellEnvironment  — env vars ($HOME, $PWD, etc.)
//   fs:        FileSystem        — file operations
//   proc:      ProcessManager    — process management
//   registry:  CommandRegistry   — command lookup (for help)
//   tty:       object            — { writeLine(text, cls), clear() }
//   events:    EventBus          — pub/sub
//   addHistory: (line) => void   — add to history
// }
