// Radio Static: routes YouTube's <video> audio through an old-radio effect
// chain. Web Audio port of the radio-static Python reference implementation
// (its "final-both" preset, calibrated against measured reference spectra).

"use strict";

// speaker model: cabinet boom + two cone-breakup peaks; gains scale with the
// "speaker" param
const RESONANCES = [
  { hz: 465, db: 5.0, q: 1.1 },
  { hz: 1250, db: 3.5, q: 2.0 },
  { hz: 1800, db: 4.0, q: 1.4 },
];

const DEFAULTS = {
  low: 250, // bandpass low edge (Hz)
  high: 3100, // bandpass high edge (Hz)
  drive: 12, // distortion drive (dB)
  speaker: 1.0, // resonance amount (scales the three peaks)
  hiss: -36, // static level (dBFS)
  crackle: -33, // crackle level (dBFS)
  room: 0.15, // reverb wet level
};

const COMPRESSOR = { threshold: -30, ratio: 8, attack: 0.005, release: 0.12, knee: 6 };
const CRACKLE_RATE = 4; // pops/s
const ROOM_SECONDS = 0.3;

const params = { ...DEFAULTS };

const state = {
  ctx: null,
  video: null,
  source: null, // createMediaElementSource is once-per-element
  dryGain: null,
  wetGain: null,
  noiseGain: null,
  noiseNode: null,
  hpNodes: [],
  lpNodes: [],
  peakNodes: [],
  shaper: null,
  roomWet: null,
  enabled: false,
  ready: false,
  updateNoise: () => {},
};

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function makeDistortionCurve(driveDb) {
  const drive = dbToGain(driveDb);
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive);
  }
  return curve;
}

function makeRoomImpulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.07);
    }
  }
  return buffer;
}

function makeBand(ctx) {
  // one 2nd-order biquad per edge ~ the reference's stacked 1st-order pairs
  const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: params.low });
  const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: params.high });
  hp.connect(lp);
  state.hpNodes.push(hp);
  state.lpNodes.push(lp);
  return { input: hp, output: lp };
}

async function buildGraph(video) {
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(chrome.runtime.getURL("src/noise-worklet.js"));

  const source = ctx.createMediaElementSource(video);
  state.hpNodes = [];
  state.lpNodes = [];
  state.peakNodes = [];

  // bypass path (radio off = passthrough)
  const dryGain = new GainNode(ctx, { gain: 1 });
  source.connect(dryGain).connect(ctx.destination);

  // radio path: band -> resonances -> distortion -> compressor
  const band = makeBand(ctx);
  source.connect(band.input);
  let head = band.output;
  for (const r of RESONANCES) {
    const peak = new BiquadFilterNode(ctx, {
      type: "peaking",
      frequency: r.hz,
      gain: r.db * params.speaker,
      Q: r.q,
    });
    head.connect(peak);
    head = peak;
    state.peakNodes.push(peak);
  }
  const shaper = new WaveShaperNode(ctx, {
    curve: makeDistortionCurve(params.drive),
    oversample: "2x",
  });
  const comp = new DynamicsCompressorNode(ctx, COMPRESSOR);
  head.connect(shaper).connect(comp);

  // noise bed, band-limited by the same "speaker", mixed in after compression
  const noiseNode = new AudioWorkletNode(ctx, "radio-noise", {
    numberOfInputs: 0,
    outputChannelCount: [2],
    parameterData: {
      hissGain: dbToGain(params.hiss),
      crackleGain: dbToGain(params.crackle),
      crackleRate: CRACKLE_RATE,
    },
  });
  const noiseGain = new GainNode(ctx, { gain: 1 });
  const noiseBand = makeBand(ctx);
  noiseNode.connect(noiseGain).connect(noiseBand.input);

  // mix -> room (parallel dry + convolved wet) -> out
  const mix = new GainNode(ctx, { gain: 1 });
  comp.connect(mix);
  noiseBand.output.connect(mix);
  const wetGain = new GainNode(ctx, { gain: 0 }); // radio path master
  const roomDry = new GainNode(ctx, { gain: 1 });
  const room = new ConvolverNode(ctx, {
    buffer: makeRoomImpulse(ctx, ROOM_SECONDS),
  });
  const roomWet = new GainNode(ctx, { gain: params.room });
  mix.connect(roomDry).connect(wetGain);
  mix.connect(room).connect(roomWet).connect(wetGain);
  wetGain.connect(ctx.destination);

  Object.assign(state, {
    ctx,
    video,
    source,
    dryGain,
    wetGain,
    noiseGain,
    noiseNode,
    shaper,
    roomWet,
    ready: true,
  });

  // silence the static when the video is paused
  const updateNoise = () => {
    noiseGain.gain.value = video.paused || !state.enabled ? 0 : 1;
  };
  video.addEventListener("play", updateNoise);
  video.addEventListener("pause", updateNoise);
  state.updateNoise = updateNoise;
}

function applyParams(changed = {}) {
  Object.assign(params, changed);
  if (!state.ready) return;
  for (const hp of state.hpNodes) hp.frequency.value = params.low;
  for (const lp of state.lpNodes) lp.frequency.value = params.high;
  state.peakNodes.forEach((peak, i) => {
    peak.gain.value = RESONANCES[i].db * params.speaker;
  });
  if ("drive" in changed) {
    state.shaper.curve = makeDistortionCurve(params.drive);
  }
  state.noiseNode.parameters.get("hissGain").value = dbToGain(params.hiss);
  state.noiseNode.parameters.get("crackleGain").value = dbToGain(params.crackle);
  state.roomWet.gain.value = params.room;
}

function findVideo() {
  return document.querySelector("video");
}

function extensionAlive() {
  // after an extension reload this (orphaned) script's chrome APIs throw;
  // chrome.runtime.id is the cheapest liveness probe
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function notifyBackground(enabled) {
  if (!extensionAlive()) return; // badge sync unavailable; audio still works
  try {
    chrome.runtime.sendMessage({ type: "radio-state", enabled }).catch(() => {});
  } catch {
    // context invalidated between the check and the call: same story
  }
}

async function setEnabled(enabled) {
  const video = findVideo();
  if (!video) return { enabled: false, error: "no video on this page" };

  if (!state.ready && !extensionAlive()) {
    // can't load the worklet (chrome.runtime.getURL is gone): needs a reload
    const error = "extension was updated — refresh this page";
    const btn = document.querySelector(`.${BUTTON_CLASS}`);
    if (btn) btn.title = error;
    return { enabled: false, error };
  }

  if (!state.ready || state.video !== video) {
    if (state.ready && state.video !== video) {
      // YouTube swapped the element (SPA navigation): rebuild on the new one
      state.ctx.close().catch(() => {});
      state.ready = false;
    }
    await buildGraph(video);
  }
  if (state.ctx.state === "suspended") await state.ctx.resume();

  state.enabled = enabled;
  const t = state.ctx.currentTime;
  const fade = 0.05;
  state.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, t, fade);
  state.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, t, fade);
  state.updateNoise();
  renderPlayerButton();
  notifyBackground(enabled);
  return { enabled };
}

// --- in-player 📻 button -------------------------------------------------

const BUTTON_CLASS = "radio-static-btn";

function ensureButtonStyles() {
  if (document.getElementById("radio-static-style")) return;
  const style = document.createElement("style");
  style.id = "radio-static-style";
  // a real switch, styled after YouTube's autoplay toggle: track + sliding knob
  style.textContent = `
    .${BUTTON_CLASS} {
      vertical-align: top;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
    }
    .ytp-big-mode .${BUTTON_CLASS} {
      width: 54px;
    }
    .${BUTTON_CLASS} .radio-track {
      position: relative;
      width: 34px;
      height: 14px;
      border-radius: 7px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.3);
      transition: background 0.2s;
    }
    .${BUTTON_CLASS}.radio-on .radio-track {
      background: #c0392b;
    }
    .${BUTTON_CLASS} .radio-knob {
      position: absolute;
      top: 50%;
      left: -1px;
      transform: translate(0, -50%);
      font-size: 16px;
      line-height: 1;
      filter: grayscale(1);
      transition: transform 0.2s, filter 0.2s;
    }
    .${BUTTON_CLASS}.radio-on .radio-knob {
      transform: translate(19px, -50%);
      filter: none;
    }
  `;
  document.head.appendChild(style);
}

function renderPlayerButton() {
  const btn = document.querySelector(`.${BUTTON_CLASS}`);
  if (!btn) return;
  btn.classList.toggle("radio-on", state.enabled);
  btn.title = state.enabled ? "Old radio: on (Alt+R)" : "Old radio: off (Alt+R)";
}

function injectPlayerButton() {
  if (document.querySelector(`.${BUTTON_CLASS}`)) return true;
  const controls = document.querySelector(".ytp-right-controls");
  if (!controls) return false;

  ensureButtonStyles();
  const btn = document.createElement("button");
  btn.className = `ytp-button ${BUTTON_CLASS}`;
  const track = document.createElement("div");
  track.className = "radio-track";
  const knob = document.createElement("div");
  knob.className = "radio-knob";
  knob.textContent = "📻";
  track.appendChild(knob);
  btn.appendChild(track);
  btn.addEventListener("click", () => setEnabled(!state.enabled));
  controls.prepend(btn);
  renderPlayerButton();
  return true;
}

function keepButtonInjected() {
  injectPlayerButton();
  // YouTube is an SPA: re-inject after its internal navigations
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(injectPlayerButton, 500);
  });
  // fallback for slow player initialization
  let tries = 0;
  const timer = setInterval(() => {
    if (injectPlayerButton() || ++tries > 20) clearInterval(timer);
  }, 1000);
}

chrome.storage.sync.get("radioParams").then(({ radioParams }) => {
  if (radioParams) applyParams(radioParams);
});

keepButtonInjected();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "radio-toggle") {
    setEnabled(!state.enabled).then(sendResponse);
    return true; // async response
  }
  if (msg.type === "radio-status") {
    sendResponse({
      enabled: state.enabled,
      hasVideo: Boolean(findVideo()),
      params: { ...params },
    });
  }
  if (msg.type === "radio-set-params") {
    applyParams(msg.params);
    sendResponse({ ok: true });
  }
  return undefined;
});
