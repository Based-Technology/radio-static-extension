// Keyboard shortcut toggles; badge mirrors state. (The toolbar icon opens the
// advanced popup, so action.onClicked never fires and is not registered.)

"use strict";

function updateBadge(tabId, state) {
  const on = Boolean(state && state.enabled);
  chrome.action.setBadgeText({ tabId, text: on ? "ON" : "" });
  if (on) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#c0392b" });
  }
}

async function toggle(tabId) {
  try {
    const state = await chrome.tabs.sendMessage(tabId, {
      type: "radio-toggle",
    });
    updateBadge(tabId, state);
  } catch {
    // not a YouTube tab (no content script): nothing to do
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-radio" && tab && tab.id) toggle(tab.id);
});

// in-page button toggles report their state so the badge stays in sync
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "radio-state" && sender.tab && sender.tab.id) {
    updateBadge(sender.tab.id, msg);
  }
});
