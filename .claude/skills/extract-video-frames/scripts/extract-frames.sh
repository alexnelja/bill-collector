#!/bin/bash
# Extract frames and audio segments from video files (GIF, MP4, MOV) at specified intervals
# Usage: extract-frames.sh <video-path> [interval-seconds] [output-dir]

set -e

# Arguments
VIDEO_PATH="$1"
INTERVAL="${2:-1}"
OUTPUT_DIR="${3:-./frames}"

# Validate input
if [ -z "$VIDEO_PATH" ]; then
    echo "Error: Video path required"
    echo "Usage: extract-frames.sh <video-path> [interval-seconds] [output-dir]"
    exit 1
fi

if [ ! -f "$VIDEO_PATH" ]; then
    echo "Error: File not found: $VIDEO_PATH"
    exit 1
fi

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg not found"
    echo "Install with: brew install ffmpeg"
    exit 1
fi

# Detect audio stream
HAS_AUDIO=false
AUDIO_CODEC=""
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=nw=1:nk=1 "$VIDEO_PATH" 2>/dev/null | grep -q "audio"; then
    HAS_AUDIO=true
    AUDIO_CODEC=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$VIDEO_PATH" 2>/dev/null)
    echo "Audio stream detected (codec: $AUDIO_CODEC)"
else
    echo "No audio stream detected - skipping audio extraction"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get video duration in seconds
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH" 2>/dev/null | cut -d. -f1)

if [ -z "$DURATION" ] || [ "$DURATION" = "N/A" ]; then
    # For GIFs or files without duration, extract all frames
    echo "Extracting all frames from: $VIDEO_PATH"
    ffmpeg -i "$VIDEO_PATH" -vf "select='not(mod(n\,${INTERVAL}))'" -vsync vfr "$OUTPUT_DIR/frame_%03d.png" -y 2>/dev/null
else
    echo "Video duration: ${DURATION}s"
    echo "Extracting 1 frame every ${INTERVAL}s from: $VIDEO_PATH"

    # Extract frames at interval
    ffmpeg -i "$VIDEO_PATH" -vf "fps=1/${INTERVAL}" "$OUTPUT_DIR/frame_%03d.png" -y 2>/dev/null
fi

# Extract full continuous audio track
if [ "$HAS_AUDIO" = true ]; then
    echo "Extracting full audio track..."
    if [ "$AUDIO_CODEC" = "aac" ]; then
        ffmpeg -i "$VIDEO_PATH" -vn -acodec copy "$OUTPUT_DIR/full_audio.aac" -y 2>/dev/null
    else
        ffmpeg -i "$VIDEO_PATH" -vn -acodec aac -b:a 128k "$OUTPUT_DIR/full_audio.aac" -y 2>/dev/null
    fi
    if [ -f "$OUTPUT_DIR/full_audio.aac" ]; then
        echo "Full audio track: $OUTPUT_DIR/full_audio.aac"
    else
        echo "Warning: Failed to extract full audio track"
    fi
fi

# Count extracted frames
FRAME_COUNT=$(ls -1 "$OUTPUT_DIR"/frame_*.png 2>/dev/null | wc -l | tr -d ' ')

if [ "$FRAME_COUNT" -eq 0 ]; then
    echo "Error: No frames extracted"
    exit 1
fi

echo "Extracted $FRAME_COUNT frames to: $OUTPUT_DIR"

# Extract audio segments aligned to frames
AUDIO_COUNT=0
if [ "$HAS_AUDIO" = true ]; then
    echo "Extracting audio segments..."
    for i in $(seq -f "%03g" 1 "$FRAME_COUNT"); do
        TIMESTAMP_SEC=$((10#$i * INTERVAL - INTERVAL))
        AUDIO_FILE="audio_${i}.aac"

        if [ "$AUDIO_CODEC" = "aac" ]; then
            ffmpeg -ss "$TIMESTAMP_SEC" -i "$VIDEO_PATH" -t "$INTERVAL" -vn -acodec copy "$OUTPUT_DIR/$AUDIO_FILE" -y 2>/dev/null
        else
            ffmpeg -ss "$TIMESTAMP_SEC" -i "$VIDEO_PATH" -t "$INTERVAL" -vn -acodec aac -b:a 128k "$OUTPUT_DIR/$AUDIO_FILE" -y 2>/dev/null
        fi

        if [ -f "$OUTPUT_DIR/$AUDIO_FILE" ]; then
            AUDIO_COUNT=$((AUDIO_COUNT + 1))
        fi
    done
    echo "Extracted $AUDIO_COUNT audio segments"
fi

# Generate manifest.json
MANIFEST="$OUTPUT_DIR/manifest.json"

# Determine full audio path for manifest
FULL_AUDIO_PATH="null"
if [ "$HAS_AUDIO" = true ] && [ -f "$OUTPUT_DIR/full_audio.aac" ]; then
    FULL_AUDIO_PATH="\"full_audio.aac\""
fi

# Build JSON manually for portability
echo "{" > "$MANIFEST"
echo "  \"source\": \"$(basename "$VIDEO_PATH")\"," >> "$MANIFEST"
echo "  \"source_path\": \"$VIDEO_PATH\"," >> "$MANIFEST"
echo "  \"interval_seconds\": $INTERVAL," >> "$MANIFEST"
echo "  \"total_frames\": $FRAME_COUNT," >> "$MANIFEST"
echo "  \"has_audio\": $HAS_AUDIO," >> "$MANIFEST"
if [ "$HAS_AUDIO" = true ]; then
    echo "  \"audio_codec\": \"$AUDIO_CODEC\"," >> "$MANIFEST"
else
    echo "  \"audio_codec\": null," >> "$MANIFEST"
fi
echo "  \"total_audio_segments\": $AUDIO_COUNT," >> "$MANIFEST"
echo "  \"full_audio_path\": $FULL_AUDIO_PATH," >> "$MANIFEST"
echo "  \"output_directory\": \"$OUTPUT_DIR\"," >> "$MANIFEST"
echo "  \"frames\": [" >> "$MANIFEST"

# Add frame entries with audio paths
FIRST=true
for i in $(seq -f "%03g" 1 "$FRAME_COUNT"); do
    FRAME_FILE="frame_${i}.png"
    if [ -f "$OUTPUT_DIR/$FRAME_FILE" ]; then
        TIMESTAMP_SEC=$((10#$i * INTERVAL - INTERVAL))
        HOURS=$((TIMESTAMP_SEC / 3600))
        MINUTES=$(((TIMESTAMP_SEC % 3600) / 60))
        SECONDS=$((TIMESTAMP_SEC % 60))
        TIMESTAMP=$(printf "%02d:%02d:%02d" $HOURS $MINUTES $SECONDS)

        # Determine audio path for this frame
        AUDIO_FILE="audio_${i}.aac"
        if [ -f "$OUTPUT_DIR/$AUDIO_FILE" ]; then
            AUDIO_PATH="\"$AUDIO_FILE\""
        else
            AUDIO_PATH="null"
        fi

        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            echo "," >> "$MANIFEST"
        fi
        printf '    {"index": %d, "timestamp": "%s", "timestamp_seconds": %d, "path": "%s", "audio_path": %s}' "$((10#$i))" "$TIMESTAMP" "$TIMESTAMP_SEC" "$FRAME_FILE" "$AUDIO_PATH" >> "$MANIFEST"
    fi
done

echo "" >> "$MANIFEST"
echo "  ]" >> "$MANIFEST"
echo "}" >> "$MANIFEST"

echo "Manifest created: $MANIFEST"
echo ""
echo "--- Extraction Summary ---"
echo "  Frames: $FRAME_COUNT"
if [ "$HAS_AUDIO" = true ]; then
    echo "  Audio segments: $AUDIO_COUNT"
    echo "  Full audio track: $OUTPUT_DIR/full_audio.aac"
fi
echo "  Output directory: $OUTPUT_DIR"
echo "  Manifest: $MANIFEST"
echo ""
echo "Ready for review. Pass this directory to another agent."
