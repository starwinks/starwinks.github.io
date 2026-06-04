// === js/shell/parser.js — Shell command parser ===
//
// Tokenizes a shell command line into command + args.
// Handles: double quotes, single quotes, backslash escapes.
//
// Phase 4 additions: pipe (|), redirect (>, >>, <, 2>), background (&)

const ShellParser = {
  /**
   * Parse an input string into a ParsedCommand
   * @returns {{ command: string, args: string[], raw: string }}
   */
  parse(input) {
    const raw = input.trim();
    if (!raw) return { command: '', args: [], raw: '' };

    const tokens = [];
    let i = 0;

    while (i < raw.length) {
      // Skip whitespace
      while (i < raw.length && /\s/.test(raw[i])) i++;
      if (i >= raw.length) break;

      let token = '';

      if (raw[i] === '"') {
        // Double-quoted string
        i++; // skip opening "
        while (i < raw.length && raw[i] !== '"') {
          if (raw[i] === '\\' && i + 1 < raw.length) {
            i++;
            if ('"\\$`'.includes(raw[i])) token += raw[i];
            else token += '\\' + raw[i];
          } else {
            token += raw[i];
          }
          i++;
        }
        if (i < raw.length) i++; // skip closing "
      } else if (raw[i] === "'") {
        // Single-quoted string (no escaping inside)
        i++; // skip opening '
        while (i < raw.length && raw[i] !== "'") {
          token += raw[i];
          i++;
        }
        if (i < raw.length) i++; // skip closing '
      } else {
        // Unquoted token
        while (i < raw.length && !/\s/.test(raw[i])) {
          if (raw[i] === '\\' && i + 1 < raw.length) {
            i++;
            token += raw[i];
          } else {
            token += raw[i];
          }
          i++;
        }
      }

      tokens.push(token);
    }

    return {
      command: tokens[0] || '',
      args: tokens.slice(1),
      raw,
    };
  },

  /** Quick parse — returns just { command, args } */
  quick(input) {
    return this.parse(input);
  },
};
