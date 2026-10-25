# Tab Shortcuts

Keyboard shortcuts for tab navigation, movement, and browser pages. One extension for Chromium and Firefox.

## Install

### Chrome / Brave / Edge

1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Apply key bindings (browser fully quit first):

```bash
node scripts/apply-shortcuts.mjs brave
# or: chrome
```

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate into the project folder and select **`manifest.json`** (the file, not the folder)
4. Shortcuts from `shortcuts.json` apply automatically on install/reload

Firefox disables MV3 service workers — the manifest uses `background.scripts` for Firefox and `background.service_worker` for Chromium (Chrome 121+ ignores the scripts entry).

Or use web-ext:

```bash
npx web-ext run --source-dir .
```

## Shortcuts

Edit `shortcuts.json` for your preferred keys. Chromium uses `chromeKeys` (applied via script). Firefox uses the same keys via `commands.update()` on install.

## Browser differences

| Feature | Chromium | Firefox |
|---------|----------|---------|
| Bookmarks | `chrome://bookmarks` | `about:library` |
| Settings | `chrome://settings` | `about:preferences` |
| Extensions | `chrome://extensions` | `about:addons` |
| Flags | `chrome://flags` | `about:config` |
| Discard tab | supported | not available |
| Shortcut setup | `apply-shortcuts.mjs` | automatic |
