/**
 * Apply Tab Shortcuts keybindings to Chromium browser profiles.
 *
 * Usage (browser must be fully quit first):
 *   node scripts/apply-shortcuts.mjs brave
 *   node scripts/apply-shortcuts.mjs chrome
 *
 * Firefox: shortcuts apply automatically on install/reload via commands.update()
 * in the background service worker (see shortcuts.json).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'shortcuts.json'), 'utf8'));

const BROWSER_PROFILES = {
  brave: path.join(
    process.env.HOME,
    'Library/Application Support/BraveSoftware/Brave-Browser/Default'
  ),
  chrome: path.join(
    process.env.HOME,
    'Library/Application Support/Google/Chrome/Default'
  ),
};

const OLD_EXTENSIONS = new Set([
  'lplcmnhgijkkmflbmhabnccgelffpnog', // Keyboard Shortcuts
  'fommpldicogfgegfpcoibmhkbbdpodjg', // New Adjacent Tab
]);

function findExtensionId(profileDir) {
  for (const file of ['Secure Preferences', 'Preferences']) {
    const fullPath = path.join(profileDir, file);
    if (!fs.existsSync(fullPath)) continue;

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const settings = data.extensions?.settings ?? {};

    for (const [id, setting] of Object.entries(settings)) {
      const extPath = setting.path ?? '';
      if (extPath.includes('tab-shortcuts')) {
        return id;
      }
    }
  }

  throw new Error(
    'Tab Shortcuts extension not found in profile. Load unpacked first, then rerun.'
  );
}

function applyBindings(profileDir, extensionId) {
  const updated = [];

  for (const file of ['Secure Preferences', 'Preferences']) {
    const fullPath = path.join(profileDir, file);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    const commands = data.extensions?.commands ?? {};

    for (const [key, commandName] of Object.entries(config.chromeKeys)) {
      const existing = commands[key];
      if (existing && OLD_EXTENSIONS.has(existing.extension)) {
        delete commands[key];
      }
    }

    for (const [commandName, key] of Object.entries(config.chromeKeys)) {
      commands[key] = {
        command_name: commandName,
        extension: extensionId,
        global: false,
      };
    }

    data.extensions ??= {};
    data.extensions.commands = commands;

    fs.writeFileSync(fullPath, JSON.stringify(data));
    updated.push(fullPath);
  }

  return updated;
}

const browser = process.argv.find((arg) => arg === 'brave' || arg === 'chrome') ?? 'brave';
const profileDir = BROWSER_PROFILES[browser];

if (!profileDir || !fs.existsSync(profileDir)) {
  console.error(`Unknown or missing profile: ${browser}`);
  process.exit(1);
}

const extensionId = findExtensionId(profileDir);
const files = applyBindings(profileDir, extensionId);

console.log(`Applied ${Object.keys(config.chromeKeys).length} shortcuts to ${browser}`);
console.log(`Extension ID: ${extensionId}`);
for (const file of files) {
  console.log(`Updated: ${file}`);
}
console.log('\nNext: open the browser, reload Tab Shortcuts, test ⌘, and ⌘.');
console.log('Firefox users: reload extension instead — shortcuts auto-apply.');
