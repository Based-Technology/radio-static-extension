# Decisions

## Why an extension (vs SPA/backend/bot)

Chosen because the audio never leaves the user's browser: a content script on
youtube.com is same-origin with the page DOM, so `createMediaElementSource` on
YouTube's `<video>` works (the CORS/tainting wall only blocks *embedding* pages).
Zero backend, zero egress cost, inherently streaming — we process only what's
currently playing. Full options analysis lives in the radio-static session notes;
generic EQ/effects extensions (LoveLofi, Sound Tools) prove the technique, but no
dedicated vintage-radio-simulation extension existed as of 2026-07.

## Chain design notes (Web Audio port)

- Ported from radio-static's `final-both` preset (see that repo's DECISIONS.md
  for the measurement story behind band 250–3100, resonances 465/1250/1800 Hz).
- Band edges use ONE 2nd-order biquad each (12 dB/oct) to match the reference's
  stacked pair of 1st-order filters.
- Chrome's `DynamicsCompressorNode` applies automatic makeup gain, so the
  reference's explicit +10 dB makeup stage is omitted.
- No explicit loudness matching (the offline trick doesn't map to live streaming);
  compressor auto-makeup keeps levels roughly comparable. Revisit if the toggle
  feels like a volume jump.
- Noise bed is an AudioWorklet (port of noise.py), band-limited by a clone of the
  speaker bandpass, mixed after compression, muted on video pause.
- Room reverb: ConvolverNode with a generated 0.3 s exponentially-decaying noise
  impulse (wet 0.15) instead of shipping an IR file.
- `createMediaElementSource` is once-per-element: the graph is built once and
  rebuilt only when YouTube's SPA navigation swaps the video element.

## UI: quick toggles + advanced popup (v0.2–v0.3)

v0.2 removed the popup as one click too many for on/off: 📻 button injected
into YouTube's `.ytp-right-controls` (native `ytp-button` styling, greyscale
when off) plus an Alt+R command, with a service worker mirroring state as an
"ON" badge per tab.

v0.3 brought the popup back as the **advanced panel** (toolbar icon opens it;
`action.onClicked` therefore never fires — quick toggles remain the player
button and Alt+R, plus a big 📻 in the popup itself). Seven sliders — low/high
cut, speaker (scales the three resonance peak gains together rather than
exposing hz/db/q per peak), drive, static, crackle, room — applied **live** to
the running graph (`radio-set-params` message; biquad frequencies and gains are
AudioParams, the waveshaper curve is rebuilt only when drive changes) and
persisted to `chrome.storage.sync` (debounced). On popup open, the active
tab's live params win over storage; params from storage are loaded by the
content script at startup, so tweaks survive reloads and roam across devices.
Crackle *rate* stays fixed (4/s) to keep the panel simple — level covers the
useful range.

## Presets (v0.4, productification)

Five named radios in the popup, derived from the calibration/A-B sessions in the
Python repo: "the office radio" (= the tuned default), "pocket transistor"
(narrow band), "big console" (wide, clean, roomier), "distant station" (static
up front), "blown speaker" (heavy drive + crackle). The dropdown and sliders
are two views of the same params: picking a preset sets the sliders; moving any
slider flips the dropdown to "custom" (membership is checked by exact param
match, recomputed on every change). No separate preset persistence — the params
themselves are the stored state. Original variants with per-peak resonance
differences (dual-768, honk-1800) can't be expressed in the flat param model
(the "speaker" slider scales all three peaks together); approximating them
poorly was worse than leaving them out.
