// === js/process/process-manager.js — Simulated Process Management ===
//
// Maintains a list of simulated processes. System daemons are created on
// init. App processes are spawned/killed as windows open/close.
//
// Usage:
//   const pm = ProcessManager.create(eventBus);
//   pm.spawn('Finder', 100);  // spawn a user process
//   pm.list();                // get all processes

const ProcessManager = {
  /** @param {object} events — EventBus instance */
  create(events) {
    let nextPid = 100;
    const procs = [];

    const api = {
      /** Spawn a new process */
      spawn(name, pid = null, user = 'starwink', status = 'running') {
        const p = {
          pid: pid || nextPid++,
          name,
          user,
          cpu: (Math.random() * 5 + 0.1).toFixed(2),
          mem: Math.floor(Math.random() * 200 + 10),
          status,    // running | sleeping | stopped | zombie
          startTime: new Date(),
        };
        procs.push(p);
        if (events) events.emit('process:spawned', p);
        return p;
      },

      /** Kill a process by pid */
      kill(pid, signal = 'TERM') {
        const idx = procs.findIndex(p => p.pid === pid);
        if (idx === -1) return false;
        const p = procs[idx];
        procs.splice(idx, 1);
        if (events) events.emit('process:killed', { pid, signal, name: p.name });
        return true;
      },

      /** List all processes, optionally filtered by user */
      list(user = null) {
        const result = user ? procs.filter(p => p.user === user) : [...procs];
        return result.sort((a, b) => a.pid - b.pid);
      },

      /** Get a specific process */
      get(pid) {
        return procs.find(p => p.pid === pid) || null;
      },

      /** Update CPU/memory for all processes (call periodically) */
      tick() {
        for (const p of procs) {
          p.cpu = Math.max(0, Math.min(100, parseFloat(p.cpu) + (Math.random() - 0.5) * 2)).toFixed(2);
          p.mem = Math.floor(Math.max(5, p.mem + (Math.random() - 0.5) * 10));
        }
      },

      /** Seed system daemon processes */
      seedSystem() {
        if (procs.length > 0) return;
        api.spawn('kernel_task',  0,   'root', 'running');
        api.spawn('launchd',      1,   'root', 'running');
        api.spawn('WindowServer', 187, 'starwink', 'running');
        api.spawn('Dock',         201, 'starwink', 'running');
        api.spawn('SystemUIServer',203,'starwink', 'running');
        api.spawn('Spotlight',    234, 'starwink', 'running');
        api.spawn('NotificationCenter', 567, 'starwink', 'running');
        api.spawn('mdworker',     876, 'starwink', 'running');
        api.spawn('distnoted',    320, 'starwink', 'running');
        api.spawn('cfprefsd',     298, 'starwink', 'running');
        console.log('[ProcessManager] System daemons seeded');
      },

      /** Get count */
      count() { return procs.length; },

      /** Clear all processes */
      reset() { procs.length = 0; nextPid = 100; },
    };

    return api;
  }
};
