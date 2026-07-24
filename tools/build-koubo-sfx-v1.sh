#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT/assets/sfx/koubo-sfx-v1/originals"
OUTPUT_DIR="$ROOT/remotion/public/audio/koubo-sfx-v1"
FFMPEG="${FFMPEG:-$(command -v ffmpeg || true)}"

if [[ -z "$FFMPEG" ]]; then
  echo "ffmpeg 未安装或不在 PATH 中" >&2
  exit 1
fi

mkdir -p "$SOURCE_DIR" "$OUTPUT_DIR"

download() {
  local url="$1"
  local output="$2"
  curl --fail --location --silent --show-error "$url" --output "$output"
}

download "https://remotion.media/whoosh.wav" "$SOURCE_DIR/whoosh-cc0.wav"
download "https://remotion.media/page-turn.wav" "$SOURCE_DIR/page-turn-cc0.wav"
download "https://remotion.media/switch.wav" "$SOURCE_DIR/ui-switch-cc0.wav"
download "https://remotion.media/mouse-click.wav" "$SOURCE_DIR/mouse-click-cc0.wav"
download "https://remotion.media/shutter-modern.wav" "$SOURCE_DIR/shutter-modern-cc0.wav"
download "https://remotion.media/whip.wav" "$SOURCE_DIR/whip-cc0.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/whoosh-cc0.wav" \
  -af "atempo=0.5,highpass=f=140,lowpass=f=8500,afade=t=out:st=0.22:d=0.09,volume=0.50" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/section-air.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/page-turn-cc0.wav" \
  -af "highpass=f=180,lowpass=f=9000,afade=t=out:st=0.29:d=0.10,volume=0.48" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/card-reveal.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/ui-switch-cc0.wav" \
  -filter_complex \
  "[0:a]highpass=f=220,lowpass=f=9200,volume=0.35[a0]; \
   [0:a]highpass=f=300,lowpass=f=9800,volume=0.24,adelay=120|120[a1]; \
   [a0][a1]amix=inputs=2:duration=longest:normalize=0,afade=t=out:st=0.34:d=0.10[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/node-connect.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/mouse-click-cc0.wav" \
  -af "highpass=f=280,lowpass=f=8500,afade=t=out:st=0.28:d=0.10,volume=0.34" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/ui-click.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/shutter-modern-cc0.wav" \
  -af "highpass=f=160,lowpass=f=9000,afade=t=out:st=0.35:d=0.12,volume=0.34" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/camera-shutter.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$SOURCE_DIR/whip-cc0.wav" \
  -af "atempo=0.78,highpass=f=200,lowpass=f=8200,afade=t=out:st=0.13:d=0.08,volume=0.34" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/keyword-tick.wav"

"$FFMPEG" -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=740:sample_rate=48000:duration=0.13" \
  -f lavfi -i "sine=frequency=1110:sample_rate=48000:duration=0.16" \
  -filter_complex \
  "[0:a]afade=t=out:st=0.07:d=0.06,volume=0.055[a0]; \
   [1:a]adelay=65|65,afade=t=out:st=0.13:d=0.08,volume=0.045[a1]; \
   [a0][a1]amix=inputs=2:duration=longest:normalize=0,highpass=f=300,lowpass=f=5000[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le "$OUTPUT_DIR/confirm-soft.wav"

echo "Built Koubo SFX v1 in $OUTPUT_DIR"
