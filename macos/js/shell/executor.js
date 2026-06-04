// === js/shell/executor.js — Command executor ===
//
// Takes a parsed command + execution context, looks up the command
// in the registry, and runs it. Returns a CommandResult.
//
// CommandResult: { stdout: string, stderr: string, exitCode: number }

const CommandExecutor = {
  /** @param {object} registry — CommandRegistry instance */
  create(registry) {
    const api = {
      /**
       * Execute a parsed command
       * @param {{ command: string, args: string[] }} parsed
       * @param {ExecutionContext} ctx
       * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
       */
      async execute(parsed, ctx) {
        const { command, args } = parsed;

        if (!command) {
          return { stdout: '', stderr: '', exitCode: 0 };
        }

        const cmd = registry.get(command);
        if (!cmd) {
          return {
            stdout: '',
            stderr: `zsh: command not found: ${command}`,
            exitCode: 127,
          };
        }

        try {
          const result = await cmd.execute(args, ctx);
          // Normalize result
          if (typeof result === 'string') {
            return { stdout: result, stderr: '', exitCode: 0 };
          }
          return {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            exitCode: result.exitCode ?? 0,
          };
        } catch (e) {
          console.error(`[Executor] Error executing "${command}":`, e);
          return {
            stdout: '',
            stderr: `${command}: ${e.message}`,
            exitCode: 1,
          };
        }
      },
    };

    return api;
  }
};
