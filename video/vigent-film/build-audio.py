#!/usr/bin/env python3
"""Build the film's soundtrack: library music edited to picture, plus sparse sound effects.
Usage: build-audio.py <dir with downloaded mp3s> <out dir> <cues.json from `render.mjs --cues`>
Writes music.wav (music only) and mix.wav (music + effects), both at the same integrated loudness.
Sources (Mixkit, see LEDGER.md): music/1167 "Close Up", sfx 1485 (whoosh), 2568 (click), 2358 (pop).
Requires ffmpeg, numpy, scipy."""
import json, re, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt

SRC, OUT = sys.argv[1], sys.argv[2]
CUES = json.load(open(sys.argv[3]))        # film-time cue points exported by the page itself
SR, FILM = 48000, CUES['duration']
TARGET_LUFS = -14.0

def load(path, af=None):
	cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + ['-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
	return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).reshape(-1, 2).copy()

def write(path, x):
	subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', path], input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)

def lufs(path):
	e = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
	tail = e[e.rfind('Summary:'):]
	return float(re.search(r'I:\s*(-?[\d.]+)', tail).group(1)), float(re.search(r'Peak:\s*(-?[\d.]+)', tail).group(1))

# ── music: the track's bar is 2.2756 s (105.5 BPM). Stretch it a touch so a whole number of bars spans title → splice:
#    the groove returns (bar 8, after the fill) on the title, the breakdown (bar 16) covers the dark Instagram scene,
#    and the full groove comes back on the bar line where the film returns to light.
TITLE, SPLICE = CUES['title'], CUES['splice']
NBARS = int((SPLICE - TITLE) / 2.2756) + 1  # the next whole number of bars up: speed the track a little rather than slow it
if 2.2756 * NBARS / (SPLICE - TITLE) > 1.06: NBARS -= 1
BAR = (SPLICE - TITLE) / NBARS
STRETCH = 2.2756 / BAR
down0 = 0.11 / STRETCH                      # first downbeat of the stretched track
y = load(f'{SRC}/m1167.mp3', f'atempo={STRETCH:.5f}')
BEAT = BAR / 4
LEAD = TITLE % BEAT                         # slide the grid a few ms earlier so a beat falls exactly on frame 0 …
if LEAD > 0.09: LEAD = 0.0                  # … but never by more than the ear forgives against the title
A = down0 + 8 * BAR - (TITLE - LEAD)
end_bar = int((91.6 / STRETCH - FILM - 0.3 + (SPLICE - LEAD) - down0) / BAR)   # last bar that keeps the track playing past the end of the film
B = down0 + end_bar * BAR - (SPLICE - LEAD)
last_beat = max(b for b in (k * BEAT for k in range(400)) if b <= FILM - 0.72)   # the last hit that still leaves room for the fade
print(f'{NBARS} bars title→splice, bar {BAR:.4f}s, stretch {STRETCH:.4f}, grid lead {LEAD*1000:.0f} ms, part 1 leaves at bar {8 + NBARS}, end part from bar {end_bar}, last full hit {last_beat:.2f}s, fade to {FILM - 0.04:.2f}s')
n = int(FILM * SR)
s = lambda t: int(round(t * SR))
part1 = y[s(A):s(A) + n]
part2 = np.zeros((n, 2), np.float32)
seg = y[s(B):s(B) + n]
part2[:len(seg)] = seg
xf = s(0.03)
k = s(SPLICE - LEAD) - xf
ramp = np.linspace(0, np.pi / 2, xf)[:, None]
music = np.concatenate([part1[:k], part1[k:k + xf] * np.cos(ramp) + part2[k:k + xf] * np.sin(ramp), part2[k + xf:]])
music[:s(0.002)] *= np.linspace(0, 1, s(0.002))[:, None]
# ending: the last hit rings, then an equal-power fade to silence just before the last frame
f0, f1 = s(last_beat + 0.12), s(FILM - 0.04)
music[f0:f1] *= np.cos(np.linspace(0, np.pi / 2, f1 - f0))[:, None] ** 2
music[f1:] = 0
write(f'{OUT}/_m.wav', music)
i0, _ = lufs(f'{OUT}/_m.wav')
music *= 10 ** ((-18.0 - i0) / 20)          # music bed at −18 LUFS before effects
write(f'{OUT}/_m.wav', music)

# ── effects: soft whoosh on real transitions, click on pointer clicks, pop on confirmations
def soft(path, hp, lp):
	z = load(path, f'highpass=f={hp},lowpass=f={lp},afade=t=in:d=0.008')
	z[-s(0.05):] *= np.linspace(1, 0, s(0.05))[:, None]
	return z
SFX = {'whoosh': soft(f'{SRC}/sfx/w1485.mp3', 220, 7000), 'click': soft(f'{SRC}/sfx/c2568.mp3', 150, 6500), 'pop': soft(f'{SRC}/sfx/n2358.mp3', 150, 6500)}
EVENTS = CUES['events']
mono = music.mean(1)
def band_peak(x, sos, a, b):
	f = sosfilt(sos, x)[a:b]
	h = s(0.05)
	return max(10 * np.log10((f[i:i + h] ** 2).mean() + 1e-12) for i in range(0, max(1, len(f) - h), h // 2))
HB = butter(4, [2000, 8000], btype='band', fs=SR, output='sos')
gains = {}
for name, z in SFX.items():
	zm = z.mean(1)
	F = np.abs(np.fft.rfft(zm * np.hanning(len(zm)))) ** 2
	fr = np.fft.rfftfreq(len(zm), 1 / SR)
	c = np.cumsum(F) / F.sum()
	lo = max(fr[np.searchsorted(c, .2)], 40)
	hi = min(max(fr[np.searchsorted(c, .8)], lo * 2), SR / 2 - 200)
	sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos')
	per = []
	for t in EVENTS[name]:
		a, b = s(t) - SR // 2, s(t) + SR
		base = mono[max(0, a):b].copy()
		off = s(t) - max(0, a)
		w = (off, off + s(0.3))
		b0, h0 = band_peak(base, sos, *w), band_peak(base, HB, *w)
		g = prev = 0.005
		for x in np.geomspace(.005, 1.5, 160):
			seg = base.copy()
			m = min(len(zm), len(seg) - off)
			seg[off:off + m] += x * zm[:m]
			if band_peak(seg, HB, *w) - h0 > 4.0: g = prev; break          # cap the ear-sensitive 2–8 kHz lift
			if band_peak(seg, sos, *w) - b0 >= (2.5 if name == 'whoosh' else 3.0): g = x; break   # lift inside the effect's own band
			prev = g = x
		per.append(g)
	med = float(np.median(per))
	# one gain per sound so repeats stay consistent, but never more than that moment of music calls for
	# (in the thin passages of the score a full-level effect would poke out)
	gains[name] = [round(min(med, g), 3) for g in per]
	print(name, 'band', round(lo), round(hi), 'solved', [round(g, 3) for g in per], 'median', round(med, 3), 'used', gains[name])

mix = music.copy()
for name, z in SFX.items():
	for t, g in zip(EVENTS[name], gains[name]):
		a = s(t)
		m = min(len(z), n - a)
		mix[a:a + m] += g * z[:m]

# ── same integrated loudness for both deliverables, true peak under −1 dBTP
for name, x in (('music', music), ('mix', mix)):
	write(f'{OUT}/_t.wav', x)
	i, _ = lufs(f'{OUT}/_t.wav')
	x = x * 10 ** ((TARGET_LUFS - i) / 20)
	write(f'{OUT}/_t.wav', x)
	subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/_t.wav', '-af', 'alimiter=limit=0.82:attack=3:release=60:level=disabled', '-ar', str(SR), '-c:a', 'pcm_s24le', f'{OUT}/{name}.wav'], check=True)
	print(name, 'LUFS / true peak:', lufs(f'{OUT}/{name}.wav'))
json.dump({'gains': gains, 'events': EVENTS, 'A': A, 'B': B, 'stretch': STRETCH, 'bar': BAR, 'end_bar': end_bar}, open(f'{OUT}/audio-ledger.json', 'w'), indent=1)
