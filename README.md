# Cursor Agents Output Navigator

A tiny userscript for [Cursor cloud agents](https://cursor.com/agents) that makes long conversations navigable: a side rail with one dot per agent output, hover previews, and a button that jumps to the top of the latest output.

![Rail with dots and hover preview](docs/screenshot-hover.png)

## Why

Cloud-agent conversations collapse your messages into sticky headers. When you scroll back up to find the top of an agent's output, you have to watch the sticky header change — and fast scrolling overshoots it every time. This script gives every output a stable, clickable landmark.

## Features

- **Timeline rail** on the right edge — one dot per agent output, positioned by scroll depth. Blue dot = what you're reading.
- **Click a dot** to smooth-scroll that output to the top of the view.
- **Hover a dot** for a preview card ("Output 3" + the first two lines of that output).
- **"↑ Latest" pill** jumps to the top of the most recent output.
- Follows Cursor's light/dark theme automatically (uses their own CSS variables).
- Keeps up as output streams in, and survives Cursor's client-side navigation.
- Hides itself on non-conversation pages.

## Install

### Safari

1. Install the free [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension from the App Store.
2. Safari → **Settings → Extensions** → enable **Userscripts**.
3. In the Userscripts popup, use **+ → New remote** and paste:

   ```
   https://raw.githubusercontent.com/elliottlawson/cursor-output-navigator/main/cursor-agents-output-nav.user.js
   ```

   Installing by URL means the extension can pick up future updates automatically. Alternatively, drop the `.user.js` file into the extension's scripts folder manually.
4. Reload cursor.com/agents.

### Chrome / Edge / Firefox

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the raw URL above — Tampermonkey detects `.user.js` files and offers to install.
3. Reload cursor.com/agents.

## Try it without a Cursor account

`demo/index.html` is a self-contained page that mimics the Cursor conversation DOM with fictional content. Open it in a browser, paste the script into the console (or install the userscript), and the rail, dots, and pill appear.

## How it works (and its one weakness)

The script anchors on Cursor's internal DOM:

- `[data-component=agent-main-content-scroll-container]` — the conversation scroll container
- `.human-message-card` inside a `.sticky` header — marks each turn
- `.portal-markdown-root` — the agent output text (used for hover previews)

These are undocumented. **If Cursor ships a UI update that renames them, the rail will silently disappear.** When that happens, please [open an issue](../../issues) — fixing it is usually a one-line selector change.

## Privacy

- Runs entirely in your browser. No network calls, no analytics, no data leaves the page.
- Only activates on `https://cursor.com/agents*`.
- The whole script is ~150 lines — read it before installing (you should do that with every userscript anyway).

## License

MIT — see [LICENSE](LICENSE).
