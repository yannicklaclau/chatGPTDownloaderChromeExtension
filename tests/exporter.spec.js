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
