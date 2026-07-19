# Chrome Web Store listing

Everything the dashboard form asks for, ready to paste.

## Name

Radio Static

## Summary (132-char limit)

Adds an old-radio switch to every YouTube video: tinny speaker, warm static
and crackle, tuned against a real vintage radio.

## Category

Fun

## Description

Flip one switch and whatever YouTube is playing sounds like it's coming from
an old AM radio across the room — narrow tinny speaker, warm cabinet
resonance, gentle static and crackle underneath, and that squashed
"always equally loud" character old receivers had.

Flip it mid-chorus. That's the whole product.

🎛️ FIVE RADIOS BUILT IN

• the office radio — our tuned default
• pocket transistor — small, cheap and proud of it
• big console — the expensive living-room set
• distant station — music fighting through the static
• blown speaker — the volume knob went too far

...plus an advanced panel with live sliders (band edges, speaker resonance,
drive, static, crackle, room) to tune your own. Settings sync with your
browser profile.

📻 HOW TO USE

1. Open any YouTube video
2. Flip the 📻 switch in the player controls — or press Alt+R
3. Toggle any time; tweak the sound from the toolbar popup

⚙️ TUNED AGAINST A REAL RADIO

We wanted it to sound like the office radio in a beloved Balkan sitcom, so
we spectrally analyzed the show's audio at the exact moments the radio
plays, measured the speaker's cabinet resonance (465 Hz) and cone-breakup
peaks (1250 and 1800 Hz), and built those measurements into the effect
chain. This isn't a generic EQ preset — it's a little physical model of a
particular radio.

🔒 PRIVATE BY DESIGN

All audio processing happens inside your browser with the Web Audio API.
Nothing is downloaded, uploaded, recorded, or tracked. No servers, no
accounts, no analytics. The only permission is "storage" — to remember your
own slider settings. The extension makes zero network requests. It's open
source; read every line:
https://github.com/Based-Technology/radio-static-extension

Works on youtube.com, m.youtube.com and music.youtube.com.

## Review questionnaire answers

**Single purpose description:**
Applies a user-controlled vintage-radio audio effect to media playing on
YouTube pages.

**Permission justification — storage:**
Persists the user's own effect settings (slider values and chosen preset)
via chrome.storage.sync so they survive restarts and follow the browser
profile. No other data is stored.

**Host permission justification (content script on youtube.com):**
The content script must run on YouTube pages to attach the Web Audio effect
chain to the page's video element and to inject the on/off switch into the
player controls. Audio is processed locally and never leaves the browser.

**Remote code:** none. All code is packaged; the extension makes no network
requests.

**Data usage disclosures:** the extension does not collect, use, or share
any user data. (Answer "No" to every data-type checkbox.)

**Privacy policy URL:**
https://based-technology.github.io/radio-static-extension/privacy.html
