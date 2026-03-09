const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");

const CHATGPT_FIXTURE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mock Chat - ChatGPT</title>
  </head>
  <body>
    <main>
      <h1 data-testid="conversation-title">ChatGPT Export Smoke</h1>
      <div data-message-author-role="user">
        <div class="markdown">
          <p>Hello exporter</p>
        </div>
      </div>
      <div data-message-author-role="assistant">
        <div class="markdown">
          <p>Sure, here is a list:</p>
          <ol>
            <li>First</li>
            <li>Second</li>
          </ol>
          <pre><code>const sum = 1 + 2;</code></pre>
        </div>
      </div>
    </main>
    <form>
      <textarea data-testid="composer-text-input"></textarea>
    </form>
  </body>
</html>`;

const CLAUDE_FIXTURE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mock Claude Thread - Claude</title>
  </head>
  <body>
    <main></main>
    <button data-testid="chat-title-button">Claude Export Smoke</button>

    <div data-test-render-count="0">
      <hr />
    </div>

    <div data-test-render-count="1">
      <div data-testid="user-message">
        <p class="whitespace-pre-wrap">Can you summarize this?</p>
      </div>
    </div>

    <div data-test-render-count="2">
      <div class="font-claude-response">
        <div class="standard-markdown">
          <p>Intermediate tool output that should not be exported.</p>
        </div>
        <div class="standard-markdown">
          <p>Final answer: done.</p>
          <div class="relative group/copy">
            <div class="overflow-x-auto">
              <pre class="code-block__code">print(&quot;ok&quot;)</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div data-testid="chat-input"></div>
  </body>
</html>`;

const GROK_FIXTURE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Friendly greeting - Grok</title>
  </head>
  <body>
    <main>
      <div id="response-user-1" class="relative group flex flex-col justify-center w-full max-w-[var(--content-max-width)] pb-0.5 items-end">
        <div class="message-bubble relative rounded-3xl text-primary bg-surface-l1 border border-border-l1 max-w-[100%] px-4 rounded-br-lg">
          <div class="relative">
            <p class="break-words">Reply with exactly: hi</p>
          </div>
        </div>
      </div>

      <div id="response-assistant-1" class="relative group flex flex-col justify-center w-full max-w-[var(--content-max-width)] pb-0.5 items-start">
        <div class="message-bubble relative rounded-3xl text-primary min-h-7 prose break-words w-full max-w-none">
          <div class="relative">
            <div class="thinking-container mb-3">
              <button>Thought for 1s</button>
            </div>
            <div class="relative">
              <p>hi</p>
              <pre><code>console.log("done");</code></pre>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div class="composer-shell">
      <div class="ProseMirror" contenteditable="true">
        <p><br /></p>
      </div>
      <button aria-label="Submit">Submit</button>
    </div>
  </body>
</html>`;

const GEMINI_FIXTURE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google Gemini</title>
  </head>
  <body>
    <chat-app>
      <bard-sidenav-content>
        <button aria-current="page">Scanner App Financial Metrics</button>
      </bard-sidenav-content>
      <main>
        <chat-window>
          <chat-window-content>
            <user-query>
              <div class="user-query-text">
                <p>Plan a 2-day Zurich itinerary.</p>
              </div>
            </user-query>

            <model-response>
              <div class="response-container">
                <div class="message-content">
                  <p>Here is a simple plan:</p>
                  <ol>
                    <li>Old Town walk</li>
                    <li>Lake Zurich cruise</li>
                  </ol>
                  <pre><code>day1 = "Old Town"</code></pre>
                </div>
                <button aria-label="Good response">Like</button>
              </div>
            </model-response>
          </chat-window-content>

          <input-container>
            <input-area-v2>
              <rich-textarea>
                <div
                  class="ql-editor textarea new-input-ui"
                  contenteditable="true"
                  role="textbox"
                  aria-label="Enter a prompt for Gemini"
                >
                  <p><br /></p>
                </div>
                <div class="ql-clipboard" contenteditable="true" tabindex="-1"></div>
              </rich-textarea>
              <button aria-label="Send message">Send</button>
            </input-area-v2>
          </input-container>
        </chat-window>
      </main>
    </chat-app>
  </body>
</html>`;

async function mountExporter(page) {
  await page.addStyleTag({ path: path.join(ROOT, "style.css") });
  await page.addScriptTag({ path: path.join(ROOT, "content.js") });
}

async function saveDownload(download, outputDir) {
  const target = path.join(outputDir, download.suggestedFilename());
  await download.saveAs(target);
  return fs.readFile(target, "utf8");
}

test("exports ChatGPT mocked conversation to markdown", async ({ page }, testInfo) => {
  await page.route("https://chatgpt.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: CHATGPT_FIXTURE,
    });
  });

  await page.goto("https://chatgpt.com/c/mock-thread");
  await mountExporter(page);

  await expect(page.locator("#__gpt_local_exporter[data-platform='chatgpt']")).toBeVisible();
  await page.click("#gptSelBtn");
  await expect(page.locator(".gpt-turn-cbx")).toHaveCount(2);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#gptExpBtn"),
  ]);

  expect(download.suggestedFilename()).toMatch(/^ChatGPT-/);
  const markdown = await saveDownload(download, testInfo.outputDir);

  expect(markdown).toContain("# ChatGPT Export Smoke");
  expect(markdown).toContain("## USER");
  expect(markdown).toContain("## CHATGPT");
  expect(markdown).toContain("1. First");
  expect(markdown).toContain("2. Second");
  expect(markdown).toContain("const sum = 1 + 2;");
});

test("exports Claude mocked conversation and keeps final assistant markdown only", async ({ page }, testInfo) => {
  await page.route("https://claude.ai/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: CLAUDE_FIXTURE,
    });
  });

  await page.goto("https://claude.ai/chat/mock-thread");
  await mountExporter(page);

  await expect(page.locator("#__gpt_local_exporter[data-platform='claude']")).toBeVisible();
  await page.click("#gptSelBtn");
  await expect(page.locator(".gpt-turn-cbx")).toHaveCount(2);
  await expect(page.locator("#gptRoleControls")).toContainText("Claude:");

  await page.click('.role-link[data-role="assistant"][data-action="none"]');
  await expect(page.locator("#gpt-cbx-1")).not.toBeChecked();
  await page.click('.role-link[data-role="assistant"][data-action="all"]');
  await expect(page.locator("#gpt-cbx-1")).toBeChecked();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#gptExpBtn"),
  ]);

  expect(download.suggestedFilename()).toMatch(/^Claude-/);
  const markdown = await saveDownload(download, testInfo.outputDir);

  expect(markdown).toContain("# Claude Export Smoke");
  expect(markdown).toContain("## USER");
  expect(markdown).toContain("## CLAUDE");
  expect(markdown).toContain("Final answer: done.");
  expect(markdown).toContain('print("ok")');
  expect(markdown).not.toContain("Intermediate tool output that should not be exported.");
});

test("exports Grok mocked conversation and strips thinking blocks", async ({ page }, testInfo) => {
  await page.route("https://grok.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: GROK_FIXTURE,
    });
  });

  await page.goto("https://grok.com/c/mock-thread");
  await mountExporter(page);

  await expect(page.locator("#__gpt_local_exporter[data-platform='grok']")).toBeVisible();
  await page.click("#gptSelBtn");
  await expect(page.locator(".gpt-turn-cbx")).toHaveCount(2);
  await expect(page.locator("#gptRoleControls")).toContainText("Grok:");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#gptExpBtn"),
  ]);

  expect(download.suggestedFilename()).toMatch(/^Grok-/);
  const markdown = await saveDownload(download, testInfo.outputDir);

  expect(markdown).toContain("# Friendly greeting");
  expect(markdown).toContain("## USER");
  expect(markdown).toContain("## GROK");
  expect(markdown).toContain("Reply with exactly: hi");
  expect(markdown).toContain("console.log(\"done\");");
  expect(markdown).not.toContain("Thought for 1s");
});

test("exports Gemini mocked conversation using custom element selectors", async ({ page }, testInfo) => {
  await page.route("https://gemini.google.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: GEMINI_FIXTURE,
    });
  });

  await page.goto("https://gemini.google.com/app/mock-thread");
  await mountExporter(page);

  await expect(page.locator("#__gpt_local_exporter[data-platform='gemini']")).toBeVisible();
  await page.click("#gptSelBtn");
  await expect(page.locator(".gpt-turn-cbx")).toHaveCount(2);
  await expect(page.locator("#gptRoleControls")).toContainText("Gemini:");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#gptExpBtn"),
  ]);

  expect(download.suggestedFilename()).toMatch(/^Gemini-/);
  const markdown = await saveDownload(download, testInfo.outputDir);

  expect(markdown).toContain("# Scanner App Financial Metrics");
  expect(markdown).toContain("## USER");
  expect(markdown).toContain("## GEMINI");
  expect(markdown).toContain("Plan a 2-day Zurich itinerary.");
  expect(markdown).toContain("1. Old Town walk");
  expect(markdown).toContain("2. Lake Zurich cruise");
  expect(markdown).toContain('day1 = "Old Town"');
});
