#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
artifact_dir="$script_dir/artifacts"
qa_dir="$script_dir/qa"
with_sfx="${1:-$artifact_dir/paper-editorial-assembly-v3-with-sfx.mp4}"
no_sfx="${2:-$artifact_dir/paper-editorial-assembly-v3-no-sfx.mp4}"

mkdir -p "$qa_dir"

for input in "$with_sfx" "$no_sfx"; do
  if [[ ! -s "$input" ]]; then
    echo "missing input: $input" >&2
    exit 2
  fi
done

ffprobe -v error -show_streams -show_format -of json "$with_sfx" > "$qa_dir/ffprobe-with-sfx.json"
ffprobe -v error -show_streams -show_format -of json "$no_sfx" > "$qa_dir/ffprobe-no-sfx.json"

ffmpeg -v error -i "$with_sfx" -map 0 -f null - 2> "$qa_dir/decode-with-sfx.log"
ffmpeg -v error -i "$no_sfx" -map 0 -f null - 2> "$qa_dir/decode-no-sfx.log"

ffmpeg -v info -i "$with_sfx" -an -vf "blackdetect=d=0.10:pix_th=0.10" -f null - 2> "$qa_dir/blackdetect.log"
ffmpeg -v info -i "$with_sfx" -an -vf "negate,blackdetect=d=0.10:pix_th=0.10" -f null - 2> "$qa_dir/whitedetect.log"
# Keep this aligned with the independent recovery QA that identified the
# archived long holds.  Adjacent intervals are merged by the summarizer.
ffmpeg -v info -i "$with_sfx" -an -vf "freezedetect=n=-50dB:d=0.50" -f null - 2> "$qa_dir/freezedetect.log"
ffmpeg -y -v error -i "$with_sfx" -map 0:v:0 -f framemd5 "$qa_dir/framemd5.txt"
ffmpeg -y -v error -i "$no_sfx" -map 0:v:0 -f framemd5 "$qa_dir/framemd5-no-sfx.txt"
cmp "$qa_dir/framemd5.txt" "$qa_dir/framemd5-no-sfx.txt" > "$qa_dir/video-stream-parity.log"

awk -F',' '
  /^#/ {next}
  {
    hash=$6
    gsub(/[[:space:]]/, "", hash)
    if (frame_index == 0) {
      previous_hash=hash
      run_start=0
      run_length=1
    } else if (hash == previous_hash) {
      run_length++
    } else {
      if (run_length >= 2) {
        printf "start_frame=%d end_frame=%d frames=%d start_seconds=%.3f end_seconds=%.3f\n", run_start, frame_index-1, run_length, run_start/30, frame_index/30
      }
      previous_hash=hash
      run_start=frame_index
      run_length=1
    }
    frame_index++
  }
  END {
    if (run_length >= 2) {
      printf "start_frame=%d end_frame=%d frames=%d start_seconds=%.3f end_seconds=%.3f\n", run_start, frame_index-1, run_length, run_start/30, frame_index/30
    }
  }
' "$qa_dir/framemd5.txt" > "$qa_dir/exact-duplicate-runs.txt"

ffmpeg -v info -i "$with_sfx" -vn -af volumedetect -f null - 2> "$qa_dir/volumedetect.log"
ffmpeg -v info -i "$with_sfx" -vn -af "ebur128=peak=true" -f null - 2> "$qa_dir/ebur128.log"
ffmpeg -v info -i "$with_sfx" -vn -af "silencedetect=n=-55dB:d=0.10" -f null - 2> "$qa_dir/silencedetect.log"

ffmpeg -y -v error -i "$with_sfx" -vf "fps=2/3,scale=384:216:flags=lanczos,tile=5x4:padding=4:margin=4:color=#101A1D" -frames:v 1 "$artifact_dir/contact-sheet-v3-1p5s.jpg"

for frame in 235 495 855; do
  ffmpeg -y -v error -i "$with_sfx" -vf "select=eq(n\\,$frame)" -vsync vfr -frames:v 1 "$artifact_dir/frame-$frame.png"
done

ffmpeg -y -v error -i "$with_sfx" -vf "select='between(n\\,280\\,306)*not(mod(n-280\\,2))',scale=384:216:flags=lanczos,tile=7x2:padding=4:margin=4:color=#101A1D" -vsync vfr -frames:v 1 "$artifact_dir/transition-a-to-b-strip.jpg"
ffmpeg -y -v error -i "$with_sfx" -vf "select='between(n\\,585\\,611)*not(mod(n-585\\,2))',scale=384:216:flags=lanczos,tile=7x2:padding=4:margin=4:color=#101A1D" -vsync vfr -frames:v 1 "$artifact_dir/transition-b-to-c-strip.jpg"

echo "technical QA evidence written to $qa_dir"
