#!/usr/bin/env bash
# Synthesised SFX kit (no samples, no licences): whoosh, whoosh-soft, pop, tick, impact.
# Re-run to regenerate:  bash scripts/make-sfx.sh
set -euo pipefail
cd "$(dirname "$0")/../assets/sfx"
F="ffmpeg -v error -y"
# whoosh: pink noise, band-limited, swelling envelope, panned left→right, short echo tail
$F -f lavfi -i "anoisesrc=c=pink:d=0.6:a=0.9:r=48000" -af \
  "highpass=f=250,lowpass=f=5200,volume='pow(sin(PI*min(t/0.6\,1)),3)':eval=frame,aecho=0.8:0.5:35:0.25,pan=stereo|c0=c0*(1-t/0.6)|c1=c0*(t/0.6)" \
  -ac 2 whoosh.wav 2>/dev/null || $F -f lavfi -i "anoisesrc=c=pink:d=0.6:a=0.9:r=48000" -af \
  "highpass=f=250,lowpass=f=5200,volume='pow(sin(PI*min(t/0.6\,1)),3)':eval=frame,aecho=0.8:0.5:35:0.25" -ac 2 whoosh.wav
$F -f lavfi -i "anoisesrc=c=pink:d=0.45:a=0.6:r=48000" -af \
  "highpass=f=600,lowpass=f=3500,volume='pow(sin(PI*min(t/0.45\,1)),2)':eval=frame" -ac 2 whoosh-soft.wav
# pop: fast pitch-drop sine blip
$F -f lavfi -i "aevalsrc='0.9*sin(2*PI*(380+900*exp(-t*35))*t)*exp(-t*28)':d=0.16:s=48000" -ac 2 pop.wav
# tick: tiny UI click
$F -f lavfi -i "aevalsrc='0.6*sin(2*PI*2600*t)*exp(-t*140)':d=0.05:s=48000" -ac 2 tick.wav
# impact: sub boom + noise transient
$F -f lavfi -i "aevalsrc='0.95*sin(2*PI*(46+95*exp(-t*14))*t)*exp(-t*4.2)':d=1.0:s=48000" \
   -f lavfi -i "anoisesrc=d=0.12:a=0.5:r=48000" -filter_complex \
   "[1:a]lowpass=f=2500,volume='exp(-t*30)':eval=frame[n];[0:a][n]amix=inputs=2:normalize=0:duration=longest" -ac 2 impact.wav
ls -la
