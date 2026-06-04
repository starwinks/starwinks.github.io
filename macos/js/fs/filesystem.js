// === js/fs/filesystem.js — Virtual File System API ===
//
// High-level FS API wrapping DBManager's fs_entries operations.
// Provides path resolution, ~ expansion, and relative path support.
//
// Usage:
//   const fs = FileSystem.create(DBManager);
//   fs.list('/Users/starwink')
//   fs.read('/Users/starwink/Desktop/todo.md')

const FileSystem = {
  /** @param {object} db — DBManager instance */
  create(db) {
    if (!db) throw new Error('FileSystem requires a DB instance');

    const api = {
      /** List entries in a directory */
      list(path) {
        const p = api.resolvePath(path, '');
        return db.listDir(p);
      },

      /** Get a single entry by path */
      getEntry(fullPath) {
        const parent = dirname(fullPath);
        const name = basename(fullPath);
        return db.getFileEntry(parent, name);
      },

      /** Read file contents as string */
      read(path) {
        const p = api.resolvePath(path, '');
        const parent = dirname(p);
        const name = basename(p);
        const entry = db.getFileEntry(parent, name);
        return entry ? entry.content : null;
      },

      /** Write content to a file (creates if not exists) */
      write(path, content) {
        const p = api.resolvePath(path, '');
        const parent = dirname(p);
        const name = basename(p);
        const existing = db.getFileEntry(parent, name);
        if (existing) {
          db.updateFsContent(parent, name, content);
        } else {
          return db.createFsEntry(parent, name, 'file', content, '📄');
        }
        return true;
      },

      /** Create a directory */
      mkdir(path) {
        const p = api.resolvePath(path, '');
        const parent = dirname(p);
        const name = basename(p);
        return db.createFsEntry(parent, name, 'folder', '', '📁');
      },

      /** Create an empty file */
      touch(path) {
        const p = api.resolvePath(path, '');
        const parent = dirname(p);
        const name = basename(p);
        const existing = db.getFileEntry(parent, name);
        if (existing) return true; // already exists — success
        return db.createFsEntry(parent, name, 'file', '', '📄');
      },

      /** Remove a file or empty directory */
      remove(path) {
        const p = api.resolvePath(path, '');
        const parent = dirname(p);
        const name = basename(p);
        if (!db.getFileEntry(parent, name)) return false;
        db.deleteFsEntry(parent, name);
        return true;
      },

      /** Check if a path exists */
      exists(path) {
        if (path === '/' || path === '') return true;
        const p = api.resolvePath(path, '');
        if (p === '/') return true;
        const parent = dirname(p);
        const name = basename(p);
        return db.getFileEntry(parent, name) !== null;
      },

      /** Check if path is a directory */
      isDir(path) {
        const entry = api.getEntry(path);
        return entry && entry.type === 'folder';
      },

      /**
       * Resolve a path that may be relative, contain ~, ., or ..
       * @param {string} base  — The base directory (from which relative paths resolve)
       * @param {string} relative — The path to resolve (may be absolute, relative, ~, etc.)
       * @returns {string} — Normalized absolute path
       */
      resolvePath(base, relative) {
        // Handle ~ expansion
        if (relative.startsWith('~')) {
          relative = '/Users/starwink' + relative.slice(1);
        }

        // Absolute path
        if (relative.startsWith('/')) {
          return normalize(relative);
        }

        // Relative path — combine with base
        const combined = base === '/' ? `/${relative}` : `${base}/${relative}`;
        return normalize(combined);
      },
    };

    return api;
  }
};

// ---- Path utilities ----

function dirname(p) {
  if (p === '/') return '/';
  const idx = p.lastIndexOf('/');
  return idx === 0 ? '/' : p.substring(0, idx);
}

function basename(p) {
  return p.split('/').pop();
}

function normalize(p) {
  const parts = p.split('/').filter(Boolean);
  const result = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') { result.pop(); continue; }
    result.push(part);
  }
  return '/' + result.join('/');
}
