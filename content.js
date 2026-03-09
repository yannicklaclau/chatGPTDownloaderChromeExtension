// File: content.js (v0.3 - ChatGPT + Claude + Grok + Gemini)
(function () {
  const EXPORTER_ID = "__gpt_local_exporter";

  function byDomOrder(a, b) {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function pickFirst(root, selectors) {
    for (const selector of selectors) {
      const match = root.querySelector(selector);
      if (match) return match;
    }
    return null;
  }

  function cloneWithout(root, selectors) {
    const clone = root.cloneNode(true);
    selectors.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    });
    return clone;
  }

  function textContent(el) {
    return (el ? el.textContent || el.innerText || "" : "").replace(/\s+/g, " ").trim();
  }

  function pickFirstText(root, selectors, predicate = null) {
    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      for (const node of nodes) {
        const value = textContent(node);
        if (!value) continue;
        if (!predicate || predicate(value, node)) return value;
      }
    }
    return "";
  }

  function shortenTitle(value, maxLength = 80) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length <= maxLength
      ? normalized
      : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }

  const PLATFORMS = {
    chatgpt: {
      matches: (host) => host === "chatgpt.com" || host === "chat.openai.com",
      inputSelector:
        'textarea[data-testid="composer-text-input"], form textarea, textarea',
      readySelector: "main, form, textarea",
      assistantName: "CHATGPT",
      filePrefix: "ChatGPT",
      titleFn: () => {
        const h1 =
          document.querySelector('h1[data-testid="conversation-title"]') ||
          document.querySelector("h1") ||
          document.querySelector('[data-testid*="title"]');
        return (
          (h1 ? h1.textContent.trim() : document.title.replace(" – ChatGPT", "")) ||
          "ChatGPT Conversation"
        );
      },
      getTurns: () => [...document.querySelectorAll("div[data-message-author-role]")],
      getRole: (el) => el.getAttribute("data-message-author-role") || "message",
      extractHTML: (el) => {
        const textEl =
          el.querySelector(".markdown, .whitespace-pre-wrap, .prose, div[class*='markdown']") ||
          el;
        return textEl ? textEl.innerHTML : "(no text)";
      },
    },
    claude: {
      matches: (host) => host === "claude.ai",
      inputSelector: '[data-testid="chat-input"], [data-testid="chat-input-ssr"]',
      readySelector: "main, [data-testid='chat-input'], [data-testid='chat-input-ssr']",
      assistantName: "CLAUDE",
      filePrefix: "Claude",
      titleFn: () => {
        const btn = document.querySelector('[data-testid="chat-title-button"]');
        return (
          (btn ? btn.innerText.trim() : document.title.replace(" - Claude", "")) ||
          "Claude Conversation"
        );
      },
      getTurns: () =>
        [...document.querySelectorAll("[data-test-render-count]")].filter(
          (el) =>
            el.querySelector('[data-testid="user-message"]') ||
            el.querySelector(".font-claude-response")
        ),
      getRole: (el) =>
        el.querySelector('[data-testid="user-message"]') ? "user" : "assistant",
      extractHTML: (el) => {
        const isUser = !!el.querySelector('[data-testid="user-message"]');

        if (isUser) {
          const userMsg = el.querySelector('[data-testid="user-message"]');
          return userMsg ? userMsg.innerHTML : "(no text)";
        }

        const responseContainer = el.querySelector(".font-claude-response");
        if (!responseContainer) return "(no text)";

        const markdowns = responseContainer.querySelectorAll(".standard-markdown");
        if (!markdowns.length) return responseContainer.innerHTML;

        const lastMd = markdowns[markdowns.length - 1];
        return lastMd.innerHTML;
      },
    },
    grok: {
      matches: (host) => host === "grok.com",
      inputSelector:
        '.ProseMirror[contenteditable="true"], [contenteditable="true"][data-placeholder], [contenteditable="true"]',
      readySelector: 'main, .ProseMirror, [aria-label="Submit"]',
      assistantName: "GROK",
      filePrefix: "Grok",
      titleFn: () =>
        document.title.replace(/\s*-\s*Grok$/, "").trim() || "Grok Conversation",
      getTurns: () =>
        [...document.querySelectorAll('main [id^="response-"]')]
          .filter((el) => el.querySelector(".message-bubble"))
          .sort(byDomOrder),
      getRole: (el) => (el.className.includes("items-end") ? "user" : "assistant"),
      extractHTML: (el) => {
        const bubble = el.querySelector(".message-bubble");
        if (!bubble) return "(no text)";

        const cleaned = cloneWithout(bubble, [
          ".thinking-container",
          "button",
          "svg",
          "[aria-hidden='true']",
        ]);

        return cleaned.innerHTML || cleaned.textContent || "(no text)";
      },
    },
    gemini: {
      matches: (host) => host === "gemini.google.com",
      inputSelector:
        'rich-textarea [role="textbox"], .ql-editor[role="textbox"][aria-label*="Gemini"], [aria-label="Enter a prompt for Gemini"]',
      readySelector: "chat-app, rich-textarea, .ql-editor[role='textbox']",
      assistantName: "GEMINI",
      filePrefix: "Gemini",
      titleFn: () => {
        const sidebarTitle = pickFirstText(
          document,
          [
            '[aria-current="page"]',
            '[aria-selected="true"]',
            '[data-test-id*="conversation"]',
            '[data-test-id*="title"]',
            '.conversation-title',
            '.conversation-item-title',
          ],
          (value) =>
            !/^google gemini$/i.test(value) &&
            !/^gemini$/i.test(value) &&
            !/^new chat$/i.test(value)
        );
        if (sidebarTitle) return shortenTitle(sidebarTitle);

        const firstUserPrompt = pickFirstText(document, [
          "user-query",
          ".user-query-text",
          ".user-prompt-chip",
          '[data-test-id="user-query"]',
        ]);
        if (firstUserPrompt) return shortenTitle(firstUserPrompt);

        const title = document.title
          .replace(/\s*-\s*Gemini$/, "")
          .replace(/^Google Gemini$/i, "")
          .trim();
        return title || "Gemini Conversation";
      },
      getTurns: () => {
        const explicitTurns = [
          ...document.querySelectorAll("user-query, model-response"),
        ].sort(byDomOrder);
        if (explicitTurns.length) return explicitTurns;

        return [...document.querySelectorAll("assistant-messages-primary")]
          .filter((el) => !el.closest("zero-state-block-picker, modular-zero-state"))
          .sort(byDomOrder);
      },
      getRole: (el) =>
        el.tagName.toLowerCase() === "user-query" ? "user" : "assistant",
      extractHTML: (el) => {
        const tag = el.tagName.toLowerCase();
        const cleaned = cloneWithout(el, [
          "button",
          "mat-icon",
          "user-profile-picture",
          "hallucination-disclaimer",
          "speech-dictation-mic-button",
          "toolbox-drawer",
          "bard-mode-switcher",
        ]);

        if (tag === "user-query") {
          const content = pickFirst(cleaned, [
            '[data-test-id="user-query"]',
            ".query-text",
            ".user-query-text",
            ".message-text",
            ".user-prompt-chip",
            "p",
          ]);
          return content ? content.innerHTML || content.textContent : cleaned.innerHTML;
        }

        const assistantContent = pickFirst(cleaned, [
          ".message-content",
          ".model-response-text",
          ".response-container",
          "generative-ui-response",
          '[data-test-id="message"]',
          ".message-text",
          ".markdown",
          "p",
        ]);

        return assistantContent
          ? assistantContent.innerHTML || assistantContent.textContent
          : cleaned.innerHTML || cleaned.textContent || "(no text)";
      },
    },
  };

  function detectPlatform() {
    const host = window.location.hostname;
    return (
      Object.entries(PLATFORMS).find(([, platform]) => platform.matches(host)) || []
    )[0];
  }

  const PLATFORM = detectPlatform();
  if (!PLATFORM) return;

  const SEL = PLATFORMS[PLATFORM];
  console.log(`Chat Exporter: Loaded on platform = ${PLATFORM}`);

  const waitForEl = (selector) =>
    new Promise((res) => {
      const found = document.querySelector(selector);
      if (found) return res(found);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) {
          obs.disconnect();
          res(n);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });

  function getMessageTurns() {
    return SEL.getTurns();
  }

  function hasMessages() {
    return getMessageTurns().length > 0;
  }

  function htmlToMarkdown(html) {
    html = html.replace(
      /<div[^>]*class="[^"]*relative[^"]*group\/copy[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*overflow-x-auto[^"]*"[^>]*><pre[^>]*>([\s\S]*?)<\/pre><\/div>[\s\S]*?<\/div>/gi,
      (_, code) => `\n\`\`\`\n${code.replace(/<[^>]*>/g, "").trim()}\n\`\`\`\n`
    );

    html = html.replace(
      /<pre[^>]*class="[^"]*code-block__code[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi,
      (_, code) => `\n\`\`\`\n${code.replace(/<[^>]*>/g, "").trim()}\n\`\`\`\n`
    );

    html = html.replace(
      /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      (_, code) => `\n\`\`\`\n${code.replace(/<[^>]*>/g, "").trim()}\n\`\`\`\n`
    );

    html = html.replace(
      /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
      (_, code) => `\n\`\`\`\n${code.replace(/<[^>]*>/g, "").trim()}\n\`\`\`\n`
    );

    html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

    html = html
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

    html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    html = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n")
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n")
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n");

    html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) =>
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n").replace(/<[^>]*>/g, "")
    );
    html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
      let counter = 1;
      return content
        .replace(
          /<li[^>]*>([\s\S]*?)<\/li>/gi,
          (_, item) => `${counter++}. ${item}\n`
        )
        .replace(/<[^>]*>/g, "");
    });

    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) =>
      `${content
        .replace(/<[^>]*>/g, "")
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n")}\n`
    );

    html = html.replace(/<hr[^>]*\/?>/gi, "\n---\n");

    html = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "");

    html = html.replace(/<[^>]+>/g, "");

    html = html
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    html = html.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

    return html;
  }

  async function injectToolbar() {
    if (document.getElementById(EXPORTER_ID)) return;
    if (!hasMessages()) return;

    const textInput = document.querySelector(SEL.inputSelector);
    if (!textInput) {
      console.log("Chat Exporter: Could not find text input");
      return;
    }

    const root = document.createElement("div");
    root.id = EXPORTER_ID;
    root.setAttribute("data-platform", PLATFORM);
    root.innerHTML = `
      <div class="gpt-main-controls">
        <button id="gptSelBtn" class="gpt-btn">Select</button>
        <button id="gptExpBtn" class="gpt-btn" style="display:none;">Export MD</button>
      </div>
      <div id="gptExpContainer" style="display:none;">
        <div id="gptRoleControls" class="role-controls"></div>
      </div>
    `;
    document.body.appendChild(root);

    const resizeController = new AbortController();
    const updateToolbarPosition = () => {
      if (PLATFORM !== "grok" && PLATFORM !== "gemini") return;

      const anchor = getMessageTurns()[0] || document.querySelector(SEL.inputSelector);
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const minLeft = 24;
      const maxLeft = Math.max(minLeft, window.innerWidth - root.offsetWidth - 24);
      const desiredLeft = Math.round(rect.left - 120);
      root.style.left = `${Math.min(maxLeft, Math.max(minLeft, desiredLeft))}px`;
    };
    updateToolbarPosition();
    window.addEventListener("resize", updateToolbarPosition, {
      signal: resizeController.signal,
    });
    root.cleanup = () => resizeController.abort();

    const selBtn = root.querySelector("#gptSelBtn");
    const expBtn = root.querySelector("#gptExpBtn");
    const expContainer = root.querySelector("#gptExpContainer");
    let selecting = false;

    selBtn.addEventListener("click", () => {
      selecting = !selecting;
      selBtn.textContent = selecting ? "Cancel" : "Select";
      if (selecting) {
        addCheckboxes();
        updateToolbarPosition();
        expBtn.style.display = "inline-block";
        expContainer.style.display = "block";
        updateRoleControls();
        setTimeout(() => {
          const first = getMessageTurns()[0];
          if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
        removeCheckboxes();
        expBtn.style.display = "none";
        expContainer.style.display = "none";
        setTimeout(
          () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
          100
        );
      }
    });

    expBtn.addEventListener("click", exportMarkdown);
  }

  function addCheckboxes() {
    const turns = getMessageTurns();
    turns.forEach((node, index) => {
      if (node.querySelector(".gpt-turn-wrapper")) return;

      const role = SEL.getRole(node);
      const roleIcon = role === "user" ? "👤" : role === "assistant" ? "🤖" : "?";
      const displayRole = role === "assistant" ? SEL.assistantName : role.toUpperCase();

      const wrapper = document.createElement("div");
      wrapper.className = "gpt-turn-wrapper";

      const cbx = document.createElement("input");
      cbx.type = "checkbox";
      cbx.className = "gpt-turn-cbx";
      cbx.checked = true;
      cbx.id = `gpt-cbx-${index}`;
      cbx.addEventListener("change", updateRoleControls);

      const label = document.createElement("label");
      label.htmlFor = `gpt-cbx-${index}`;
      label.className = "gpt-turn-number";
      label.innerHTML = `${roleIcon}<br>${index + 1}`;
      label.title = `${displayRole} message #${index + 1}`;

      const navContainer = document.createElement("div");
      navContainer.className = "gpt-nav-container";

      if (index > 0) {
        const upArrow = document.createElement("button");
        upArrow.className = "gpt-nav-arrow gpt-nav-up";
        upArrow.innerHTML = "↑";
        upArrow.title = "Jump to previous message";
        upArrow.addEventListener("click", (e) => {
          e.preventDefault();
          scrollToCheckbox(index - 1);
        });
        navContainer.appendChild(upArrow);
      }
      if (index < turns.length - 1) {
        const downArrow = document.createElement("button");
        downArrow.className = "gpt-nav-arrow gpt-nav-down";
        downArrow.innerHTML = "↓";
        downArrow.title = "Jump to next message";
        downArrow.addEventListener("click", (e) => {
          e.preventDefault();
          scrollToCheckbox(index + 1);
        });
        navContainer.appendChild(downArrow);
      }

      wrapper.appendChild(cbx);
      wrapper.appendChild(label);
      wrapper.appendChild(navContainer);

      node.style.position = "relative";
      node.style.paddingLeft = "100px";
      wrapper.style.position = "absolute";
      wrapper.style.top = "8px";
      wrapper.style.left = "-90px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.style.zIndex = "1000";

      node.appendChild(wrapper);
    });
  }

  function scrollToCheckbox(index) {
    const turns = getMessageTurns();
    const el = turns[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function removeCheckboxes() {
    document.querySelectorAll(".gpt-turn-wrapper").forEach((wrapper) => {
      const parent = wrapper.parentElement;
      if (parent) {
        parent.style.paddingLeft = "";
        parent.style.position = "";
      }
      wrapper.remove();
    });
  }

  function updateRoleControls() {
    const roleControls = document.querySelector("#gptRoleControls");
    if (!roleControls) return;

    const turns = getMessageTurns();
    let userCount = 0;
    let assistantCount = 0;
    let userSelected = 0;
    let assistantSelected = 0;

    turns.forEach((node, index) => {
      const role = SEL.getRole(node);
      const cbx = document.querySelector(`#gpt-cbx-${index}`);
      if (role === "user") {
        userCount++;
        if (cbx && cbx.checked) userSelected++;
      } else if (role === "assistant") {
        assistantCount++;
        if (cbx && cbx.checked) assistantSelected++;
      }
    });

    const assistantLabel =
      SEL.assistantName.charAt(0) + SEL.assistantName.slice(1).toLowerCase();

    roleControls.innerHTML = `
      <div class="role-summary">
        <span>User: ${userSelected}/${userCount}
          (<a href="#" class="role-link" data-role="user" data-action="all">all</a> |
           <a href="#" class="role-link" data-role="user" data-action="none">none</a>)
        </span>
        <span>${assistantLabel}: ${assistantSelected}/${assistantCount}
          (<a href="#" class="role-link" data-role="assistant" data-action="all">all</a> |
           <a href="#" class="role-link" data-role="assistant" data-action="none">none</a>)
        </span>
      </div>
    `;

    roleControls.querySelectorAll(".role-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const role = e.target.getAttribute("data-role");
        const action = e.target.getAttribute("data-action");
        selectRole(role, action === "all");
      });
    });
  }

  function selectRole(role, checked) {
    getMessageTurns().forEach((node, index) => {
      if (SEL.getRole(node) === role) {
        const cbx = document.querySelector(`#gpt-cbx-${index}`);
        if (cbx) cbx.checked = checked;
      }
    });
    updateRoleControls();
  }

  function exportMarkdown() {
    const turns = getMessageTurns();
    const selected = turns.filter((n, i) => {
      const wrapper = n.querySelector(".gpt-turn-wrapper");
      if (!wrapper) return true;
      const cbx = wrapper.querySelector("input.gpt-turn-cbx");
      return cbx && cbx.checked;
    });

    if (!selected.length) {
      alert("No turns selected - click Select first.");
      return;
    }

    const title = SEL.titleFn();
    const ts = new Date().toLocaleString();
    let md = `# ${title}\n\n_Exported: ${ts}_\n\n`;

    selected.forEach((el) => {
      const role = SEL.getRole(el);
      const roleLabel = role === "assistant" ? SEL.assistantName : role.toUpperCase();
      const bodyHTML = SEL.extractHTML(el);
      const body = htmlToMarkdown(bodyHTML || "(no text)");
      md += `## ${roleLabel}\n\n${body}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const fnameSafe = title.replace(/[^\w\d_-]+/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${SEL.filePrefix}-${fnameSafe}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  let currentUrl = window.location.href;
  let contentCheckInterval;

  function onNavigationChange() {
    const newUrl = window.location.href;
    if (newUrl === currentUrl) return;
    currentUrl = newUrl;

    const existing = document.getElementById(EXPORTER_ID);
    if (existing) {
      if (typeof existing.cleanup === "function") existing.cleanup();
      existing.remove();
    }
    if (contentCheckInterval) clearInterval(contentCheckInterval);

    setTimeout(tryInject, 300);
    setTimeout(tryInject, 800);
    setTimeout(tryInject, 1500);

    contentCheckInterval = setInterval(() => {
      if (hasMessages() && !document.getElementById(EXPORTER_ID)) {
        tryInject();
        clearInterval(contentCheckInterval);
      }
    }, 1000);

    setTimeout(() => {
      if (contentCheckInterval) {
        clearInterval(contentCheckInterval);
        contentCheckInterval = null;
      }
    }, 10000);
  }

  function tryInject() {
    waitForEl(SEL.readySelector)
      .then(() => injectToolbar())
      .catch(() => setTimeout(injectToolbar, 2000));
  }

  const navObserver = new MutationObserver(onNavigationChange);
  navObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", onNavigationChange);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInject);
  } else {
    tryInject();
  }
  setTimeout(tryInject, 1000);
})();
