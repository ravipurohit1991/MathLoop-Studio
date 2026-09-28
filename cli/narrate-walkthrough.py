# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.2.8"]
# ///
"""Optional tutorial narration. Sends the public script to Microsoft Edge speech.
Run with: uv run cli/narrate-walkthrough.py
Cached by text and voice; never accelerates narration to fit the edit.
"""
import asyncio
import hashlib
import json
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "walkthrough" / "narration"

async def main():
    spec = json.loads((ROOT / "marketing/walkthrough.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    timing = {}
    for scene in spec["scenes"]:
        cues = []
        for i, cue in enumerate(scene["cues"]):
            name = f'{scene["id"]}-{i}'
            dest = OUT / f"{name}.mp3"
            key = hashlib.sha256((spec["voice"] + cue["text"]).encode()).hexdigest()
            stamp = OUT / f"{name}.sha256"
            if not dest.exists() or not stamp.exists() or stamp.read_text() != key:
                for attempt in range(4):
                    try:
                        await edge_tts.Communicate(cue["text"], spec["voice"], rate="+0%").save(str(dest))
                        stamp.write_text(key)
                        break
                    except Exception:
                        if attempt == 3:
                            raise
                        await asyncio.sleep(2)
            seconds = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dest)], text=True))
            cues.append({"file": f"narration/{name}.mp3", "speech": seconds, "duration": seconds + 1.0})
            print(f"{name}: {seconds:.2f}s", flush=True)
        timing[scene["id"]] = {"cues": cues, "duration": sum(c["duration"] for c in cues) + scene.get("listen", 0) + 0.5}
    (OUT.parent / "timing.json").write_text(json.dumps(timing, indent=2) + "\n")
    print(f'Total: {sum(s["duration"] for s in timing.values()) / 60:.1f} minutes')

if __name__ == "__main__":
    asyncio.run(main())
