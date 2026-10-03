# Vigent feature film

A 45 s, 1080p60 motion film that introduces Vigent's capabilities. Every frame is code: one HTML page driven by a paused GSAP timeline, rendered frame by frame with headless Chromium.

- `out/` — the finished film, a music-only version, a poster frame and a contact sheet.
- `BRIEF.md` — brief, the claims the film is allowed to make and where each comes from, storyboard.
- `LEDGER.md` — what each independent review found and what changed, measurements, music and sound-effect sources, known limits.

## Preview

Serve this folder with any static server and open `index.html`. It plays in a loop with a scrubber; the camera you see there is a CSS approximation of the one applied at render time.

```bash
python3 -m http.server 8080
```

## Render

Needs Node 22+, `playwright` with its Chromium, ffmpeg, and Python 3 with numpy, scipy and Pillow. Set `PW_DIR` to a folder whose `node_modules` contains `playwright`.

```bash
node render.mjs --out frames --dsf 1.1 --cues cues.json --fps 60      # frames above 1080p, plus cue points and the per-frame camera
python3 camera.py frames cues.json cam                                # camera push and drift, resampled to 1920×1080
python3 build-audio.py <dir with the Mixkit files> audio cues.json    # music edited to picture, effects, −14 LUFS
ffmpeg -framerate 60 -i cam/f%05d.png -i audio/mix.wav -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 16 -c:a aac -b:a 256k -movflags +faststart -shortest out/vigent-film.mp4
```

One browser process is the bottleneck, so run two or three `render.mjs` processes on separate `--from` / `--to` ranges to go faster. The Mixkit audio files are not kept in this folder (their licence does not allow redistributing them on their own); `LEDGER.md` lists the ids.

## How the page is put together

- `film.js` builds the DOM for repeated elements, measures targets after the fonts load, then lays every tween on one paused timeline. `window.__seek(t)` renders film time `t`.
- Time has three layers: the authored timeline, a retime table (`WARP`) that speeds up stretches where only the pointer travels, and an edit list (`EDL`) that plays authored ranges in film order. The type beat is authored after the end card and placed between scenes F and G by the edit list.
- Anything that repeats on one element (spark rotation, pulse rings, click rings) is computed in `frame()` from the time alone, so a frame never depends on which frame was rendered before it.
- The camera is not a CSS transform at render time: a slow CSS scale makes text step in whole pixels. `camera.py` applies it to the finished frames with sub-pixel resampling.
