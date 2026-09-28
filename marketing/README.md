# Launch kit

The 114-second landscape trailer introduces the real application, explains its
code model, and shows authored films, SVG reconstruction, synthesized scores,
360° stages and Nature Worlds. It uses the application's own renderers, captured
UI, an Aurora Glass music bed, and natural neural English narration.
The narration lead-in is applied equally to both channels so speech remains
centered without a delayed duplicate in one ear.

## Ready to publish

Generated deliverables live in `out/launch/` (excluded from Git):

| File | Purpose |
| --- | --- |
| `mathloop-studio-trailer-1080p.mp4` | 1920 × 1080, 30 fps, H.264/AAC, 114 seconds; burned-in English captions |
| `mathloop-studio-trailer.en.srt` | Optional selectable YouTube captions with the same wording |
| `youtube-thumbnail.jpg` | 1920 × 1080 YouTube thumbnail |
| `storyboard.jpg` | Nine-scene visual review |
| `verification.json` | Portable codec, size, duration and source report |
| `voice.wav`, `music.wav`, `mix.wav` | Separate narration, original music and final mix |

Download published MP4s from the repository's
[latest release](https://github.com/ravipurohit1991/MathLoop-Studio/releases/latest).
The release also includes a 60-second portrait whale film, a 20-second spherical
aquarium and its 20-second portrait companion. Large generated files stay out of
the Git history.

The trailer is a conventional landscape movie demonstrating the 360° feature.
The aquarium demo is the actual spherical file. Upload that MP4 directly to
preserve its metadata; verify interactive playback after YouTube processing.

## Rebuild the trailer

Requirements: installed project dependencies, FFmpeg/ffprobe on PATH, and a
browser for screenshots. Run from the repository root.

```sh
# Terminal 1
npm run dev

# Terminal 2: capture a fresh browser context without personal browser state
node cli/capture-launch.mjs
```

For the release's neural narration, install Python and
[uv](https://docs.astral.sh/uv/), then run:

```sh
uv run cli/narrate-launch.py --retime
node cli/launch-trailer.mjs --preview
node cli/launch-trailer.mjs
```

The optional helper uses Microsoft's Andrew Multilingual neural voice through
[edge-tts](https://github.com/rany2/edge-tts). It sends the public trailer script
to the online speech service; no API key is required. With `--retime`, scenes
are extended where necessary so narration stays at its natural rate. Use
`--voice` to select another available voice. This helper is separate from the
local Studio application.

For an already rendered trailer, `node cli/launch-trailer.mjs --audio-only`
replaces the mix without encoding the picture again. Add `--retime` to adapt
the existing scenes to longer narration using `out/launch/video-timing.json`
from the previous render. Keep the script and scene order unchanged when
reusing the picture, so its burned-in captions still match.

For an offline Windows fallback, generate narration with a built-in voice:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File cli/narrate-launch.ps1
node cli/launch-trailer.mjs --preview
node cli/launch-trailer.mjs
```

The offline script selects Microsoft Zira Desktop by default. Pass `-Voice` to
choose another installed voice. Alternatively, provide WAV clips with matching
scene/part names in `out/launch/narration/`, for example `hook-0.wav`,
`hook-1.wav`, `collection-0.wav`. Each clip should fit within half its scene's
duration; the renderer permits modest timing adjustment and fails on a clip
that needs more than 1.35× speed. Fonts may differ across systems.

Edit [`trailer.json`](trailer.json) for the narration, captions and durations.
The layout and animated render selection are in
[`cli/launch-trailer.mjs`](../cli/launch-trailer.mjs). No video-generation or
speech API credentials are required. The preview command only creates stills,
thumbnail and captions; the full command generates the final audio and MP4.

## Upload copy

Use [youtube-upload.md](youtube-upload.md) for the suggested title, description,
chapters, tags and pinned comment. Review the synthetic narration before
publishing. The kit does not upload to YouTube or post comments automatically.

Encoding and spherical upload references:

- [YouTube recommended encoding](https://support.google.com/youtube/answer/1722171?hl=en)
- [YouTube 360° uploads](https://support.google.com/youtube/answer/6178631?hl=en)

Nature images retain their [Poly Haven attribution](../THIRD_PARTY_NOTICES.md).
The thumbnail and artwork are composed directly from the project source.
