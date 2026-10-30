// === js/utils/dom.js — DOM utility helpers ===

const DOM = {
  el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === 'string') e.appendChild(document.createTextNode(child));
      else if (child) e.appendChild(child);
    }
    return e;
  },

  $(selector, parent = document) {
    return parent.querySelector(selector);
  },

  $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  },

  clear(el) { if (el) el.innerHTML = ''; },
};
