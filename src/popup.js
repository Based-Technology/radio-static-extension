"use strict";

const DEFAULTS = {
  low: 250,
  high: 3100,
  drive: 12,
  speaker: 1.0,
  hiss: -36,
  crackle: -33,
  room: 0.15,
};

// named radios from the calibration/A-B sessions (see the radio-static repo)
const PRESETS = {
  "the office radio": { ...DEFAULTS }, // the tuned default
  "pocket transistor": {
    low: 500,
    high: 2500,
    drive: 12,
    speaker: 0.8,
    hiss: -36,
    crackle: -33,
    room: 0.1,
  },
  "big console": {
    low: 200,
    high: 5000,
    drive: 8,
    speaker: 0.7,
    hiss: -40,
    crackle: -36,
    room: 0.2,
  },
  "distant station": {
    low: 250,
    high: 3100,
    drive: 14,
    speaker: 1.0,
    hiss: -26,
    crackle: -28,
    room: 0.15,
  },
  "blown speaker": {
    low: 250,
    high: 3100,
    drive: 22,
    speaker: 1.4,
    hiss: -34,
    crackle: -26,
    room: 0.15,
  },
};

const CUSTOM = "custom";

const UNITS = {
  low: (v) => `${v} Hz`,
  high: (v) => `${v} Hz`,
  drive: (v) => `${v} dB`,
  speaker: (v) => `${Number(v).toFixed(1)}×`,
  hiss: (v) => `${v} dB`,
  crackle: (v) => `${v} dB`,
  room: (v) => `${Math.round(v * 100)}%`,
};

const toggleBtn = document.getElementById("toggle");
const status = document.getElementById("status");
const presetSelect = document.getElementById("preset");
const sliders = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, document.getElementById(key)])
);

let params = { ...DEFAULTS };

for (const name of [...Object.keys(PRESETS), CUSTOM]) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  presetSelect.appendChild(option);
}

function matchingPreset() {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (Object.keys(DEFAULTS).every((key) => preset[key] === params[key])) {
      return name;
    }
  }
  return CUSTOM;
}

function renderPreset() {
  presetSelect.value = matchingPreset();
}

function renderToggle(state) {
  const on = Boolean(state && state.enabled);
  toggleBtn.classList.toggle("on", on);
  if (state && state.error) {
    status.textContent = state.error;
  } else {
    status.textContent = on ? "playing through the old radio" : "off";
  }
}

function renderSliders() {
  for (const [key, slider] of Object.entries(sliders)) {
    slider.value = params[key];
    slider.nextElementSibling.textContent = UNITS[key](params[key]);
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(message) {
  const tab = await activeTab();
  if (!tab || !tab.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}

const DISCONNECTED =
  "can't reach this tab — refresh the YouTube page and try again";

let saveTimer = null;

async function applyAndSave() {
  renderSliders();
  renderPreset();
  const result = await send({ type: "radio-set-params", params });
  if (!result) status.textContent = DISCONNECTED;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({ radioParams: params });
  }, 250);
}

for (const [key, slider] of Object.entries(sliders)) {
  slider.addEventListener("input", () => {
    params[key] = Number(slider.value);
    applyAndSave(); // renders sliders + preset (flips to "custom" on mismatch)
  });
}

presetSelect.addEventListener("change", () => {
  const preset = PRESETS[presetSelect.value];
  if (preset) {
    params = { ...preset };
    applyAndSave();
  }
});

toggleBtn.addEventListener("click", async () => {
  const result = await send({ type: "radio-toggle" });
  if (result) {
    renderToggle(result);
  } else {
    status.textContent = DISCONNECTED;
  }
});

document.getElementById("reset").addEventListener("click", () => {
  params = { ...DEFAULTS };
  applyAndSave();
});

async function init() {
  const { radioParams } = await chrome.storage.sync.get("radioParams");
  if (radioParams) params = { ...DEFAULTS, ...radioParams };

  const state = await send({ type: "radio-status" });
  if (state) {
    // the tab's live params win over storage
    if (state.params) params = { ...DEFAULTS, ...state.params };
    renderToggle(state);
  } else {
    status.textContent =
      "no connection — open a YouTube tab, or refresh it if already open";
  }
  renderSliders();
  renderPreset();
}

init();
