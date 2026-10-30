// === js/services/notification-service.js — Toast Notification System ===

const NotificationService = {
  create() {
    let idCounter = 0;
    const items = [];

    function show(title, body, duration = 2500) {
      const id = ++idCounter;
      const el = document.createElement('div');
      el.className = 'notification';
      el.innerHTML = `<div class="notif-title">${title}</div><div class="notif-body">${body}</div>`;
      document.body.appendChild(el);

      const notif = { id, title, body, el };
      items.push(notif);

      setTimeout(() => {
        el.classList.add('hiding');
        el.addEventListener('animationend', () => {
          el.remove();
          const idx = items.findIndex(n => n.id === id);
          if (idx !== -1) items.splice(idx, 1);
        });
      }, duration);

      return id;
    }

    function list() { return items.map(n => ({ id: n.id, title: n.title, body: n.body })); }

    function dismiss(id) {
      const n = items.find(x => x.id === id);
      if (n) { n.el.remove(); const idx = items.indexOf(n); if (idx !== -1) items.splice(idx, 1); }
    }

    return { show, list, dismiss };
  }
};
