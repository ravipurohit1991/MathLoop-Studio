# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.2.8"]
# ///
"""Generate the public launch script with a natural neural voice.

Run: uv run cli/narrate-launch.py
Requires internet: script text is sent to Microsoft's Edge speech service.
No credentials are needed. This is an optional marketing tool, not an app dependency.
"""
import argparse
import asyncio
import json
import math
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "launch" / "narration"


def run(*args):
    return subprocess.check_output(args, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="en-US-AndrewMultilingualNeural")
    parser.add_argument("--retime", action="store_true", help="Extend scenes when necessary to preserve natural speech speed")
    args = parser.parse_args()
    spec = json.loads((ROOT / "marketing" / "trailer.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    timings = []
    for scene in spec["scenes"]:
        longest = 0
        for part, text in enumerate(scene["narration"]):
            name = f'{scene["id"]}-{part}'
            media = OUT / f"{name}.mp3"
            target = scene["duration"] / 2 - 0.3
            rate = 0
            # Prefer extending the edit to rushing the voice.
            for attempt in range(3):
                await edge_tts.Communicate(text, args.voice, rate=f"+{rate}%").save(str(media))
                length = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(media)))
                if args.retime or length <= target:
                    break
                rate = min(35, round((1 + rate / 100) * length / target * 100 - 100) + 2)
            if not args.retime and length > target + 0.15:
                raise RuntimeError(f"{name} is too long; shorten the script or increase its duration.")
            run("ffmpeg", "-v", "error", "-y", "-i", str(media), "-ar", "48000", "-ac", "2", str(OUT / f"{name}.wav"))
            timings.append({"clip": name, "seconds": length, "ratePercent": rate})
            longest = max(longest, length)
            print(f"{name}: {length:.2f}s, neural rate +{rate}%", flush=True)
        if args.retime:
            scene["duration"] = max(scene["duration"], math.ceil((longest + 0.4) * 2))
    if args.retime:
        (ROOT / "marketing" / "trailer.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "voice.json").write_text(json.dumps({"provider": "Microsoft Edge online speech", "voice": args.voice, "kind": "neural synthetic narration", "clips": timings}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
