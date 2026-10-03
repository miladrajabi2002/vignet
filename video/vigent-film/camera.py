#!/usr/bin/env python3
"""Apply the film's camera (slow push / pull and drift) to the rendered frames with sub-pixel resampling.
Usage: camera.py <frames in> <cues.json> <frames out> [processes=3]
The frames were rendered at device scale DSF (> the largest camera scale), so this only ever samples down."""
import json, os, sys
from multiprocessing import Pool
from PIL import Image

SRC, CUES, OUT = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
N = int(sys.argv[4]) if len(sys.argv) > 4 else 3
W, H = 1920, 1080

def one(i):
	src = f'{SRC}/f{i:05d}.png'
	dst = f'{OUT}/f{i:05d}.png'
	im = Image.open(src).convert('RGB')
	k = im.width / W                       # device scale the frame was rendered at
	s, tx, ty = CUES['cam'][i]
	# output pixel X shows stage coordinate u = 960 + (X − tx − 960) / s
	im.transform((W, H), Image.AFFINE, (k / s, 0, k * (W / 2 - (W / 2 + tx) / s), 0, k / s, k * (H / 2 - (H / 2 + ty) / s)), resample=Image.BICUBIC).save(dst, compress_level=1)

if __name__ == '__main__':
	os.makedirs(OUT, exist_ok=True)
	todo = [i for i in range(len(CUES['cam'])) if os.path.exists(f'{SRC}/f{i:05d}.png')]
	with Pool(N) as p:
		p.map(one, todo, chunksize=16)
	print(len(todo), 'frames')
