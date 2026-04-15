#!/bin/bash
# Record a 6-second screen capture and convert to GIF for README
# Usage: ./scripts/record-demo.sh
# Prerequisites: brew install ffmpeg

DURATION=6
OUTPUT_DIR="$(dirname "$0")/../docs"
VIDEO="$OUTPUT_DIR/demo_raw.mov"
GIF="$OUTPUT_DIR/demo.gif"

mkdir -p "$OUTPUT_DIR"

echo "Recording screen in 3 seconds... Switch to AutoVJ browser window!"
echo "Recording will last ${DURATION} seconds."
sleep 3

echo "Recording..."
# Record the main display
screencapture -v -V $DURATION "$VIDEO" 2>/dev/null

if [ ! -f "$VIDEO" ]; then
  echo "Recording failed. Trying alternative method..."
  # Alternative: use ffmpeg to capture screen
  ffmpeg -f avfoundation -framerate 30 -t $DURATION -i "1:none" -y "$VIDEO" 2>/dev/null
fi

if [ ! -f "$VIDEO" ]; then
  echo "Error: Could not record screen."
  echo "Manual method: Press Cmd+Shift+5, record 6 seconds, save as docs/demo_raw.mov"
  echo "Then run: ffmpeg -i docs/demo_raw.mov -vf 'fps=15,scale=600:-1' -loop 0 docs/demo.gif"
  exit 1
fi

echo "Converting to GIF..."
# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
  echo "ffmpeg not found. Install with: brew install ffmpeg"
  echo "Then run: ffmpeg -i '$VIDEO' -vf 'fps=15,scale=600:-1' -loop 0 '$GIF'"
  exit 1
fi

ffmpeg -i "$VIDEO" -vf "fps=15,scale=600:-1:flags=lanczos" -loop 0 -y "$GIF" 2>/dev/null

rm -f "$VIDEO"

if [ -f "$GIF" ]; then
  SIZE=$(du -h "$GIF" | cut -f1)
  echo "Done! GIF saved: $GIF ($SIZE)"
  echo "Now run: cd $(dirname "$0")/.. && git add docs/demo.gif && git commit -m 'Add demo GIF' && git push"
else
  echo "GIF conversion failed."
fi
