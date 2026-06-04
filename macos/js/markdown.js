// === js/markdown.js — Markdown export/import utilities ===

const MarkdownUtils = {
  /**
   * Download content as a .md file
   * @param {string} content  — Markdown text
   * @param {string} filename — e.g. "my-note"
   */
  downloadMd(content, filename = 'note') {
    const safeName = filename.replace(/[^a-zA-Z0-9_\-一-鿿]/g, '_');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Prompt user to select a .md/.txt file and read its content
   * @returns {Promise<{name:string, content:string}|null>}
   */
  async importMd() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt,.markdown,text/plain,text/markdown';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.addEventListener('change', async () => {
        const file = input.files[0];
        document.body.removeChild(input);
        if (!file) return resolve(null);

        const content = await file.text();
        resolve({ name: file.name.replace(/\.(md|txt|markdown)$/i, ''), content });
      });

      // Handle cancel
      input.addEventListener('cancel', () => {
        document.body.removeChild(input);
        resolve(null);
      });

      // Also handle if user navigates away (blur-based cancel)
      const cleanup = () => {
        setTimeout(() => {
          if (input.parentNode) {
            document.body.removeChild(input);
            resolve(null);
          }
        }, 500);
      };
      window.addEventListener('focus', cleanup, { once: true });

      input.click();
    });
  },

  /**
   * Convert note object to Markdown string
   */
  noteToMarkdown(note) {
    const lines = [`# ${note.title || 'Untitled'}`, '', note.body || ''];
    const date = note.updated_at || note.created_at;
    if (date) {
      lines.push('', '---', `*Last updated: ${new Date(date).toLocaleString()}*`);
      lines.push(`*Exported from macOS Browser Edition*`);
    }
    return lines.join('\n');
  },
};
