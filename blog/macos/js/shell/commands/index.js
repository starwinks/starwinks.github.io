// === js/shell/commands/index.js — All built-in shell commands ===
//
// Collects all command modules into a single array for easy registration.
//
// Usage:
//   shell.registerCommands(AllCommands);

const AllCommands = [
  ...FileSystemCommands,
  ...SystemCommands,
  ...UtilityCommands,
  ...ProcessCommands,
  ...ExternalCommands,
];
