// Tab Shortcuts — cross-browser background (Chromium SW + Firefox scripts)

function isFirefox() {
  const ua = navigator.userAgent;
  return /Firefox\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua);
}

function getChromiumScheme() {
  const ua = navigator.userAgent;
  if (/Brave\//.test(ua)) return 'brave';
  if (/Edg\//.test(ua)) return 'edge';
  return 'chrome';
}

const api = (() => {
  const raw = isFirefox() ? globalThis.browser : globalThis.chrome;
  return new Proxy(raw, {
    get(obj, prop) {
      const value = obj[prop];
      if (typeof value === 'function') return value.bind(obj);
      if (value && typeof value === 'object') return new Proxy(value, this);
      return value;
    },
  });
})();

function getBrowserPages() {
  if (isFirefox()) {
    return {
      bookmarks: 'about:library',
      downloads: 'about:downloads',
      extensions: 'about:addons',
      history: 'about:history',
      settings: 'about:preferences',
      flags: 'about:config',
      help: 'about:support',
      shortcuts: 'about:addons',
    };
  }
  const scheme = getChromiumScheme();
  return {
    bookmarks: `${scheme}://bookmarks`,
    downloads: `${scheme}://downloads`,
    extensions: `${scheme}://extensions`,
    history: `${scheme}://history`,
    settings: `${scheme}://settings`,
    flags: `${scheme}://flags`,
    help: `${scheme}://help`,
    shortcuts: `${scheme}://extensions/shortcuts`,
  };
}

async function openPage(page) {
  const url = getBrowserPages()[page];
  await openTab(url);
}

async function openTab(url) {
  await api.tabs.create({ url });
}

async function openShortcutSettings() {
  if (isFirefox() && api.commands.openShortcutSettings) {
    await api.commands.openShortcutSettings();
    return;
  }
  await openTab(getBrowserPages().shortcuts);
}

function chromiumKeyToFirefoxShortcut(chromeKey) {
  return chromeKey.replace(/^(mac|linux|windows):/, '');
}

async function loadShortcutConfig() {
  const response = await fetch(api.runtime.getURL('shortcuts.json'));
  return response.json();
}

async function applyFirefoxShortcuts(config) {
  if (!isFirefox() || !api.commands?.update) return;

  const entries = Object.entries(config.chromeKeys ?? {});
  let applied = 0;

  for (const [commandName, chromeKey] of entries) {
    const shortcut = chromiumKeyToFirefoxShortcut(chromeKey);
    try {
      await api.commands.update({ name: commandName, shortcut });
      applied += 1;
    } catch (err) {
      console.warn(`[Tab Shortcuts] could not bind ${commandName} -> ${shortcut}:`, err);
    }
  }

  console.log(`[Tab Shortcuts] applied ${applied}/${entries.length} Firefox shortcuts`);
}

const KEEPALIVE_ALARM = 'tab-shortcuts-keepalive';

const TAB_COMMANDS = new Set([
  'tab-previous',
  'tab-next',
  'tab-move-previous',
  'tab-move-next',
  'tab-move-first',
  'tab-move-last',
  'tab-close',
  'tab-new',
  'tab-duplicate',
  'tab-pin',
  'tab-mute',
  'tab-reload',
  'tab-discard',
  'tab-back',
  'tab-forward',
  'tab-new-left',
  'tab-new-right',
]);

api.commands.onCommand.addListener(async (command) => {
  console.log('[Tab Shortcuts] command received:', command);

  const tab = TAB_COMMANDS.has(command) ? await getActiveTab() : null;
  if (TAB_COMMANDS.has(command) && !tab) {
    console.warn('[Tab Shortcuts] no active tab for command:', command);
    return;
  }

  try {
    switch (command) {
      case 'tab-previous':
        await selectAdjacentTab(tab, -1);
        break;
      case 'tab-next':
        await selectAdjacentTab(tab, 1);
        break;
      case 'tab-move-previous':
        await moveTab(tab, -1);
        break;
      case 'tab-move-next':
        await moveTab(tab, 1);
        break;
      case 'tab-move-first':
        await moveTabToIndex(tab, 0);
        break;
      case 'tab-move-last': {
        const tabs = await api.tabs.query({ windowId: tab.windowId });
        await moveTabToIndex(tab, tabs.length - 1);
        break;
      }
      case 'tab-close':
        await api.tabs.remove(tab.id);
        break;
      case 'tab-new':
        await createAdjacentTab(tab, 'right');
        break;
      case 'tab-duplicate':
        await api.tabs.duplicate(tab.id);
        break;
      case 'tab-pin':
        await api.tabs.update(tab.id, { pinned: !tab.pinned });
        break;
      case 'tab-mute':
        await api.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
        break;
      case 'tab-reload':
        await api.tabs.reload(tab.id);
        break;
      case 'tab-discard':
        if (api.tabs.discard) {
          await api.tabs.discard(tab.id).catch(() => {});
        }
        break;
      case 'tab-back':
        await api.tabs.goBack(tab.id).catch(() => {});
        break;
      case 'tab-forward':
        await api.tabs.goForward(tab.id).catch(() => {});
        break;
      case 'tab-new-left':
        await createAdjacentTab(tab, 'left');
        break;
      case 'tab-new-right':
        await createAdjacentTab(tab, 'right');
        break;
      case 'window-new':
        await api.windows.create({ focused: true });
        break;
      case 'window-incognito':
        await api.windows.create({ focused: true, incognito: true });
        break;
      case 'open-bookmarks':
        await openPage('bookmarks');
        break;
      case 'open-downloads':
        await openPage('downloads');
        break;
      case 'open-extensions':
        await openPage('extensions');
        break;
      case 'open-history':
        await openPage('history');
        break;
      case 'open-settings':
        await openPage('settings');
        break;
      case 'open-flags':
        await openPage('flags');
        break;
      case 'open-help':
        await openPage('help');
        break;
      case 'open-shortcuts':
        await openShortcutSettings();
        break;
      default:
        console.warn('[Tab Shortcuts] unknown command:', command);
    }
  } catch (err) {
    console.error(`[Tab Shortcuts] error executing ${command}:`, err);
  }
});

api.runtime.onInstalled.addListener(async (details) => {
  api.alarms.create(KEEPALIVE_ALARM, {
    delayInMinutes: 0.25,
    periodInMinutes: 0.4,
  });
  setupContextMenu();

  if (isFirefox()) {
    const config = await loadShortcutConfig();
    await applyFirefoxShortcuts(config);
  }

  const commands = await api.commands.getAll();
  console.log('[Tab Shortcuts] registered commands:', commands);

  if (details.reason === 'install') {
    await openShortcutSettings();
  }
});

api.runtime.onStartup.addListener(() => {
  api.alarms.create(KEEPALIVE_ALARM, {
    delayInMinutes: 0.25,
    periodInMinutes: 0.4,
  });
  setupContextMenu();
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    api.storage.local.get('_keepalive');
  }
});

function setupContextMenu() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: 'new-tab-left',
      title: 'New tab to the left',
      contexts: ['tab'],
    });
    api.contextMenus.create({
      id: 'new-tab-right',
      title: 'New tab to the right',
      contexts: ['tab'],
    });
  });
}

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'new-tab-left') {
    createAdjacentTab(tab, 'left');
  } else if (info.menuItemId === 'new-tab-right') {
    createAdjacentTab(tab, 'right');
  }
});

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function selectAdjacentTab(currentTab, direction) {
  const tabs = await api.tabs.query({ windowId: currentTab.windowId });
  if (tabs.length <= 1) return;

  const currentIndex = tabs.findIndex((t) => t.id === currentTab.id);
  let nextIndex = currentIndex + direction;

  if (nextIndex < 0) nextIndex = tabs.length - 1;
  if (nextIndex >= tabs.length) nextIndex = 0;

  await api.tabs.update(tabs[nextIndex].id, { active: true });
}

async function moveTab(tab, direction) {
  const tabs = await api.tabs.query({ windowId: tab.windowId });
  tabs.sort((a, b) => a.index - b.index);

  const pinnedCount = tabs.filter((t) => t.pinned).length;
  const isPinned = tab.pinned;

  // Pinned tabs stay within the pinned segment; unpinned tabs roam the whole
  // unpinned segment and cross group boundaries instead of wrapping inside one.
  let segmentStart = isPinned ? 0 : pinnedCount;
  let segmentEnd = isPinned ? pinnedCount - 1 : tabs.length - 1;

  const currentIndex = tabs.findIndex((t) => t.id === tab.id);
  let newIndex = currentIndex + direction;

  if (newIndex < segmentStart) newIndex = segmentEnd;
  if (newIndex > segmentEnd) newIndex = segmentStart;

  if (newIndex === currentIndex) return;

  await api.tabs.move(tab.id, { index: newIndex });

  await applyGroupingAfterMove(tab, direction);
}

// Re-establish group membership after a move: a tab dropped next to a group
// joins it, and a tab pulled away from its group is released from it.
async function applyGroupingAfterMove(tab, direction) {
  if (tab.pinned) return;
  if (
    typeof api.tabs.group !== 'function' &&
    typeof api.tabs.ungroup !== 'function'
  ) {
    return;
  }

  const updated = await api.tabs.query({ windowId: tab.windowId });
  updated.sort((a, b) => a.index - b.index);

  const movedIndex = updated.findIndex((t) => t.id === tab.id);
  if (movedIndex === -1) return;

  const leftNeighbor = updated[movedIndex - 1];
  const rightNeighbor = updated[movedIndex + 1];

  const groupOf = (t) =>
    t && !t.pinned && t.groupId !== undefined && t.groupId !== -1 ? t.groupId : null;

  const leftGroup = groupOf(leftNeighbor);
  const rightGroup = groupOf(rightNeighbor);
  const originalGroup = groupOf(tab);

  // Stay in the original group when either neighbor still belongs to it.
  // Without this, landing on the last slot pulls the tab into the adjacent
  // group on the far side.
  if (originalGroup !== null) {
    if (leftGroup === originalGroup || rightGroup === originalGroup) {
      await api.tabs.group({ tabIds: [tab.id], groupId: originalGroup });
      return;
    }

    const joinGroup =
      (direction > 0 ? rightGroup : leftGroup) ??
      (direction > 0 ? leftGroup : rightGroup);

    if (joinGroup !== null) {
      await api.tabs.group({ tabIds: [tab.id], groupId: joinGroup });
      return;
    }

    await api.tabs.ungroup([tab.id]);
    return;
  }

  // Tab landed between two members of the same group: join it.
  if (leftGroup !== null && leftGroup === rightGroup) {
    await api.tabs.group({ tabIds: [tab.id], groupId: leftGroup });
    return;
  }

  // Ungrouped tab landed just outside a single group: join at the correct edge
  // so the first or last slot of the group is reachable.
  const leftIsGroup = leftGroup !== null;
  const rightIsGroup = rightGroup !== null;
  if (leftIsGroup !== rightIsGroup) {
    const edgeGroup = leftIsGroup ? leftGroup : rightGroup;
    const atFirstSlot = !leftIsGroup;

    const groupTabs = updated.filter((t) => t.groupId === edgeGroup);
    const groupIndices = groupTabs.map((t) => t.index);
    const minGroupIndex = Math.min(...groupIndices);
    const maxGroupIndex = Math.max(...groupIndices);

    const target = atFirstSlot ? minGroupIndex : maxGroupIndex + 1;
    await api.tabs.move(tab.id, { index: target });
    await api.tabs.group({ tabIds: [tab.id], groupId: edgeGroup });
  }
}

async function moveTabToIndex(tab, index) {
  const tabs = await api.tabs.query({ windowId: tab.windowId });

  if (tab.groupId !== undefined && tab.groupId !== -1) {
    const groupTabs = tabs.filter((t) => t.groupId === tab.groupId);
    const groupIndices = groupTabs.map((t) => t.index);
    const minGroupIndex = Math.min(...groupIndices);
    const maxGroupIndex = Math.max(...groupIndices);
    index = index <= 0 ? minGroupIndex : maxGroupIndex;
  }

  const wrappedIndex = ((index % tabs.length) + tabs.length) % tabs.length;
  if (tab.index === wrappedIndex) return;
  await api.tabs.move(tab.id, { index: wrappedIndex });
}

async function createAdjacentTab(currentTab, side) {
  const tabs = await api.tabs.query({ windowId: currentTab.windowId });
  const index = tabs.findIndex((t) => t.id === currentTab.id);
  const newIndex = side === 'left' ? index : index + 1;

  const createOptions = { active: true, index: newIndex };
  if (currentTab.id !== undefined) {
    createOptions.openerTabId = currentTab.id;
  }

  const newTab = await api.tabs.create(createOptions);

  if (
    currentTab.groupId !== undefined &&
    currentTab.groupId !== -1 &&
    typeof api.tabs.group === 'function'
  ) {
    await api.tabs.group({ tabIds: [newTab.id], groupId: currentTab.groupId });
  }
}
