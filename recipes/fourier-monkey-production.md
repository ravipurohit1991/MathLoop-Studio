# From one circle to a Fourier monkey

The 45-second publication edition of Fourier Monkey.

## Publishing copy

**Title:** One Circle Becomes a Monkey 🐒 | Fourier Series #Shorts

**Description:**

Start with one circle. Add a few more. Watch a monkey take shape.

Rotating circles reconstruct each contour using Fourier series: first the
curled tail, then the body, face, arms, and legs. Colour brings the finished
character to life.

A little maths. A lot of personality.

Original illustration, animation, and music.

#FourierSeries #MathArt #CreativeCoding #Animation #Shorts

## Art direction and timing

- 0–3.75 s: One rotating vector traces a circle.
- 3.75–9.375 s: Add counter-rotating circles, from two terms to eight.
- 9.375–14.25 s: Increase the detail through 16, 32, and 64 Fourier terms.
- 14.25–16.875 s: The curled tail settles into its position in the character.
- 16.875–25.3125 s: Draw the body, head, ears, face, and belly one at a time.
- 25.3125–33.75 s: Trace the arms, hands, and legs, each with its own visible rig.
- 33.75–35.625 s: A top-to-bottom colour reveal fills the completed contours.
- 35.625–42 s: The monkey swings, waves, smiles, and blinks.
- 42–45 s: Return to the first circle for a continuous replay.

Palette: midnight `#0c1923`, jade `#93c7be`, copper `#df986a`, ivory `#f4eee0`.
The art and score are authored in this repository. No downloaded animal audio
or stock music is used. The render uses local Arial fonts; font binaries are
not redistributed.

## Reproduce

```powershell
npm install
npm run monkey:preview
npm run monkey:render
```

The approved upload file is `out/fourier-monkey-final/fourier-monkey-45s-youtube-short.mp4`.
New renders use the shared story pipeline and write
`out/stories/fourier-monkey/fourier-monkey-45s.mp4`, preserving the approved file.
It is 1080 × 1920, 60 fps, 45 seconds (2700 frames), with H.264 High-profile
Rec.709 video and 48 kHz stereo AAC audio. H.264, 4:2:0, 48 kHz stereo audio,
and MP4 fast start follow [YouTube's encoding guidance](https://support.google.com/youtube/answer/1722171?hl=en).

For a 1440 × 2560 master with three temporal samples:

```powershell
node cli/monkey-film.mjs --width 1440 --samples 3 --out out/fourier-monkey-final/master-1440p
```

The renderer also exports a full-resolution cover, a review frame per chapter, a
contact sheet, the original stereo WAV score, and `production.json`. It checks
that all Fourier contours close, that t=0 and t=45 are pixel-identical, and
that the one-frame motion across the join is comparable to ordinary motion.

The opening uses successive prefix sums of the tail's actual DFT coefficients.
Additional vectors are introduced continuously. The drawing phase retains each
completed contour while the active rig traces the next one. The finished
colour surfaces use the same reconstructed contours. The expressions and
skeletal motion are separately authored animation.

Sources: `src/stories/monkey/art.js`, `src/stories/monkey/story.js`, `src/story/score.js`,
`cli/monkey-film.mjs`. This is a separate authored film; the legacy interactive
`fourierMonkey` scene remains available in the studio.
