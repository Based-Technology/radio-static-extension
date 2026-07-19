# Radio Static (browser extension)

Play YouTube through an old radio: band-limited speaker, cabinet resonances,
static, crackle and AGC squash — live, in the browser. Companion to the
[radio-static](https://github.com/Based-Technology/radio-static) Python tool,
which is the reference implementation this chain is calibrated against.

## Install (development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this folder
4. Open any YouTube video and toggle the radio:
   - the **📻 button in the player controls** (bottom right, next to settings)
   - press **Alt+R** (rebindable at `chrome://extensions/shortcuts`)
   - the toolbar icon opens the **advanced panel**: big toggle plus live
     sliders (low/high cut, speaker resonance, drive, static, crackle, room),
     persisted across sessions; "reset to default radio" restores the tuned
     preset. The badge shows ON while active.

## Troubleshooting

After **reloading the extension** (`chrome://extensions`), already-open YouTube
tabs keep running the old content script: the in-player button may still work,
but the popup can no longer reach the tab (it will say so). **Refresh the
YouTube tab** to reconnect.

## How it works

A content script on youtube.com taps the page's `<video>` element via
`createMediaElementSource` and routes it through a Web Audio graph:

```
video ─┬─ dry gain (bypass) ──────────────────────────────┐
       └─ bandpass 250–3100 Hz → resonances (465/1250/1800 Hz)
          → tanh waveshaper → compressor ─┬─ room reverb ─┴→ speakers
             noise worklet → bandpass ────┘
```

Audio never leaves the browser: no downloads, no backend, works while you
stream normally. The noise bed mutes when the video is paused.
