#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "elevenlabs",
#     "python-dotenv",
# ]
# ///
"""ElevenLabs Audio Transcription Script

Transcribes audio/video files using ElevenLabs Scribe v2 API.
Reads ELEVENLABS_API_KEY from .env in the current working directory.

Usage: uv run transcribe.py <audio_file_path> [options]
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using ElevenLabs Scribe v2")
    parser.add_argument("file", help="Path to audio/video file to transcribe")
    parser.add_argument("--language", default=None, help="ISO-639-1/3 language code (default: auto-detect)")
    parser.add_argument("--no-diarize", action="store_true", help="Disable speaker diarization")
    parser.add_argument("--no-audio-events", action="store_true", help="Disable audio event tagging")
    parser.add_argument("--num-speakers", type=int, default=None, help="Max number of speakers (1-32, default: auto)")
    parser.add_argument("--timestamps", choices=["none", "word", "character"], default="word", help="Timestamp granularity (default: word)")
    parser.add_argument("--keyterms", nargs="+", default=None, help="Key terms to bias transcription towards (max 100)")
    parser.add_argument("--output", "-o", default=None, help="Output file path (default: stdout)")
    parser.add_argument("--json", action="store_true", help="Output full JSON response")
    args = parser.parse_args()

    # Load .env from current working directory
    env_path = os.path.join(os.getcwd(), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        load_dotenv()

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("Error: ELEVENLABS_API_KEY not found in .env file.", file=sys.stderr)
        print("Add ELEVENLABS_API_KEY=your-key-here to your .env file.", file=sys.stderr)
        sys.exit(1)

    file_path = os.path.expanduser(args.file)
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    client = ElevenLabs(api_key=api_key)

    print(f"Transcribing: {file_path}", file=sys.stderr)
    print(f"Model: scribe_v2 | Diarize: {not args.no_diarize} | Audio events: {not args.no_audio_events}", file=sys.stderr)
    if args.language:
        print(f"Language: {args.language}", file=sys.stderr)
    else:
        print("Language: auto-detect", file=sys.stderr)
    if args.num_speakers:
        print(f"Max speakers: {args.num_speakers}", file=sys.stderr)
    if args.keyterms:
        print(f"Key terms: {', '.join(args.keyterms)}", file=sys.stderr)

    kwargs = {
        "model_id": "scribe_v2",
        "tag_audio_events": not args.no_audio_events,
        "language_code": args.language,
        "diarize": not args.no_diarize,
        "timestamps_granularity": args.timestamps,
    }
    if args.num_speakers is not None:
        kwargs["num_speakers"] = args.num_speakers
    if args.keyterms is not None:
        kwargs["keyterms"] = args.keyterms

    with open(file_path, "rb") as audio_file:
        transcription = client.speech_to_text.convert(file=audio_file, **kwargs)

    if args.json:
        output = json.dumps(transcription.__dict__ if hasattr(transcription, '__dict__') else str(transcription), indent=2, default=str)
    else:
        lines = []
        if hasattr(transcription, 'language_code'):
            lines.append(f"Language: {transcription.language_code} (confidence: {getattr(transcription, 'language_probability', 'N/A')})")
            lines.append("")

        if hasattr(transcription, 'words') and transcription.words:
            current_speaker = None
            current_text = []

            for word in transcription.words:
                speaker = getattr(word, 'speaker_id', None)

                if speaker != current_speaker and current_text:
                    prefix = f"[Speaker {current_speaker}]: " if current_speaker else ""
                    lines.append(f"{prefix}{''.join(current_text).strip()}")
                    current_text = []

                current_speaker = speaker
                current_text.append(word.text)

            if current_text:
                prefix = f"[Speaker {current_speaker}]: " if current_speaker else ""
                lines.append(f"{prefix}{''.join(current_text).strip()}")
        elif hasattr(transcription, 'text'):
            lines.append(transcription.text)
        else:
            lines.append(str(transcription))

        output = "\n".join(lines)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"\nTranscription saved to: {args.output}", file=sys.stderr)
    else:
        print("\n--- Transcription ---\n")
        print(output)


if __name__ == "__main__":
    main()
