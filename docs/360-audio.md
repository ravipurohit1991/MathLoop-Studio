# 360° audio: spatial placement and listening focus

YouTube spatial audio places sounds around the listener. It does **not** provide
"play only the music I am looking at." A sound behind you remains part of the
sound field. Turning changes its perceived direction, with loudness and tone
changes determined by the playback decoder. First-order Ambisonics cannot carry
arbitrary independent music switches for each viewing direction.

The local preview now offers two listening modes:

| Mode | What turning does | Delivery |
| --- | --- | --- |
| Spatial mix | Rotates a stereo pair of virtual microphones through the MP4's actual AmbiX channels. Other sounds remain audible. | The MP4 is a YouTube spatial-audio upload candidate; YouTube uses its own renderer. |
| Focus | Fades between separate mono tracks. Sounds to the side or behind are silent; adjacent sounds crossfade as you turn. Pitch matters too. | Interactive local player only. Downloading or uploading the MP4 does not include this behavior. |

The earlier local player only rotated the video texture. Its sound button
unmuted the HTML video element, leaving the browser to downmix the four channels
as ordinary surround audio. No audio decoder received the camera rotation.
The player now detects `SA3D`, splits the four channels explicitly, and updates
its audio gains on dragging, arrow keys, reset, and exhibit selection.

The earlier documentation also overstated what directional microphone tests
prove. Those tests are useful for finding channel or axis errors. They do not
prove that YouTube will isolate the music you face.

## Build and try it

```powershell
npm run 360:spatial
npm run 360:preview -- --story fourier-observatory-360 --video out/360-spatial-demo/observatory-360-spatial-20s.mp4
```

Open http://127.0.0.1:5190, press **Sound on** and **Play**, then choose
**Focus · hear what you face** under Listening mode. Drag the picture or select
an exhibit. Return to **Spatial mix** to hear the difference.

The demo reuses its existing panorama. To use another existing render:

```powershell
npm run 360:spatial -- --video path/to/panorama.mp4
```

Audio duration follows the selected video. Its pictured exhibits must match the
observatory's placements; this command does not infer positions from footage.

| Exhibit | Heading | Sound |
| --- | --- | --- |
| Nautilus | 0° | Piano only: repeating struck notes |
| Golden knot | 90° | Drums only: kick, snare, hi-hat |
| Whale | 180° | Organ only: sustained low tone |
| Manta | -90° | Rain only: steady unpitched water noise |

These are synthesized test sounds, chosen for obvious differences in rhythm
and timbre. The default is `--sound-set distinct`; `--sound-set original`
restores the earlier thumb piano / glass / drone / breath arrangement.

The distinct demo prepared for this investigation is in
`out/360-distinct-sounds/observatory-360-spatial-20s.mp4`. Its four `focus-*.wav`
files also serve as isolated reference sounds, so you can learn each sound
before comparing directions.

The output folder contains:

- `observatory-360-spatial-20s.mp4`: the video with one four-channel AmbiX track.
- `focus-*.wav`: independent mono tracks for the local Focus mode.
- `spatial-audio.json`: source positions, format, preview files, and the MP4 hash.

Keep the preview files beside the MP4. The server serves only the listed WAV
files; it checks the MP4 hash when present to avoid using stems from a different
render. The player checks stem channel counts and duration. Pause, seek,
buffering, rate changes, mute, and video looping synchronize or stop all stems.

`--stereo` optionally writes fixed-heading stereo WAVs. These are diagnostic
virtual microphones, not head-tracked playback or a binaural YouTube preview.

## YouTube export

The spatial demo writes:

- A 2:1 H.264 panorama with spherical video metadata.
- Exactly one AAC-LC audio track: four channels at 48 kHz and 384 kbps.
- ACN ordering `W, Y, Z, X`, SN3D normalization, and first-order `SA3D` metadata.

These match [YouTube's documented spatial upload requirements](https://support.google.com/youtube/answer/6395969?hl=en)
and [Google's spatial metadata specification](https://github.com/google/spatial-media/blob/master/docs/spatial-audio-rfc.md).
The AAC encoder is fed interleaved floats; do not combine the channels through
an automatic surround-layout remixer. Stage heading is clockwise, whereas
Ambisonic azimuth is anticlockwise: `azimuth = -heading`.

The ordinary Studio **Export 360° MP4** and `story` commands still use the
ordinary stereo score. They are not the spatial-demo export path. Their video
can rotate while their stereo soundtrack stays fixed. The preview labels files
without `SA3D` accordingly.

Upload the spatial-demo MP4 and let YouTube finish processing. Check with
headphones in the actual browser/app your audience uses. Verify that apparent
sound directions rotate with the picture; hearing other sources is expected.
`youtubePlaybackVerified` remains false until the uploaded version is tested.
Neither correct tags nor a local audio test establishes YouTube client behavior.

For strict "different music depending on what you look at," use a player that
controls individual tracks at runtime, such as this local Focus mode. This
cannot be added to YouTube's normal watch page through MP4 metadata.

## Verification

```powershell
npm run test:360-audio
npm run test:360-spatial-player
```

Unit tests cover ACN/SN3D, heading and elevation, metadata, focus boundaries,
back-seam continuity, and the spatial mix. The browser test encodes four known
tones into a real AAC MP4, measures the actual Web Audio output while turning,
and verifies Focus rejects off-screen tones by at least 40 dB. It also checks
pause, seek, loop, and mute. Measurements are saved under
`out/tests-spatial-playback/measurements.json`.

These are local automated signal checks. They are not a listening assessment
or a verification of a YouTube upload.
