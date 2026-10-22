#!/bin/bash
# Generates MP3 fixtures into tests/fixtures/ (idempotent: skips existing files).
set -e
export PATH="/opt/homebrew/bin:$PATH"
D="$(cd "$(dirname "$0")" && pwd)/fixtures"
mkdir -p "$D"
gen() { # gen <outfile> <ffmpeg args...>
  local out="$D/$1"; shift
  if [ -s "$out" ]; then echo "skip $out"; return; fi
  ffmpeg -v error -y "$@" "$out.tmp.mp3" && mv "$out.tmp.mp3" "$out" && echo "made $out"
}
gen vbr.mp3        -f lavfi -i "sine=f=440:d=10,volume=0.2" -ac 2 -c:a libmp3lame -q:a 2
gen cbr_mono.mp3   -f lavfi -i "sine=f=300:d=8,volume=0.2" -ac 1 -c:a libmp3lame -b:a 128k -write_xing 0
gen mpeg2.mp3      -f lavfi -i "sine=f=500:d=8,volume=0.2" -ar 22050 -ac 2 -c:a libmp3lame -b:a 64k -metadata title=Test
gen pink.mp3       -f lavfi -i "anoisesrc=d=12:c=pink:a=0.3:seed=1" -ac 2 -c:a libmp3lame -q:a 2
gen sr48.mp3       -f lavfi -i "sine=f=600:d=8,volume=0.2" -ar 48000 -ac 2 -c:a libmp3lame -q:a 2
gen id3v1.mp3      -f lavfi -i "sine=f=700:d=8,volume=0.2" -ac 2 -c:a libmp3lame -q:a 2 -id3v2_version 3 -write_id3v1 1 -metadata title=Tagged -metadata artist=Me
