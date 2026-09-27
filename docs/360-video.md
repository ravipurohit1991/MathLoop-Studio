# 360° stages

A **stage** places finished 3D films around one fixed viewpoint and renders
their XYZ geometry to a complete 360° × 180° panorama. Each viewer can look in
a different direction while the same film plays.

Three stages ship:

| Stage | id | What stands in it |
| --- | --- | --- |
| Inside a Fourier aquarium | `fourier-aquarium-360` | whale, manta, golden knot |
| A drift of lanterns | `fourier-lanterns-360` | three jellyfish at three depths, one nautilus |
| The golden observatory | `fourier-observatory-360` | nautilus, knot, whale, manta, one per quarter turn |

## Build one in 360 Studio

Run `npm run dev`, open **http://127.0.0.1:5180** and choose the **360 Studio**
tab. Pick a stage, then place reels and aim them.

A **reel** is a 3D film's geometry and palette, borrowed without its chapters.
Any film in the reel rack can stand in any stage, and the same film can stand in
one stage more than once at different sizes and depths.

Each placed reel carries:

| Control | Range | What it does |
| --- | --- | --- |
| Heading | -180 to 180° | which way a viewer turns to find it |
| Elevation | -70 to 70° | how far above the horizon it hangs |
| Tilt | -80 to 80° | leans it towards the viewer or away |
| Facing | -180 to 180° | turns the sculpture on the spot |
| Size | 0.2 to 4× | its size where it stands |
| Distance | 400 to 3000 | how far away it sits |
| Rotations | 0 to 4 per loop | whole turns, so the loop still closes |
| Match the stage palette | on/off | drop the film's own colours for the room's |

The preview has two modes. **Look around** is an ordinary camera inside the
sphere: drag to turn, scroll to zoom. **Panorama** is the actual 2:1 frame that
carries the metadata. A stage saves as an ordinary story project; its
arrangement lives in `params.exhibits` as plain JSON, so a saved stage reloads
without its source code.

A stage holds between one and eight reels. Placements are validated on every
edit, so an out-of-range angle is refused with a message rather than rendering
something wrong.

## Render one from the command line

```powershell
npm run 360:render        # the aquarium
npm run 360:lanterns
npm run 360:observatory
npm run 360:preview
```

Open **http://127.0.0.1:5190**, press Play, and drag the picture. Scroll to zoom,
use the arrow keys to turn, or select an exhibit below the player. The player
works while paused, too. It plays the actual exported MP4.

Default delivery: **20 seconds, 3840 × 1920, 30 fps**, H.264 High / yuv420p,
Rec.709, AAC stereo music, and both Google Spherical Video V2 and V1 metadata.
The video is monoscopic. Its audio is ordinary stereo, not spatial audio.
For a spatial soundtrack and a local mode that switches between sounds as you
look around, see [360° audio](360-audio.md). The usual Studio and story exports
use stereo; 360° video metadata alone does not make their audio spatial.

The upload file is:

```text
out/360-aquarium/fourier-aquarium-360-20s.mp4
```

That folder also contains the panorama cover, preview frames, contact sheet,
original score, editable project JSON and a production manifest. The manifest
includes FFprobe's recognized spherical projection. `youtubePlaybackVerified`
remains false until an actual upload has been checked.

## Upload to YouTube

1. Upload the exported MP4 as a regular video. An unlisted upload is useful for
   a first test.
2. Let YouTube finish processing the spherical version. YouTube says 360°
   playback can take up to an hour to become available.
3. Open the watch page in a supported desktop browser and click-drag the video.
   Look for the pan control and check that looking right reveals the manta.
   On a phone, use the YouTube app.

Upload the generated file directly. An editor or transcoder that removes its
spherical metadata can make it appear flat. A conventional desktop video
player may show the entire stretched panorama; use the supplied local player
or a player with 360° support to look around.

[YouTube's spherical-video upload instructions](https://support.google.com/youtube/answer/6178631?hl=en)

## Portrait viewing and YouTube Shorts

The local player has **Wide 16:9** and **Portrait 9:16** buttons. Portrait is
selected automatically on small screens. Open
**http://127.0.0.1:5190/?view=portrait** to select the tall window on any screen.
Drag, zoom, playback and seeking work in both layouts. Changing the window
preserves the film and playhead; the source MP4 still contains the full sphere
at 2:1.

YouTube documents Shorts as square or vertical uploads up to three minutes.
Its documentation does not establish a supported way to retain spherical
drag controls inside the Shorts feed. The portrait option here is a local
viewing mode, not a claim of interactive Shorts compatibility.

Every stage has a companion Short. In 360 Studio, **Export the 9:16 Short**
renders it from the arrangement on screen. From the command line, render the
guided tour story directly:

```powershell
npm run 360:short
# Optional: change the length or music
npm run 360:short -- --duration 30 --score still-water
```

Default output: **20 seconds, 1080 × 1920, 30 fps**, with music:

```text
out/360-aquarium-short/fourier-aquarium-short-20s.mp4
```

This edit renders the same world geometry through a portrait camera, touring
the whale, manta and knot. It has its own captions and no spherical metadata;
viewers follow the recorded camera. It contains no instructions to drag within
the Short. Its saved project uses the `fourier-aquarium-short` story.

Upload this portrait MP4 as the Short, then set its **Related Video** in
YouTube Studio to the full 360° upload. This matches the Short's invitation to
open the related video and look around. Related videos require advanced
feature access; the linked video must be public or unlisted.

[YouTube Shorts requirements](https://support.google.com/youtube/answer/15424877?hl=en),
[adding a related video](https://support.google.com/youtube/answer/14075157?hl=en)

## Render another version

```powershell
# Faster, lower-resolution test
npm run 360:render -- --width 2048 --duration 10 --preset veryfast
npm run 360:preview -- --video out/360-aquarium/fourier-aquarium-360-10s.mp4

# Retain the higher resolution; change duration and music
npm run 360:render -- --duration 30 --score still-water --level 0.5

# Save and reuse an edit
npm run story -- --story fourier-aquarium-360 --init projects/my-aquarium.json
npm run story:render -- --project projects/my-aquarium.json --out out/my-aquarium
```

The width must be twice the height. Supplying `--width` alone calculates the
height automatically; `--width 3840 --height 2160` is rejected. `params.guides`
in the saved project controls the contour overlay.

Any **3D** film can be placed in a stage, because it carries real XYZ geometry
that can be re-projected onto the sphere. A **2D** film cannot: it is a drawing
on a plane and has no surroundings to reveal. Adding metadata to a flat film
does not reconstruct the missing surroundings either. The reel rack therefore
lists only the 3D films.

## Authoring and verification

A stage is built by `createStage360Story` in
[`src/story/stage360.js`](../src/story/stage360.js); its companion portrait tour
is `createStage360Short`, and both sample one shared world, so the Short can
never drift from the sphere it advertises. The films that can stand in a stage
are registered in [`src/stories/spatial/reels.js`](../src/stories/spatial/reels.js),
and the shipped arrangements are in
[`src/stories/spatial/stages.js`](../src/stories/spatial/stages.js). Spherical
stories set `projection: 'equirectangular'` and use a 2:1 design and export size. The shared
native and browser story exporters add the metadata automatically. The camera
in `src/story/spherical.js` projects from the origin, with forward at -Z, right
at +X and down at +Y. Keep surfaces tessellated and away from the camera origin
and poles; seam-crossing paths are unwrapped and duplicated at both edges.

The MP4 metadata writer changes the movie metadata and relocates video and
audio chunk offsets without re-encoding. It accepts unfragmented H.264 MP4
with one 2:1 video track, rejects unsupported inputs, and can be applied again
without duplicating tags. Tagging currently buffers the MP4 in memory.

```powershell
npm test
npm run test:360-player  # requires the default 20-second film above
npm run test:studio-360  # 360 Studio: placing, aiming, free look, both exports
```

Tests cover projection, back-seam rendering, deterministic animation, loop
closure, metadata recognition, identical decoded audio/video before and after
tagging, and byte-range delivery. The browser check exercises the actual MP4,
including dragging, zoom, playback, audio, seeking and mobile layout.

[Google's V2 metadata specification](https://github.com/google/spatial-media/blob/master/docs/spherical-video-v2-rfc.md)

This format gives viewers control of their viewing direction. Camera movement
through the world, model behaviour and any visible mathematical changes remain
prerecorded.
