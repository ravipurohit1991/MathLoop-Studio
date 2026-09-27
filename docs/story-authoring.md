# Make maths into a story

A story answers a sequence of visual questions: what is the simplest element,
what changes when another element is added, how does the pattern become art,
and what makes the finished artwork feel alive?

The monkey's eight chapters are one authored answer. The polar rose is another.
The library provides the timeline, mathematical helpers, drawing tools, audio
and delivery pipeline so a new film does not need to copy those systems.

## Start in the studio

Run `npm run dev` and open http://127.0.0.1:5180.

1. Choose an authored film, or **Turn an SVG into a story**.
2. Select a chapter to edit its title, caption and duration. Titles use up to
   three lines; keep captions short enough to read on a phone.
3. Scrub the playhead or play the sequence. Enable **Hear score** for playback
   with music.
4. Under **The sound**, click any of the seven scores to hear it over the film
   from the playhead. The one left selected is exported; the volume slider is
   saved with the project, and **No score** delivers a silent film.
5. Adjust total length, colours, output size, frame rate and exposed parameters.
6. Use **Animation tracks** for precise control, then **Apply tracks**.
7. Save a project JSON, then export MP4. Local autosave is a convenience; the
   downloaded JSON is the portable edit.

An SVG project embeds sampled paths. It remains reproducible without the source
SVG file. Open paths are retraced to create a periodic Fourier route. SVG import
extracts geometry; it does not reproduce SVG text, filters, gradients or a full
illustration's layered styling. Custom character poses belong in an artwork
module, as they do for the monkey.

## The parts of a film

| Module | Responsibility |
| --- | --- |
| `mathloop/math` | Sampling curves, contour geometry, DFT coefficients, prefix reconstruction |
| `mathloop/story` | Definitions, timeline, chapter anchors, projects, playback, Canvas drawing, score, browser export |
| `mathloop/stories` | Authored monkey and rose, and SVG project resolution |
| `mathloop/node` | Native Canvas rendering, FFmpeg encoding, review assets |
| `mathloop/audio` | DSP helpers, AudioBuffer wrapping and WAV encoding |

Rendering samples a pure timeline. A frame depends on its time and project,
not the frames rendered before it. Seek, preview, temporal sampling and export
therefore use the same animation model. A renderer can allocate resources once
in `createRenderer(context)` and release them in `dispose()`.

## Author a film

```js
import { defineStory, chapterAt, drawStoryTypography } from 'mathloop/story';

export default defineStory({
  id: 'my-film',
  title: 'From a point to a pattern',
  loop: false,
  chapters: [
    { id: 'seed', duration: 3, title: ['Begin with', 'a point.'], caption: 'A place to start.' },
    { id: 'draw', duration: 8, title: ['Let it grow.'], caption: 'Follow the changing radius.' },
    { id: 'reveal', duration: 4, title: ['A pattern.'], caption: 'Made from one rule.' },
  ],
  tracks: {
    radius: [
      { at: chapterAt('seed'), value: 3 },
      { at: chapterAt('draw'), value: 3 },
      { at: chapterAt('draw', 1), value: 300, ease: 'smooth' },
    ],
  },
  render(ctx, frame) {
    ctx.fillStyle = frame.theme.background;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.beginPath();
    ctx.arc(535, 1010, frame.values.radius, 0, Math.PI * 2);
    ctx.strokeStyle = frame.theme.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    drawStoryTypography(ctx, frame, {
      brand: 'MATHS INTO ART', footer: 'THE LIVING EQUATIONS', equation: 'x² + y² = r²',
    });
  },
});
```

The common design surface is 1080 × 1920. The engine scales it to delivery
resolution, preserving aspect ratio with letterboxing. Shared typography is
designed for that portrait surface. A different layout can supply its own
`size` and drawing callback.

Run the included complete spiral example:

```powershell
npm run story:preview -- --module ./examples/spiral-story.js
npm run story:render -- --module ./examples/spiral-story.js
```

## Timeline and animation tracks

`chapterAt('draw', .5)` means halfway through the draw chapter. Extending an
earlier chapter moves this cue with the draw chapter. Extending draw itself
keeps the cue at its midpoint. An optional `offset` adds a fixed number of
seconds. Numeric times are absolute seconds.

Each incoming key chooses its interpolation: `linear`, `smooth`, `smoother`,
`inCubic`, `outCubic`, `inOutCubic` or `hold`. Number and numeric-vector tracks
interpolate continuously; six-digit hex colours interpolate by channel.
Boolean and other string values switch at the next key. Duplicate key times,
unknown chapters, invalid values and out-of-range anchors are rejected.

The frame contains `time`, `duration`, `phase`, `chapter`, `chapterProgress`,
`localTime`, `values`, `theme`, `params`, `seed`, and the saved `project`.
`frame.progress(from, to, easing)` and `frame.since(anchor)` help author motion.

`setStoryDuration(project, 15)` scales all chapter durations, absolute key times
and fixed offsets. It also adjusts explicit score bars to keep the tempo near
the original. Individual chapter edits retain their anchored keys and fixed
offsets; review very short chapters for readability. Changing loop to false
clamps time and ends playback on the last frame. It does not rewrite the
authored outro; edit that chapter if the film needs a different ending.

## Fourier characters and drawings

Use `createFourierContour(points, { harmonics, id })` to compile one contour.
`contourWithTerms(contour, 3.5)` evaluates the first three terms and half the
fourth. It uses the actual coefficients of the finished curve.

`createFourierStory({ id, title, artwork, chapters, tracks, parts })` provides
the one-circle study, the contour construction, colour wipe and common type.
`artwork` contains `contours`, a `studyId`, and optional `placement`, `fills`,
`draw` and `background` callbacks. `parts` maps part IDs to two chapter anchors.
The artist's `draw(ctx, state, paint)` positions each part; `paint` reconstructs
and traces it according to the timeline. The monkey shows reusable arm geometry
posed at different endpoints and a fixed world-space grip.

Keep geometry and pose in `art.js`, and narrative choices in `story.js`.
Custom expressions, faces and skeletal motion are authored animation; Fourier
series reconstruct the coloured contours. This distinction keeps the maths
on screen accurate.

## Authoring spatial Fourier films

`createFourier3DStory` uses the same chapter, track, project, score and export
contracts as `createFourierStory`. Its `dimension: '3d'` metadata places a film
in the 3D collection. Ordinary stories default to `dimension: '2d'`.

Compile a closed spatial contour with
`createFourierCurve3D(points, { id, samples: 128, harmonics: 24, tracePoints: 160 })`.
Input points are finite `[x, y, z]` triples. They are resampled at equal arc
length before computing a real Fourier series for all three coordinates:

```text
r(t) = centre + sum(a[k] cos(2 pi k t) + b[k] sin(2 pi k t))
```

`pointOnCurve3D(curve, t, count)` reconstructs a position, including fractional
harmonic counts. `epicycleChain3D` decomposes each harmonic ellipse into two
counter-rotating circles in that harmonic's plane. Its final tip equals the
reconstructed position. A collinear harmonic becomes two opposing circles.
`closed: false` retraces an open route so it does not draw a straight closing
bridge. `auditCurves3D` verifies the seam and circle-chain reconstruction.

The artwork object supplies:

- `study`: a compiled Fourier curve. The renderer chooses the first loft's
  middle ring as the on-screen study so it can become part of the sculpture.
- `parts`: lofts with an `id`, an ordered array of compiled `curves`, and a
  theme colour key such as `accent` or `guide`. All rings in one loft have the
  same `tracePoints`. Their starting directions and winding should agree.
- `closed: true` on a part joins its last ring to its first, useful for a tube
  around a closed knot. Otherwise, the loft caps its two ends.
- `pose(point, partId, phase, life)`: an optional stateless deformation. Keep
  each attached part's root in place; use `life` to ease into motion at reveal.

The default chapters are `seed`, `combine`, `draw`, `reveal`, `perform` and
`outro`. Tracks `terms`, `study`, `construction`, `skin`, `life` and `orbit` are
anchored to those chapters, so retiming does not detach the action from its
caption. The opening study uses the middle ring of the first loft, centred and
enlarged for a clear view. Only this ring appears in `seed` and `combine`.
During the first 14% of `draw` it settles into its exact surface position;
neighbouring rings start tracing at 8%, with overlapping traces lasting 14%
of the chapter each. The last ring finishes at the start of `reveal`. Neither
full outlines nor the optional mesh overlay expose the sculpture early.
Faint longitudinal strokes connect neighbouring rings as their traces finish. Older
saved edits with an early `study` fade also keep the seed visible during `draw`.
The 60-second spatial showcase uses a five-second hook and gives the five
seconds saved to `draw`, leaving the other chapter durations intact. Custom chapters
can replace their titles and durations. Custom track
sets must still supply the values the spatial renderer consumes.

Camera parameters are `cameraYaw` and `cameraPitch` in degrees, `orbitAmount`
in degrees and `zoom`. `guideMode` is `circles`, `spheres` or `none`;
`wireframe` enables a surface mesh overlay. Sphere cages visualize the radii
of the rotating circles; they are not spherical-harmonic basis functions.
The shaded mesh uses the reconstructed curves as its vertices, with small
depth-sorted faces. It is a lightweight software renderer for these authored
sculptures; intersecting arbitrary meshes may need a depth-buffer renderer.

See [the spatial starter](../examples/spatial-story.js) and
[`src/stories/spatial/art.js`](../src/stories/spatial/art.js). The provided
whale has articulated flippers and a travelling tail wave; the manta flexes its
wings; the trefoil's camera reveals the crossings. Creature motion is authored
deformation, while the geometry is reconstructed with Fourier series.

### Scores

`audio.score` names one of seven original scores -- `still-water`,
`paper-lanterns`, `aurora-glass`, `driftwood`, `deep-current`,
`little-clockwork` or `construction` -- and every authored film names the one it
was written for. `audio.level` from 0 to 1 trims the volume, and
`audio.enabled: false` delivers a silent film. `npm run story -- --scores` lists
them; `--score` and `--level` override a render from the command line.

A score is arranged against the film's chapters, not a fixed clock: it reads
`intro`, `build` and `outro` from the timeline and takes its cues from
`audio.transitions` and `audio.greeting`. Scores can also set integer
`audio.transpose` from -24 to 24 semitones, `audio.tempoFeel: 'drift'` for
sparser percussion, `audio.seed`, and a whole number of `audio.bars`. Defaults
preserve existing scores.

Six of the seven are levelled together by loudness -- about -24 dBFS RMS under a
soft ceiling -- and rolled off above the band the ear tires of, so changing score
changes the mood without changing the volume. `construction` is the original
mallet score, kept byte for byte, and is much the louder.

To write another one, add an entry to
[`src/story/scores/library.js`](../src/story/scores/library.js) with a `mix` and
a `compose(ctx)` that schedules notes through `ctx.event`; the instruments are in
[`voices.js`](../src/story/scores/voices.js) and the stage in
[`arrangement.js`](../src/story/scores/arrangement.js).

## Delivery

```powershell
# Save a starting edit, review its chapters, then render the master.
npm run story -- --story fourier-monkey --init projects/monkey.json
npm run story:preview -- --project projects/monkey.json --width 540
npm run story:render -- --project projects/monkey.json --out out/my-film

# Fast review of a retimed film.
npm run story:render -- --story fourier-monkey --duration 15 --width 360 --fps 30 --samples 1
```

The native renderer requires the optional `@napi-rs/canvas` dependency, FFmpeg
and ffprobe. On Windows, Arial
regular and bold are registered as Film Sans. Elsewhere, use `--font` for
regular and bold files to keep typography consistent. Font binaries are not
included; different fonts or rendering backends can produce different pixels.

Default delivery is 1080 × 1920, 60 fps, two temporal samples, H.264 High,
yuv420p, Rec.709, CRF 14, fast-start MP4, and 48 kHz stereo AAC. The native
score gets a +0.5 dB mix gain; browser export uses the score at unity gain and
the existing WebCodecs encoder. These are visually equivalent workflows, not
byte-identical encoders. A duration is rounded to the nearest whole frame in
native delivery; the manifest records requested and encoded duration.

The output folder contains `project.json`, `production.json`, `cover.png`,
`contact-sheet.png`, chapter review PNGs, `original-score.wav` when enabled,
and the MP4. The manifest records Fourier closure where available, exact loop
boundary pixels, adjacent-frame differences and ffprobe output. Inspect the
contact sheet and motion around the join: matching t=0 and t=duration alone
does not prove a smooth loop. Cancellation removes the temporary MP4 and
preserves a previously completed video.

Use `renderStoryProject({ story, project, out, onProgress, signal })` from
`mathloop/node` for Node automation. In browsers use
`renderStoryVideo({ engine, onProgress, signal })`; it delegates to the
WebCodecs exporter in `src/export/`. Scores use a deterministic seed, whole bars fitted to the
duration, chapter-aligned transitions and circular note tails for loops.
Procedural scores currently support films up to ten minutes.

## Projects and validation

`src/shorts/fourierMonkeyFilm.js` and `monkeyScore.js` are compatibility
wrappers. `monkey:preview` and `monkey:render` call the generic renderer and
write to `out/stories/fourier-monkey`; the previously approved publication
folder is preserved.

Saved story projects are versioned JSON data and contain no executable code.
Code-authored stories need their definition module alongside the saved edit.

```powershell
npm run test:story
npm run test:studio
npm test
npm run build
```

The story tests cover retiming, boundary behaviour, random-access rendering,
project round trips, invalid input, Fourier sums, audio determinism and resource
disposal. In the original workspace, 22 saved monkey frames are also compared
pixel for pixel with the approved film, and its 45-second WAV has a fixed hash.
Browser integration exercises chapter edits, seeking, playback, persistence,
SVG round trips, the authored-film picker and an MP4 with audio.
