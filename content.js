// ──────────────────────────────
// File: content.js
// ──────────────────────────────
(function () {
  const EXPORTER_ID = "__gpt_local_exporter";

  // Wait until the main chat area exists (SPA can race)
  const waitForEl = (sel) =>
    new Promise((res) => {
      const found = document.querySelector(sel);
      if (found) return res(found);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(sel);
        if (n) {
          obs.disconnect();
          res(n);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });

  // Inject the floating toolbar
  async function injectToolbar() {
    if (document.getElementById(EXPORTER_ID)) return; // already present

    const root = document.createElement("div");
    root.id = EXPORTER_ID;
    root.innerHTML = `
        <button id="gptSelBtn" class="gpt-btn">Select</button>
        <button id="gptExpBtn" class="gpt-btn">Export MD</button>
      `;
    document.body.appendChild(root);

    // handlers
    const selBtn = root.querySelector("#gptSelBtn");
    const expBtn = root.querySelector("#gptExpBtn");
    let selecting = false;

    selBtn.addEventListener("click", () => {
      selecting = !selecting;
      selBtn.textContent = selecting ? "Cancel" : "Select";
      if (selecting) addCheckboxes();
      else removeCheckboxes();
    });

    expBtn.addEventListener("click", exportMarkdown);
  }

  // Helpers to find each message turn (adjust selector if OpenAI changes DOM)
  const msgSelector = 'div[data-testid="conversation-turn"]';

  function addCheckboxes() {
    document.querySelectorAll(msgSelector).forEach((node) => {
      if (node.querySelector("input.gpt-turn-cbx")) return;
      const cbx = document.createElement("input");
      cbx.type = "checkbox";
      cbx.className = "gpt-turn-cbx";
      cbx.checked = true;
      node.style.position = "relative";
      cbx.style.position = "absolute";
      cbx.style.top = "6px";
      cbx.style.left = "6px";
      node.prepend(cbx);
    });
  }

  function removeCheckboxes() {
    document.querySelectorAll("input.gpt-turn-cbx").forEach((c) => c.remove());
  }

  function htmlToMarkdown(html) {
    // super‑simple – converts <br> and removes other tags
    return html
      .replace(/<br\s*\/>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function getConversationTitle() {
    // Title appears in the sidebar & <title>
    const h1 = document.querySelector('h1[data-testid="conversation-title"]');
    return (
      (h1 ? h1.textContent : document.title.replace(" – ChatGPT", "")) ||
      "ChatGPT Conversation"
    );
  }

  function exportMarkdown() {
    const selected = Array.from(document.querySelectorAll(msgSelector)).filter(
      (n) => {
        const cbx = n.querySelector("input.gpt-turn-cbx");
        return !cbx || cbx.checked; // if checkboxes removed (select all), include all
      }
    );

    if (!selected.length) {
      alert("No turns selected – click Select first.");
      return;
    }

    const title = getConversationTitle();
    const ts = new Date().toLocaleString();

    let md = `# ${title}\n\n_Exported: ${ts}_\n\n`;
    selected.forEach((el) => {
      const roleEl = el.querySelector(
        '[data-testid="conversation-turn-author-role"]'
      );
      const role = roleEl ? roleEl.textContent.trim() : "Message";
      const textEl = el.querySelector(
        ".markdown, .whitespace-pre-wrap, .prose"
      );
      const body = textEl ? htmlToMarkdown(textEl.innerHTML) : "(no text)";
      md += `### ${role}\n\n${body}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    const fnameSafe = title.replace(/[^\w\d_-]+/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChatGPT-${fnameSafe}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // -------------- boot ---------------
  waitForEl("main") // wait for chat page root
    .then(() => injectToolbar())
    .catch(console.error);
})();
