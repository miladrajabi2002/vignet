# Ledger — Vigent feature film

Final cut: `out/vigent-film.mp4` — 45.03 s, 1920×1080, 60 fps, H.264 + AAC 256k, 32 MB. Cut 5.

## Review rounds

Each cut was judged by a fresh agent that saw only the render, the brief and the previous report (the full reports are in `reviews/`). The reviewers are AI agents working from extracted frames and measurements. None of them, and nobody else, has listened to the soundtrack.

| Cut | Judged by | Top findings | What changed | Measured after |
|---|---|---|---|---|
| 1 | builder's own measurements | 15.8 s of 47.5 s near-frozen; the same frame differed by seek order (star rotation, recap chip layout) | Camera push and drift on every scene, holds retimed; rotation and rings computed from time alone; chips packed after fonts load; camera moved to a resampling step because a slow CSS scale stepped text 1 px at a time | frozen 0.3 s of 45.4 s |
| 2 | critic 1 | Blank chat opening; three dirty transitions (grey flash into and out of the dark section, empty frames I→J); dim dark section; recap bleeding to 3 px from the frame edge; arrows over bubbles; toast over the calendar; flat −16 LUFS; no typographic beat | Customer's message carried through the row → chat expansion; cart shell with skeleton rows; dark opens and closes as a circle from the spark; type beat «دایرکت · کامنت · استوری» added; recap chips fitted to a safe width; flex rows; toast below the grid; footnote and icons larger; gradient contrast raised; master to −14 LUFS | frozen 0.1 s of 45.5 s; −14.2 LUFS |
| 3 | critic 2 | One leaked frame of the previous scene at each end of the type beat; dark cards on the light background as the dark closed; chip touching the product card; toggles switching with no pointer; music ending on a chop | Outgoing scene finishes before the edit point; the beat's last word is handed to the next scene at identical pixels; Instagram cards clipped by the closing circle; chip placed from the measured card height; pointer presses each toggle; sample chart redrawn so it does not read as a result; music ends on a faded hit | frozen 0.4 s of 44.9 s; LRA 3.0 LU |
| 4 | critic 3 | F leak, chip, toggles, ending all fixed. Remaining: effects measured loud by a per-window method; the closing circle ended beside the spark, not on it; 0.17 s of lone spark before the wordmark | Effects lowered (each event capped at what its own moment of music calls for; whoosh target 2.5 dB); spark waits for the circle to close on it; wordmark starts as the spark lands; both end-card rings finish before the last frame | see below |
| 5 | builder only (dense frames around each fix, measurements) | — | — | final numbers below |

Cut 5 was not sent to a fourth independent reviewer: what remained after cut 4 was cosmetic or a question of listening taste.

### Reviewer points deliberately not taken

- **Typing indicator at 0.25 s.** It runs 0.42 s. The line it shows («در حال پاسخ‌گویی از دانش شما») is a claim worth reading, and 0.25 s is a flash.
- **"Six scenes are badge + headline + card."** True of the feature scenes. One type beat was added; a larger restructure was not attempted.
- **First word of the type beat on the bar line.** The beat was given a 0.1 s lead-in so the word settles near the bar line; an exact lock would need the beat lengthened by about a second.
- **Dark section 2–3 LU quieter.** That is the track's own breakdown, placed there on purpose.

## Final measurements (cut 5)

| Check | Result | Target (quality bar) |
|---|---|---|
| Frozen time (`frozen-time.sh`, 10 fps, threshold 0.35) | 0.5 s of 45.0 s, all inside the type beat's word holds; no hold over 0.6 s except the end card | ≤ about 1 s per 30 s |
| Integrated loudness | −14.2 LUFS | −14 for launch-style pieces |
| Loudness range | 3.0 LU | ≥ about 3 for energetic scores |
| True peak | −1.5 dBFS | ≤ −1 |
| Seek-order determinism | 8 frames rendered in two different seek orders in separate browser processes: 7 identical, 1 at 88 dB PSNR (a handful of pixels a few levels apart) | same pixels |
| Effects over music, 2–8 kHz, peak 50 ms window in the 0.3 s after each cue (the skill's method) | whoosh median +3.0 dB, max +4.4; click median +0.2, max +2.9; pop about 0 | about +3–4 dB, never +10 |
| Same, but mix minus music in the same 50 ms window (critic 3's stricter method) | whoosh median +14 dB, max +20; click median +7, max +14 | critic asked for ≤ +10 |
| Effect sample peak against the local music peak | all at or below +0.1 dB | at or below the music |

The two effect measurements disagree because the score is percussive: between hits it is nearly silent, so any audible effect is far above the music in that instant. Which reading matches the ear can only be settled by listening. `out/vigent-film-music-only.mp4` is the fallback if the effects are not wanted.

What was sampled rather than exhaustive: contrast was spot-checked by the reviewers on headlines and the footnote, not on every text element; determinism was tested on 8–11 frames per round, not all 2,702.

## Sound sources

All from Mixkit. Licence text read on 2026-10-03: the Stock Music Free Licence allows social media posts, online marketing ads and YouTube, and does **not** allow TV or radio broadcast, CDs/DVDs or video games; the Sound Effects Free Licence allows commercial projects including broadcast. Neither allows redistributing the files on their own, so they are not stored in this folder.

| Use | Item | Source |
|---|---|---|
| Music | "Close Up" by Michael Ramir C. (corporate / rhythmic underscore, 105.5 BPM) | `https://assets.mixkit.co/music/1167/1167.mp3` |
| Whoosh on scene changes (12) | Mixkit sound effect 1485 | `https://assets.mixkit.co/active_storage/sfx/1485/1485-preview.mp3` |
| Click on pointer clicks (12) | Mixkit sound effect 2568 | `…/sfx/2568/2568-preview.mp3` |
| Pop on confirmations and beat words (8) | Mixkit sound effect 2358 | `…/sfx/2358/2358-preview.mp3` |

Effects were chosen by analysis from 48 candidates with the skill's `sfx-candidates.py` (rejecting boomy, hissy or long ones), then high-passed, low-passed and faded.

### How the music was edited to picture (`build-audio.py`)

- Tempo raised 4.3 % (105.5 → 110 BPM) so exactly 12 bars span the title (2.8 s) and the return to light (29.0 s).
- The film opens on the track's drum fill; the groove returns on the title.
- The track's breakdown (from its bar 16) falls under the end of the Learning Center scene, the type beat and the dark Instagram scene; at the bar line where the film returns to light the edit jumps to the track's last full-groove section (30 ms equal-power crossfade).
- The grid is slid 74 ms early so a beat falls on frame 0.
- Ending: last full hit at 44.16 s, then a fade to silence at 45.00 s.
- Cuts other than those three are not locked to beats.

## Truthfulness

Every on-screen claim traces to the live marketing copy (table in `BRIEF.md`). Names, messages, prices, the order number and the daily-report figures are illustrative samples, the same ones the website uses; the footnote «نام‌ها و ارقام داخل صحنه‌ها نمایشی‌اند» is on screen through every feature scene. The chart is tagged «نمودار نمونه», carries no values, and its shapes were redrawn so they do not suggest growth. `yourshop.ir` was replaced by «سایت خودتان»; `@yourshop` in the story card is a placeholder handle.

## Render notes

- One background render hit the tool's 10-minute limit at 2,715 of 2,850 frames (cut 1); the missing 135 frames were rendered separately. Later cuts ran as three parallel processes.
- Cut 5 reuses cut 4's frames for 0–21.5 s (nothing in that stretch changed) and re-rendered the rest; the join at frame 1289/1290 was checked frame by frame.
- Three Chromium behaviours had to be worked around to get the same pixels from any seek order: GSAP lazy rendering, 3D transforms (compositor layers keep a cached raster), and repeated `fromTo` tweens on one element. All three are noted in `film.js`.
