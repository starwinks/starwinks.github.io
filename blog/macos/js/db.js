// === js/db.js — sql.js backed persistence layer ===
//
// Uses sql.js (SQLite compiled to WASM) to run a full SQL database
// in the browser. The entire DB is serialized/deserialized to/from
// localStorage as base64 on each write.
//
// Apps access this via: window.parent.dbManager (same-origin iframes)

const DBManager = (() => {
  let db = null;
  let SQL = null;
  const LS_KEY = 'macos_sql_db';

  // ---- binary helpers ----
  function uint8ToBase64(arr) {
    let binary = '';
    const len = arr.length;
    for (let i = 0; i < len; i += 0x8000) {
      binary += String.fromCharCode.apply(null, arr.subarray(i, Math.min(i + 0x8000, len)));
    }
    return btoa(binary);
  }

  function base64ToUint8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---- public API ----
  return {
    get db() { return db; },

    /** Initialize sql.js and open/create the database */
    async init() {
      if (typeof initSqlJs === 'undefined') {
        throw new Error('sql.js not loaded. Include sql-wasm.js before this script.');
      }
      SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
      });

      // Try loading saved DB from localStorage
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        try {
          const arr = base64ToUint8(saved);
          db = new SQL.Database(arr);
        } catch (e) {
          console.warn('DB restore failed, creating fresh database', e);
          db = new SQL.Database();
        }
      } else {
        db = new SQL.Database();
      }

      this.createTables();
      this.seedFileSystem();
      this.seedSettings();
      console.log('DB ready. Tables created, data seeded.');
    },

    /** Persist DB to localStorage */
    persist() {
      if (!db) return;
      try {
        const data = db.export();
        const b64 = uint8ToBase64(data);
        localStorage.setItem(LS_KEY, b64);
      } catch (e) {
        console.error('Failed to persist DB', e);
      }
    },

    /** Create all required tables */
    createTables() {
      db.run(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Untitled',
          body TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS fs_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_path TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('file','folder')),
          content TEXT DEFAULT '',
          icon TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          UNIQUE(parent_path, name)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
      `);
      this.persist();
    },

    /** Seed initial filesystem entries */
    seedFileSystem() {
      const count = db.exec("SELECT COUNT(*) as c FROM fs_entries")[0]?.values[0][0] || 0;
      if (count > 0) return;

      const entries = [
        // Root level
        ['/', 'System', 'folder', '', '📂'],
        ['/', 'Library', 'folder', '', '📂'],
        ['/', 'Users', 'folder', '', '👥'],
        ['/', 'Applications', 'folder', '', '📦'],
        ['/', 'Volumes', 'folder', '', '💿'],
        ['/', 'tmp', 'folder', '', '📁'],
        ['/', 'etc', 'folder', '', '📁'],
        ['/', 'usr', 'folder', '', '📁'],
        ['/', 'bin', 'folder', '', '📁'],
        // /Users
        ['/Users', 'starwink', 'folder', '', '🏠'],
        // /Users/starwink
        ['/Users/starwink', 'Desktop', 'folder', '', '🖥'],
        ['/Users/starwink', 'Documents', 'folder', '', '📁'],
        ['/Users/starwink', 'Downloads', 'folder', '', '📥'],
        ['/Users/starwink', 'Pictures', 'folder', '', '🖼'],
        ['/Users/starwink', 'Music', 'folder', '', '🎵'],
        ['/Users/starwink', 'Movies', 'folder', '', '🎬'],
        // /Users/starwink/Desktop
        ['/Users/starwink/Desktop', 'project-notes.txt', 'file',
         'Project Alpha - Status: In Progress\nDeadline: 2026-06-15\nTeam: Starwink, Alice, Bob\n\nTODO:\n- [x] Design phase\n- [x] Implementation\n- [ ] Testing\n- [ ] Deployment', '📄'],
        ['/Users/starwink/Desktop', 'todo.md', 'file',
         '# TODO\n\n## Today\n- [ ] Review PR #42\n- [ ] Write unit tests\n- [ ] Update docs\n\n## This Week\n- [ ] Refactor auth module', '📝'],
        ['/Users/starwink/Desktop', 'screenshot.png', 'file', '[PNG Image — 1.2 MB]', '🖼'],
        // /Users/starwink/Documents
        ['/Users/starwink/Documents', 'resume.pdf', 'file', '[PDF — 245 KB]', '📑'],
        ['/Users/starwink/Documents', 'budget.xlsx', 'file', '[Excel file — 89 KB]', '📊'],
        ['/Users/starwink/Documents', 'Projects', 'folder', '', '📂'],
        // /Users/starwink/Downloads
        ['/Users/starwink/Downloads', 'chrome-mac.dmg', 'file', '[Disk Image — 198 MB]', '💿'],
        ['/Users/starwink/Downloads', 'cat-photo.jpg', 'file', '[JPEG — 3.4 MB]', '🖼'],
        // /Users/starwink/Pictures
        ['/Users/starwink/Pictures', 'Vacation 2025', 'folder', '', '📂'],
        ['/Users/starwink/Pictures', 'profile.jpg', 'file', '[JPEG — 1.8 MB]', '🖼'],
        ['/Users/starwink/Pictures', 'wallpaper.png', 'file', '[PNG — 5.2 MB]', '🖼'],
        // /Users/starwink/Music
        ['/Users/starwink/Music', 'iTunes', 'folder', '', '📂'],
        ['/Users/starwink/Music', 'playlist.m3u', 'file', '#EXTM3U\nsong1.mp3\nsong2.mp3', '🎵'],
        // /Users/starwink/Movies
        ['/Users/starwink/Movies', 'screen-recording.mov', 'file', '[QuickTime — 450 MB]', '🎬'],
        // /Applications
        ['/Applications', 'Safari.app', 'folder', '', '🌐'],
        ['/Applications', 'Terminal.app', 'folder', '', '💻'],
        ['/Applications', 'Notes.app', 'folder', '', '📝'],
        ['/Applications', 'Calculator.app', 'folder', '', '🔢'],
        ['/Applications', 'TextEdit.app', 'folder', '', '📄'],
        ['/Applications', 'Settings.app', 'folder', '', '⚙️'],
        ['/Applications', 'Monitor.app', 'folder', '', '📊'],
        // /etc
        ['/etc', 'hosts', 'file',
         '127.0.0.1       localhost\n255.255.255.255 broadcasthost\n::1             localhost\n192.168.1.1     router', '📄'],
        ['/etc', 'shells', 'file', '/bin/bash\n/bin/zsh\n/bin/sh', '📄'],
      ];

      const stmt = db.prepare(
        'INSERT INTO fs_entries (parent_path, name, type, content, icon) VALUES (?, ?, ?, ?, ?)'
      );
      for (const e of entries) {
        stmt.run(e);
      }
      stmt.free();
      this.persist();
    },

    /** Seed default settings */
    seedSettings() {
      const count = db.exec("SELECT COUNT(*) as c FROM settings")[0]?.values[0][0] || 0;
      if (count > 0) return;

      const defaults = [
        ['appearance', 'dark'],
        ['accent_color', 'blue'],
        ['font_size', 'medium'],
        ['sound_volume', '70'],
        ['sound_effects', 'funk'],
        ['notifications_enabled', 'true'],
        ['wallpaper', 'default'],
        ['dock_position', 'bottom'],
        ['dock_auto_hide', 'false'],
        ['dock_magnification', 'false'],
      ];
      const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      for (const [k, v] of defaults) stmt.run([k, v]);
      stmt.free();
      this.persist();
    },

    // ===== Notes CRUD =====

    getNotes() {
      return db.exec(
        "SELECT id, title, body, created_at, updated_at FROM notes ORDER BY updated_at DESC"
      )[0]?.values.map(row => ({
        id: row[0], title: row[1], body: row[2], created_at: row[3], updated_at: row[4]
      })) || [];
    },

    getNote(id) {
      return db.exec("SELECT id, title, body, created_at, updated_at FROM notes WHERE id = ?", [id])[0]
        ?.values.map(row => ({
          id: row[0], title: row[1], body: row[2], created_at: row[3], updated_at: row[4]
        }))[0] || null;
    },

    createNote(title = 'New Note', body = '') {
      db.run("INSERT INTO notes (title, body) VALUES (?, ?)", [title, body]);
      const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      this.persist();
      return this.getNote(id);
    },

    updateNote(id, title, body) {
      db.run(
        "UPDATE notes SET title = ?, body = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        [title, body, id]
      );
      this.persist();
    },

    deleteNote(id) {
      db.run("DELETE FROM notes WHERE id = ?", [id]);
      this.persist();
    },

    exportNoteMarkdown(id) {
      const note = this.getNote(id);
      if (!note) return '';
      return `# ${note.title}\n\n${note.body}\n\n---\n*Exported from macOS Browser Edition on ${new Date().toLocaleString()}*`;
    },

    importNoteMarkdown(md) {
      const titleMatch = md.match(/^# (.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Imported Note';
      const body = md.replace(/^# .+\n\n?/, '').replace(/\n---\n\*Exported.*\*$/, '').trim();
      return this.createNote(title, body);
    },

    // ===== Filesystem =====

    listDir(parentPath) {
      return db.exec(
        "SELECT name, type, icon, content FROM fs_entries WHERE parent_path = ? ORDER BY type ASC, name ASC",
        [parentPath]
      )[0]?.values.map(row => ({
        name: row[0], type: row[1], icon: row[2], content: row[3]
      })) || [];
    },

    getFileEntry(parentPath, name) {
      return db.exec(
        "SELECT name, type, icon, content FROM fs_entries WHERE parent_path = ? AND name = ?",
        [parentPath, name]
      )[0]?.values.map(row => ({
        name: row[0], type: row[1], icon: row[2], content: row[3]
      }))[0] || null;
    },

    createFsEntry(parentPath, name, type, content = '', icon = '📄') {
      try {
        db.run("INSERT INTO fs_entries (parent_path, name, type, content, icon) VALUES (?, ?, ?, ?, ?)",
          [parentPath, name, type, content, icon || (type === 'folder' ? '📁' : '📄')]);
        this.persist();
        return true;
      } catch (e) { return false; }
    },

    deleteFsEntry(parentPath, name) {
      const fullPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
      db.run("DELETE FROM fs_entries WHERE parent_path = ? AND name = ?", [parentPath, name]);
      // Also delete children
      db.run("DELETE FROM fs_entries WHERE parent_path = ?", [fullPath]);
      // Cascade: delete grandchildren
      db.run("DELETE FROM fs_entries WHERE parent_path LIKE ?", [`${fullPath}/%`]);
      this.persist();
    },

    updateFsContent(parentPath, name, content) {
      db.run("UPDATE fs_entries SET content = ? WHERE parent_path = ? AND name = ?",
        [content, parentPath, name]);
      this.persist();
    },

    // ===== Settings =====

    getSetting(key) {
      const r = db.exec("SELECT value FROM settings WHERE key = ?", [key]);
      return r[0]?.values[0]?.[0] ?? null;
    },

    setSetting(key, value) {
      db.run(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [key, String(value)]
      );
      this.persist();
    },

    getAllSettings() {
      return db.exec("SELECT key, value, updated_at FROM settings ORDER BY key")[0]
        ?.values.map(row => ({ key: row[0], value: row[1], updated_at: row[2] })) || [];
    },

    getSettingsMap() {
      const map = {};
      const rows = this.getAllSettings();
      for (const r of rows) map[r.key] = r.value;
      return map;
    },

    // ===== Utility =====

    /** Run raw SQL query — returns array of row arrays */
    query(sql, params = []) {
      return db.exec(sql, params);
    },

    /** Execute a statement (INSERT/UPDATE/DELETE) */
    exec(sql, params = []) {
      db.run(sql, params);
      this.persist();
    },
  };
})();
