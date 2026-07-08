/* ==========================================================================
   MahaAI Chat Widget — Mahashankh Design & Technology
   Talks to the Django backend at /api/chat/ and /api/quick-replies/
   ========================================================================== */

(function () {
  "use strict";

  // Change this if your Django backend runs on a different origin
  // e.g. "https://chatbot.mahashankh.com"
  const API_BASE = window.MAHA_API_BASE || "";

  const ICONS = {
    services: "👥",
    ai_solutions: "✨",
    internship: "🎓",
    contact: "📞",
  };
  const ICON_CLASS = {
    services: "maha-icon-services",
    ai_solutions: "maha-icon-ai",
    internship: "maha-icon-internship",
    contact: "maha-icon-contact",
  };

  let sessionId = localStorage.getItem("maha_session_id") || null;
  let isOpen = false;
  let hasGreeted = false;

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function nowLabel() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    const box = document.getElementById("maha-messages");
    box.scrollTop = box.scrollHeight;
  }

  function addMessage(role, text, options) {
    options = options || {};
    const box = document.getElementById("maha-messages");
    const row = el(`
      <div class="maha-row maha-${role === "user" ? "user" : "bot"}">
        <div class="maha-bubble-avatar">${role === "user" ? "🧑" : "🤖"}</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble"></div>
          <div class="maha-timestamp">${options.timestamp || nowLabel()}${role === "user" ? " ✔✔" : ""}</div>
        </div>
      </div>
    `);
    row.querySelector(".maha-bubble").textContent = text;
    box.appendChild(row);
    scrollToBottom();
    return row;
  }

  function showTyping() {
    const box = document.getElementById("maha-messages");
    const row = el(`
      <div class="maha-row maha-bot maha-typing" id="maha-typing-row">
        <div class="maha-bubble-avatar">🤖</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble">
            <div class="maha-typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `);
    box.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    const row = document.getElementById("maha-typing-row");
    if (row) row.remove();
  }

  async function loadQuickReplies() {
    const wrap = document.getElementById("maha-quick-replies");
    try {
      const res = await fetch(`${API_BASE}/api/quick-replies/`);
      const data = await res.json();
      wrap.innerHTML = "";
      (data.quick_replies || []).forEach((qr) => {
        const card = el(`
          <button type="button" class="maha-quick-card" data-prompt="${qr.prompt.replace(/"/g, "&quot;")}">
            <span class="maha-quick-icon ${ICON_CLASS[qr.key] || ""}">${ICONS[qr.key] || "💬"}</span>
            <span class="maha-quick-text">
              <strong>${qr.label}</strong>
              <span>${qr.sub}</span>
            </span>
          </button>
        `);
        card.addEventListener("click", () => {
          sendMessage(qr.prompt);
        });
        wrap.appendChild(card);
      });
    } catch (e) {
      wrap.innerHTML = "";
    }
  }

  async function sendMessage(text) {
    const input = document.getElementById("maha-input");
    const sendBtn = document.getElementById("maha-send");
    const trimmed = (text || input.value).trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    input.value = "";
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });
      const data = await res.json();
      hideTyping();

      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("maha_session_id", sessionId);
      }
      addMessage("bot", data.reply || "Sorry, I couldn't process that. Please try again.");
    } catch (err) {
      hideTyping();
      addMessage("bot", "Hmm, I couldn't reach the server. Please check your connection and try again.");
    } finally {
      sendBtn.disabled = false;
    }
  }

  function openWidget() {
    const widget = document.getElementById("maha-widget");
    widget.classList.add("maha-open");
    isOpen = true;
    document.getElementById("maha-launcher").querySelector(".maha-dot")?.remove();
    if (!hasGreeted) {
      hasGreeted = true;
      greetAndLoadQuickReplies();
    }
    setTimeout(() => document.getElementById("maha-input").focus(), 250);
  }

  function closeWidget() {
    document.getElementById("maha-widget").classList.remove("maha-open");
    isOpen = false;
  }

  function greetAndLoadQuickReplies() {
    addMessage("bot", "Hello \u{1F44B}\nI'm MahaAI, Mahashankh's AI assistant. How can I help you today?");
    loadQuickReplies();
  }

  async function clearChat() {
    const confirmBtn = document.getElementById("maha-confirm-delete");
    confirmBtn.disabled = true;
    try {
      if (sessionId) {
        await fetch(`${API_BASE}/api/chat/clear/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      }
    } catch (e) {
      // even if the server call fails, still clear the UI locally
    }
    sessionId = null;
    localStorage.removeItem("maha_session_id");
    document.getElementById("maha-messages").innerHTML = "";
    document.getElementById("maha-quick-replies").innerHTML = "";
    greetAndLoadQuickReplies();
    confirmBtn.disabled = false;
    document.getElementById("maha-delete-confirm").classList.remove("maha-show");
  }

  function buildWidgetDOM() {
    const launcher = el(`
      <button id="maha-launcher" aria-label="Chat with MahaAI">
        <span class="maha-dot"></span>
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h10v2H7V9zm7 5H7v-2h7v2zm3-6H7V6h10v2z"/></svg>
      </button>
    `);

    const widget = el(`
      <div id="maha-widget">
        <div class="maha-header">
          <div class="maha-avatar">🤖<span class="maha-status"></span></div>
          <div class="maha-header-info">
            <h5>MahaAI</h5>
            <small><span class="maha-online-dot"></span>AI Assistant &nbsp;•&nbsp; Online</small>
          </div>
          <div class="maha-header-actions">
            <button id="maha-delete" aria-label="Delete chat">
              <svg viewBox="0 0 24 24"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>
            </button>
            <button id="maha-close" aria-label="Close chat">✕</button>
          </div>
          <div id="maha-delete-confirm">
            <p>Delete this conversation? This can't be undone.</p>
            <div class="maha-confirm-actions">
              <button id="maha-cancel-delete" type="button">Cancel</button>
              <button id="maha-confirm-delete" type="button">Delete</button>
            </div>
          </div>
        </div>
        <div id="maha-messages"></div>
        <div id="maha-quick-replies"></div>
        <div id="maha-input-bar">
          <input id="maha-input" type="text" placeholder="Type your message..." autocomplete="off" />
          <button id="maha-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="maha-footer-brand">✨ Powered by <strong>Mahashankh AI</strong></div>
      </div>
    `);

    document.body.appendChild(widget);
    document.body.appendChild(launcher);

    launcher.addEventListener("click", () => (isOpen ? closeWidget() : openWidget()));
    document.getElementById("maha-close").addEventListener("click", closeWidget);
    document.getElementById("maha-send").addEventListener("click", () => sendMessage());
    document.getElementById("maha-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    document.getElementById("maha-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.toggle("maha-show");
    });
    document.getElementById("maha-cancel-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.remove("maha-show");
    });
    document.getElementById("maha-confirm-delete").addEventListener("click", clearChat);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidgetDOM);
  } else {
    buildWidgetDOM();
  }
})();

/* ==========================================================================
   MahaAI Chat Widget — Mahashankh Design & Technology
   Talks to the Django backend at /api/chat/ and /api/quick-replies/
   ========================================================================== */

(function () {
  "use strict";

  const API_BASE = window.MAHA_API_BASE || "";

  const ICONS = {
    services: "👥",
    ai_solutions: "✨",
    internship: "🎓",
    contact: "📞",
  };
  const ICON_CLASS = {
    services: "maha-icon-services",
    ai_solutions: "maha-icon-ai",
    internship: "maha-icon-internship",
    contact: "maha-icon-contact",
  };

  let sessionId = localStorage.getItem("maha_session_id") || null;
  let isOpen = false;
  let hasGreeted = false;

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function nowLabel() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    const box = document.getElementById("maha-messages");
    box.scrollTop = box.scrollHeight;
  }

  function addMessage(role, text, options) {
    options = options || {};
    const box = document.getElementById("maha-messages");
    const row = el(`
      <div class="maha-row maha-${role === "user" ? "user" : "bot"}">
        <div class="maha-bubble-avatar">${role === "user" ? "🧑" : "🤖"}</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble"></div>
          <div class="maha-timestamp">${options.timestamp || nowLabel()}${role === "user" ? " ✔✔" : ""}</div>
        </div>
      </div>
    `);
    row.querySelector(".maha-bubble").textContent = text;
    box.appendChild(row);
    scrollToBottom();
    return row;
  }

  function showTyping() {
    const box = document.getElementById("maha-messages");
    const row = el(`
      <div class="maha-row maha-bot maha-typing" id="maha-typing-row">
        <div class="maha-bubble-avatar">🤖</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble">
            <div class="maha-typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `);
    box.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    const row = document.getElementById("maha-typing-row");
    if (row) row.remove();
  }

  async function loadQuickReplies() {
    const wrap = document.getElementById("maha-quick-replies");
    try {
      const res = await fetch(`${API_BASE}/api/quick-replies/`);
      const data = await res.json();
      wrap.innerHTML = "";
      (data.quick_replies || []).forEach((qr) => {
        const card = el(`
          <button type="button" class="maha-quick-card" data-prompt="${qr.prompt.replace(/"/g, "&quot;")}">
            <span class="maha-quick-icon ${ICON_CLASS[qr.key] || ""}">${ICONS[qr.key] || "💬"}</span>
            <span class="maha-quick-text">
              <strong>${qr.label}</strong>
              <span>${qr.sub}</span>
            </span>
          </button>
        `);
        card.addEventListener("click", () => {
          sendMessage(qr.prompt);
        });
        wrap.appendChild(card);
      });
    } catch (e) {
      wrap.innerHTML = "";
    }
  }

  async function sendMessage(text) {
    const input = document.getElementById("maha-input");
    const sendBtn = document.getElementById("maha-send");
    const trimmed = (text || input.value).trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    input.value = "";
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });
      const data = await res.json();
      hideTyping();

      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("maha_session_id", sessionId);
      }
      addMessage("bot", data.reply || "Sorry, I couldn't process that. Please try again.");
    } catch (err) {
      hideTyping();
      addMessage("bot", "Hmm, I couldn't reach the server. Please check your connection and try again.");
    } finally {
      sendBtn.disabled = false;
    }
  }

  function openWidget() {
    const widget = document.getElementById("maha-widget");
    widget.classList.add("maha-open");
    isOpen = true;
    document.getElementById("maha-launcher").querySelector(".maha-dot")?.remove();
    if (!hasGreeted) {
      hasGreeted = true;
      greetAndLoadQuickReplies();
    }
    setTimeout(() => document.getElementById("maha-input").focus(), 250);
  }

  function closeWidget() {
    document.getElementById("maha-widget").classList.remove("maha-open");
    isOpen = false;
  }

  function greetAndLoadQuickReplies() {
    addMessage("bot", "Hello \u{1F44B}\nI'm MahaAI, Mahashankh's AI assistant. How can I help you today?");
    loadQuickReplies();
  }

  async function clearChat() {
    const confirmBtn = document.getElementById("maha-confirm-delete");
    confirmBtn.disabled = true;
    try {
      if (sessionId) {
        await fetch(`${API_BASE}/api/chat/clear/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      }
    } catch (e) {
      // even if the server call fails, still clear the UI locally
    }
    sessionId = null;
    localStorage.removeItem("maha_session_id");
    document.getElementById("maha-messages").innerHTML = "";
    document.getElementById("maha-quick-replies").innerHTML = "";
    greetAndLoadQuickReplies();
    confirmBtn.disabled = false;
    document.getElementById("maha-delete-confirm").classList.remove("maha-show");
  }

  function buildWidgetDOM() {
    const launcher = el(`
      <button id="maha-launcher" aria-label="Chat with MahaAI">
        <span class="maha-dot"></span>
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h10v2H7V9zm7 5H7v-2h7v2zm3-6H7V6h10v2z"/></svg>
      </button>
    `);

    const widget = el(`
      <div id="maha-widget">
        <div class="maha-header">
          <div class="maha-avatar">🤖<span class="maha-status"></span></div>
          <div class="maha-header-info">
            <h5>MahaAI</h5>
            <small><span class="maha-online-dot"></span>AI Assistant &nbsp;•&nbsp; Online</small>
          </div>
          <div class="maha-header-actions">
            <button id="maha-delete" aria-label="Delete chat">
              <svg viewBox="0 0 24 24"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>
            </button>
            <button id="maha-close" aria-label="Close chat">✕</button>
          </div>
          <div id="maha-delete-confirm">
            <p>Delete this conversation? This can't be undone.</p>
            <div class="maha-confirm-actions">
              <button id="maha-cancel-delete" type="button">Cancel</button>
              <button id="maha-confirm-delete" type="button">Delete</button>
            </div>
          </div>
        </div>
        <div id="maha-messages"></div>
        <div id="maha-quick-replies"></div>
        <div id="maha-input-bar">
          <input id="maha-input" type="text" placeholder="Type your message..." autocomplete="off" />
          <button id="maha-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="maha-footer-brand">✨ Powered by <strong>Mahashankh AI</strong></div>
      </div>
    `);

    document.body.appendChild(widget);
    document.body.appendChild(launcher);

    launcher.addEventListener("click", () => (isOpen ? closeWidget() : openWidget()));
    document.getElementById("maha-close").addEventListener("click", closeWidget);
    document.getElementById("maha-send").addEventListener("click", () => sendMessage());
    document.getElementById("maha-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    document.getElementById("maha-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.toggle("maha-show");
    });
    document.getElementById("maha-cancel-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.remove("maha-show");
    });
    document.getElementById("maha-confirm-delete").addEventListener("click", clearChat);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidgetDOM);
  } else {
    buildWidgetDOM();
  }
})();