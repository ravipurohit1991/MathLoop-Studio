# Launch kit

The 90-second landscape trailer introduces the real application, explains its
code model, and shows authored films, SVG reconstruction, synthesized scores,
360° stages and Nature Worlds. It uses the application's own renderers, captured
UI, an Aurora Glass music bed, and offline synthetic English narration.

## Ready to publish

Generated deliverables live in `out/launch/` (excluded from Git):

| File | Purpose |
| --- | --- |
| `mathloop-studio-trailer-1080p.mp4` | 1920 × 1080, 30 fps, H.264/AAC, 90 seconds; burned-in English captions |
| `mathloop-studio-trailer.en.srt` | Optional selectable YouTube captions with the same wording |
| `youtube-thumbnail.jpg` | 1920 × 1080 YouTube thumbnail |
| `storyboard.jpg` | Nine-scene visual review |
| `verification.json` | Portable codec, size, duration and source report |
| `voice.wav`, `music.wav`, `mix.wav` | Separate narration, original music and final mix |

Download published MP4s from the repository's
[v0.1.0 release](https://github.com/ravipurohit1991/MathLoop-Studio/releases/tag/v0.1.0).
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

On Windows, generate narration with a built-in voice:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File cli/narrate-launch.ps1
node cli/launch-trailer.mjs --preview
node cli/launch-trailer.mjs
```

The script selects Microsoft Zira Desktop by default. Pass `-Voice` to choose
another installed voice. On other systems, provide WAV clips with matching
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
