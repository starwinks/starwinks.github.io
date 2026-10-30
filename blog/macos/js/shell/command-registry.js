// === js/shell/command-registry.js — Command registration & lookup ===
//
// Central registry for all shell commands. Commands are registered with
// { name, description, usage, category, execute(args, ctx) }.
//
// Usage:
//   registry.register(cmd)
//   registry.registerAll([cmd1, cmd2, ...])
//   registry.get('ls')
//   registry.list()           // all commands
//   registry.list('fs')       // by category

const CommandRegistry = {
  create() {
    const commands = new Map();   // name → ICommand

    const api = {
      /** Register a single command */
      register(cmd) {
        if (!cmd.name || !cmd.execute) {
          console.error('[CommandRegistry] Invalid command:', cmd);
          return false;
        }
        commands.set(cmd.name, cmd);
        return true;
      },

      /** Register multiple commands at once */
      registerAll(cmdList) {
        for (const cmd of cmdList) api.register(cmd);
      },

      /** Look up a command by name */
      get(name) {
        return commands.get(name) || null;
      },

      /** Check if a command exists */
      has(name) {
        return commands.has(name);
      },

      /** List all commands, optionally filtered by category */
      list(category = null) {
        const result = [];
        for (const cmd of commands.values()) {
          if (!category || cmd.category === category) {
            result.push({ name: cmd.name, description: cmd.description, usage: cmd.usage, category: cmd.category });
          }
        }
        return result.sort((a, b) => a.name.localeCompare(b.name));
      },

      /** Get count of registered commands */
      count() {
        return commands.size;
      },

      /** Remove a command */
      unregister(name) {
        return commands.delete(name);
      },

      /** Clear all commands */
      clear() {
        commands.clear();
      },
    };

    return api;
  }
};
