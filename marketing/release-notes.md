# MathLoop Studio 0.1.0

Turn mathematical drawings into films, then build a world around them.

- Story Studio: 15 authored films, editable chapters, SVG import and eight
  synthesized scores, including Whale Song.
- 360 Studio: three spherical stages, editable reel placement and portrait
  companion exports.
- Nature Worlds: photographic environments, procedural weather and ambience.
- Browser previews and exports, native rendering tools, saved project JSON,
  documentation and screenshots.

## Included videos

| Download | Format |
| --- | --- |
| `mathloop-studio-trailer-1080p.mp4` | 114-second landscape introduction with natural neural narration, 1080p30 |
| `fourier-whale-3d-60s.mp4` | 60-second portrait whale film with synthesized Whale Song |
| `fourier-aquarium-360-20s.mp4` | Spherical aquarium with projection metadata, 3840 × 1920 |
| `fourier-aquarium-short-20s.mp4` | Guided portrait companion, 1080 × 1920 |
| `youtube-thumbnail.jpg` | Launch thumbnail |
| `mathloop-studio-trailer.en.srt` | English caption track |

Use the README to run the app or render your own editions. For interactive 360°
playback, use the included local player or a spherical video player. A flat
desktop player may display a stretched panorama. YouTube playback needs to be
verified after upload; the files are locally verified.

Some browser encoders support stereo AAC but cannot encode four-channel
spatial audio. Use the native FFmpeg workflow for Nature Worlds on those
systems. See `docs/360-audio.md` for the separate spatial-audio tools.

Code: MIT. Nature photographs: Poly Haven CC0, with credits in the asset
manifest. Launch narration: Andrew Multilingual neural voice; music and mathematical artwork are
generated from the source.
