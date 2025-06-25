# ChatGPT Local Exporter

A Chrome extension that adds export functionality to ChatGPT conversations, allowing you to download individual chats as Markdown files with selective message filtering.

## Features

- **Smart Selection**: Choose which messages to export with numbered checkboxes
- **Role-Based Controls**: Separate selection for User and ChatGPT messages
- **Enhanced Markdown**: Preserves formatting, links, code blocks, and structure
- **Navigation Tools**: Up/down arrows to jump between messages
- **Clean UI**: Non-intrusive overlay that doesn't disrupt ChatGPT's layout
- **100% Client-Side**: No data leaves your machine

## Installation

1. **Download the extension files** to a local folder (e.g., `~/ChatGPTLocalExporter/`)
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select your extension folder
5. **Navigate to chatgpt.com** and open any conversation

## Usage

1. **Open any ChatGPT conversation** at https://chatgpt.com
2. **Click "Select"** - numbered checkboxes appear in the left margin
3. **Choose messages** to export:
   - Individual checkboxes for specific messages
   - Use (all | none) links for User or ChatGPT messages
   - Navigate with ↑/↓ arrows between messages
4. **Click "Export MD"** - Markdown file downloads to your Downloads folder
5. **Click "Cancel"** to hide checkboxes and return to normal view

## Privacy

Everything runs 100% client-side; no data is sent to external servers or leaves your machine.
