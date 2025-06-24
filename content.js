// ──────────────────────────────
// File: content.js
// ──────────────────────────────
(function () {
  console.log("ChatGPT Exporter: Content script loaded");

  const EXPORTER_ID = "__gpt_local_exporter";

  // Wait until the main chat area exists (SPA can race)
  const waitForEl = (sel) =>
    new Promise((res) => {
      console.log(`ChatGPT Exporter: Waiting for element: ${sel}`);
      const found = document.querySelector(sel);
      if (found) {
        console.log(`ChatGPT Exporter: Found element immediately: ${sel}`);
        return res(found);
      }
      const obs = new MutationObserver(() => {
        const n = document.querySelector(sel);
        if (n) {
          console.log(`ChatGPT Exporter: Found element via mutation: ${sel}`);
          obs.disconnect();
          res(n);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });

  // Inject the floating toolbar positioned outside the text area
  async function injectToolbar() {
    console.log("ChatGPT Exporter: Attempting to inject toolbar");

    if (document.getElementById(EXPORTER_ID)) {
      console.log("ChatGPT Exporter: Toolbar already exists");
      return; // already present
    }

    // Find the main conversation area to position the toolbar
    const mainContainer = document.querySelector("main") || document.body;

    if (!mainContainer) {
      console.log("ChatGPT Exporter: Could not find main container");
      return;
    }

    console.log("ChatGPT Exporter: Found main container, creating toolbar");

    const root = document.createElement("div");
    root.id = EXPORTER_ID;
    root.innerHTML = `
        <button id="gptSelBtn" class="gpt-btn">Select</button>
        <button id="gptExpBtn" class="gpt-btn" style="display:none;">Export MD</button>
      `;

    // Position the toolbar as a floating element
    mainContainer.appendChild(root);
    console.log("ChatGPT Exporter: Toolbar injected");

    // handlers
    const selBtn = root.querySelector("#gptSelBtn");
    const expBtn = root.querySelector("#gptExpBtn");
    let selecting = false;

    selBtn.addEventListener("click", () => {
      console.log("ChatGPT Exporter: Select button clicked");
      selecting = !selecting;
      selBtn.textContent = selecting ? "Cancel" : "Select";

      if (selecting) {
        addCheckboxes();
        expBtn.style.display = "inline-block"; // Show export button
      } else {
        removeCheckboxes();
        expBtn.style.display = "none"; // Hide export button
      }
    });

    expBtn.addEventListener("click", () => {
      console.log("ChatGPT Exporter: Export button clicked");
      exportMarkdown();
    });
  }

  // Helpers to find each message turn (adjust selector if OpenAI changes DOM)
  const msgSelector = "div[data-message-author-role]";
  // const msgSelector = 'div[data-testid="conversation-turn"]';

  function addCheckboxes() {
    console.log("ChatGPT Exporter: Adding checkboxes");
    const messages = document.querySelectorAll(msgSelector);
    console.log(`ChatGPT Exporter: Found ${messages.length} messages`);

    messages.forEach((node, index) => {
      if (node.querySelector(".gpt-turn-wrapper")) return; // Already has checkbox

      // Create a wrapper for checkbox and number
      const wrapper = document.createElement("div");
      wrapper.className = "gpt-turn-wrapper";

      // Create checkbox
      const cbx = document.createElement("input");
      cbx.type = "checkbox";
      cbx.className = "gpt-turn-cbx";
      cbx.checked = true;
      cbx.id = `gpt-cbx-${index}`;

      // Create number label
      const label = document.createElement("label");
      label.htmlFor = `gpt-cbx-${index}`;
      label.className = "gpt-turn-number";
      label.textContent = (index + 1).toString();

      wrapper.appendChild(cbx);
      wrapper.appendChild(label);

      // Position the wrapper
      node.style.position = "relative";
      node.style.paddingLeft = "60px"; // Make room for checkbox + number

      wrapper.style.position = "absolute";
      wrapper.style.top = "10px";
      wrapper.style.left = "10px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "8px";
      wrapper.style.zIndex = "1000";

      node.prepend(wrapper);
    });
  }

  function removeCheckboxes() {
    console.log("ChatGPT Exporter: Removing checkboxes");

    // Remove wrapper elements and reset padding
    document.querySelectorAll(".gpt-turn-wrapper").forEach((wrapper) => {
      const parent = wrapper.parentElement;
      if (parent) {
        parent.style.paddingLeft = ""; // Reset padding
      }
      wrapper.remove();
    });
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
    const h1 =
      document.querySelector('h1[data-testid="conversation-title"]') ||
      document.querySelector("h1") ||
      document.querySelector('[data-testid*="title"]');
    return (
      (h1 ? h1.textContent : document.title.replace(" – ChatGPT", "")) ||
      "ChatGPT Conversation"
    );
  }

  function exportMarkdown() {
    console.log("ChatGPT Exporter: Starting export");

    const selected = Array.from(document.querySelectorAll(msgSelector)).filter(
      (n) => {
        const wrapper = n.querySelector(".gpt-turn-wrapper");
        if (!wrapper) return true; // If no checkboxes, include all
        const cbx = wrapper.querySelector("input.gpt-turn-cbx");
        return cbx && cbx.checked;
      }
    );

    console.log(`ChatGPT Exporter: Found ${selected.length} selected messages`);

    if (!selected.length) {
      alert("No turns selected – click Select first.");
      return;
    }

    const title = getConversationTitle();
    const ts = new Date().toLocaleString();

    let md = `# ${title}\n\n_Exported: ${ts}_\n\n`;
    selected.forEach((el) => {
      const roleEl =
        el.querySelector('[data-testid="conversation-turn-author-role"]') ||
        el.querySelector("[data-message-author-role]");

      const role = roleEl
        ? roleEl.textContent.trim()
        : el.getAttribute("data-message-author-role") || "Message";

      const textEl =
        el.querySelector(".markdown, .whitespace-pre-wrap, .prose") ||
        el.querySelector('div[class*="markdown"]') ||
        el;

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

    console.log("ChatGPT Exporter: Export completed");
  }

  // Detect SPA navigation (URL changes without page reload)
  let currentUrl = window.location.href;

  function onNavigationChange() {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      console.log(
        "ChatGPT Exporter: Navigation detected",
        currentUrl,
        "→",
        newUrl
      );
      currentUrl = newUrl;

      // Remove existing toolbar and re-inject after navigation
      const existing = document.getElementById(EXPORTER_ID);
      if (existing) {
        existing.remove();
        console.log(
          "ChatGPT Exporter: Removed existing toolbar for re-injection"
        );
      }

      // Wait a bit for new content to load, then inject
      setTimeout(() => {
        tryInject();
      }, 500);
    }
  }

  // Try multiple strategies to inject the toolbar
  function tryInject() {
    console.log("ChatGPT Exporter: Trying injection strategies");

    // Strategy 1: Wait for main element
    waitForEl("main")
      .then(() => {
        console.log("ChatGPT Exporter: Main element found");
        return injectToolbar();
      })
      .catch((err) => {
        console.error("ChatGPT Exporter: Strategy 1 failed", err);

        // Strategy 2: Wait a bit and try again
        setTimeout(() => {
          console.log("ChatGPT Exporter: Trying delayed injection");
          injectToolbar();
        }, 2000);
      });
  }

  // -------------- boot ---------------
  console.log("ChatGPT Exporter: Starting boot process");

  // Set up SPA navigation detection
  const observer = new MutationObserver(() => {
    onNavigationChange();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen for popstate (back/forward buttons)
  window.addEventListener("popstate", onNavigationChange);

  // Try immediately if DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInject);
  } else {
    tryInject();
  }

  // Also try after a delay for initial load
  setTimeout(tryInject, 1000);
})();
