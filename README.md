# Chat Local Exporter

A Chrome extension that exports ChatGPT and Claude conversations to Markdown with selective message filtering.

## Features

- **Smart Selection**: Choose which messages to export with numbered checkboxes.
- **Role-Based Controls**: Separate selection for User and assistant messages.
- **Enhanced Markdown**: Preserves formatting, links, code blocks, and structure.
- **Navigation Tools**: Up/down arrows to jump between messages.
- **Platform-aware UI**: Green controls on ChatGPT, orange controls on Claude.
- **100% Client-Side**: No data leaves your machine.

## Installation

1. Download the extension files to a local folder.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer Mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Open a conversation on `chatgpt.com` or `claude.ai`.

## Usage

1. Click **Select** to show checkboxes for each conversation turn.
2. Choose turns to export:
   - Use individual checkboxes.
   - Use role links (`all` / `none`) for User and assistant.
   - Use up/down arrows to jump through the thread.
3. Click **Export MD** to download markdown.
4. Click **Cancel** to hide selection controls.

## Test Plan

Run this checklist after loading or reloading the extension.

### 1) ChatGPT smoke test

1. Open an existing thread on `chatgpt.com`.
2. Confirm toolbar visibility near the lower-left conversation area.
3. Click **Select** and confirm each turn has checkbox + number.
4. Click **Export MD** and confirm a file named `ChatGPT-<title>.md` downloads.
5. Confirm ordered lists, links, and fenced code blocks are preserved.

### 2) Claude smoke test

1. Open an existing thread on `claude.ai`.
2. Confirm the toolbar is orange and visible.
3. Click **Select** and confirm user/assistant turns are selectable.
4. Use role links (`all` / `none`) and confirm counts update correctly.
5. Click **Export MD** and confirm `Claude-<title>.md` downloads.

### 3) Claude multi-markdown edge case

1. Use a prompt that triggers web/tool usage and then a final answer.
2. Export the thread.
3. Confirm the assistant export contains the final answer content rather than intermediate tool blocks.

### 4) SPA navigation regression

1. In each platform, switch between two threads without full reload.
2. Confirm toolbar reappears and export still works in the new thread.

## Automated Tests (Playwright)

The repo includes Playwright smoke tests that use mocked `chatgpt.com` and `claude.ai` DOM pages.

1. Install dependencies:
   - `npm install`
2. Install browser binaries:
   - `npx playwright install chromium`
3. Run tests:
   - `npm run test:e2e`

## Privacy

Everything runs client-side; no data is sent to external servers.
