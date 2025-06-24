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

  // Check if there are messages to export
  function hasMessages() {
    const messages = document.querySelectorAll(msgSelector);
    return messages.length > 0;
  }

  // Inject the floating toolbar positioned adjacent to the text input
  async function injectToolbar() {
    console.log("ChatGPT Exporter: Attempting to inject toolbar");

    if (document.getElementById(EXPORTER_ID)) {
      console.log("ChatGPT Exporter: Toolbar already exists");
      return; // already present
    }

    // Only show toolbar if there are messages to export
    if (!hasMessages()) {
      console.log("ChatGPT Exporter: No messages found, hiding toolbar");
      return;
    }

    // Find the text input area to position toolbar adjacent to it
    const textInput =
      document.querySelector('textarea[data-testid="composer-text-input"]') ||
      document.querySelector("form textarea") ||
      document.querySelector("textarea");

    if (!textInput) {
      console.log("ChatGPT Exporter: Could not find text input");
      return;
    }

    console.log("ChatGPT Exporter: Found text input, creating toolbar");

    const root = document.createElement("div");
    root.id = EXPORTER_ID;
    root.innerHTML = `
        <button id="gptSelBtn" class="gpt-btn">Select</button>
        <div id="gptExpContainer" style="display:none;">
          <button id="gptExpBtn" class="gpt-btn">Export MD</button>
          <div id="gptSelectionInfo" class="selection-info"></div>
          <div id="gptRoleControls" class="role-controls"></div>
        </div>
      `;

    // Position the toolbar relative to the text input
    textInput.parentElement.appendChild(root);
    console.log("ChatGPT Exporter: Toolbar injected");

    // handlers
    const selBtn = root.querySelector("#gptSelBtn");
    const expBtn = root.querySelector("#gptExpBtn");
    const expContainer = root.querySelector("#gptExpContainer");
    const selectionInfo = root.querySelector("#gptSelectionInfo");
    const roleControls = root.querySelector("#gptRoleControls");
    let selecting = false;

    selBtn.addEventListener("click", () => {
      console.log("ChatGPT Exporter: Select button clicked");
      selecting = !selecting;
      selBtn.textContent = selecting ? "Cancel" : "Select";

      if (selecting) {
        addCheckboxes();
        expContainer.style.display = "block";
        updateSelectionInfo();
        updateRoleControls();
      } else {
        removeCheckboxes();
        expContainer.style.display = "none";
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

      // Create a wrapper for checkbox and controls
      const wrapper = document.createElement("div");
      wrapper.className = "gpt-turn-wrapper";

      // Create checkbox
      const cbx = document.createElement("input");
      cbx.type = "checkbox";
      cbx.className = "gpt-turn-cbx";
      cbx.checked = true;
      cbx.id = `gpt-cbx-${index}`;
      cbx.addEventListener("change", updateSelectionInfo);

      // Create number label
      const label = document.createElement("label");
      label.htmlFor = `gpt-cbx-${index}`;
      label.className = "gpt-turn-number";
      label.textContent = (index + 1).toString();

      // Create navigation arrow (down to next checkbox)
      const navArrow = document.createElement("button");
      navArrow.className = "gpt-nav-arrow";
      navArrow.innerHTML = "↓";
      navArrow.title = "Jump to next message";
      if (index < messages.length - 1) {
        navArrow.addEventListener("click", (e) => {
          e.preventDefault();
          scrollToCheckbox(index + 1);
        });
      } else {
        navArrow.style.visibility = "hidden"; // Hide on last message
      }

      wrapper.appendChild(cbx);
      wrapper.appendChild(label);
      wrapper.appendChild(navArrow);

      // Position the wrapper
      node.style.position = "relative";
      node.style.paddingLeft = "80px"; // More room for navigation arrow

      wrapper.style.position = "absolute";
      wrapper.style.top = "10px";
      wrapper.style.left = "10px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.style.zIndex = "1000";

      node.prepend(wrapper);
    });
  }

  // Scroll to a specific checkbox
  function scrollToCheckbox(index) {
    const checkbox = document.querySelector(`#gpt-cbx-${index}`);
    if (checkbox) {
      checkbox.closest("[data-message-author-role]").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  // Update selection information
  function updateSelectionInfo() {
    const selectionInfo = document.querySelector("#gptSelectionInfo");
    if (!selectionInfo) return;

    const checkboxes = document.querySelectorAll(".gpt-turn-cbx");
    const checked = document.querySelectorAll(".gpt-turn-cbx:checked");

    selectionInfo.textContent = `${checked.length} of ${checkboxes.length} selected`;
  }

  // Update role-based controls
  function updateRoleControls() {
    const roleControls = document.querySelector("#gptRoleControls");
    if (!roleControls) return;

    const messages = document.querySelectorAll(msgSelector);
    let userCount = 0;
    let assistantCount = 0;
    let userSelected = 0;
    let assistantSelected = 0;

    messages.forEach((node, index) => {
      const role = node.getAttribute("data-message-author-role") || "unknown";
      const checkbox = document.querySelector(`#gpt-cbx-${index}`);

      if (role === "user") {
        userCount++;
        if (checkbox && checkbox.checked) userSelected++;
      } else if (role === "assistant") {
        assistantCount++;
        if (checkbox && checkbox.checked) assistantSelected++;
      }
    });

    roleControls.innerHTML = `
      <div class="role-summary">
        <span>User: ${userSelected}/${userCount}</span>
        <span>Assistant: ${assistantSelected}/${assistantCount}</span>
      </div>
      <div class="role-buttons">
        <button class="role-btn" onclick="toggleRole('user')">Toggle User</button>
        <button class="role-btn" onclick="toggleRole('assistant')">Toggle Assistant</button>
        <button class="role-btn" onclick="selectAll()">All</button>
        <button class="role-btn" onclick="selectNone()">None</button>
      </div>
    `;
  }

  // Toggle selection for a specific role
  window.toggleRole = function (role) {
    const messages = document.querySelectorAll(msgSelector);
    messages.forEach((node, index) => {
      const nodeRole = node.getAttribute("data-message-author-role");
      if (nodeRole === role) {
        const checkbox = document.querySelector(`#gpt-cbx-${index}`);
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
        }
      }
    });
    updateSelectionInfo();
    updateRoleControls();
  };

  // Select all messages
  window.selectAll = function () {
    document
      .querySelectorAll(".gpt-turn-cbx")
      .forEach((cbx) => (cbx.checked = true));
    updateSelectionInfo();
    updateRoleControls();
  };

  // Select no messages
  window.selectNone = function () {
    document
      .querySelectorAll(".gpt-turn-cbx")
      .forEach((cbx) => (cbx.checked = false));
    updateSelectionInfo();
    updateRoleControls();
  };

  function removeCheckboxes() {
    console.log("ChatGPT Exporter: Removing checkboxes");

    // Remove wrapper elements and reset padding
    document.querySelectorAll(".gpt-turn-wrapper").forEach((wrapper) => {
      const parent = wrapper.parentElement;
      if (parent) {
        parent.style.paddingLeft = ""; // Reset padding
        parent.style.position = ""; // Reset position
      }
      wrapper.remove();
    });
  }

  function htmlToMarkdown(html) {
    // Enhanced HTML to Markdown conversion
    let markdown = html
      // Preserve code blocks first (before other processing)
      .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
        return "\n```\n" + code.replace(/<[^>]*>/g, "").trim() + "\n```\n";
      })

      // Inline code
      .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")

      // Bold and italic
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")

      // Links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")

      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n")

      // Lists
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
        return content
          .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
          .replace(/<[^>]*>/g, "");
      })
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
        let counter = 1;
        return content
          .replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`)
          .replace(/<[^>]*>/g, "");
      })

      // Blockquotes
      .replace(
        /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
        (match, content) => {
          return (
            content
              .replace(/<[^>]*>/g, "")
              .split("\n")
              .map((line) => (line.trim() ? "> " + line : ">"))
              .join("\n") + "\n"
          );
        }
      )

      // Line breaks and paragraphs
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")

      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, "")

      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Max 2 consecutive newlines
      .replace(/^\s+|\s+$/g, "") // Trim start/end
      .trim();

    return markdown;
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
