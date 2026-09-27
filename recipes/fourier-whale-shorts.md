# Fourier whale with synchronized sound

The existing 3D whale now defaults to **Whale Song**, an original synthesized
whale-like call over a quiet ocean bed. This is sound design, not a recording
of a real whale. It appears in Story Studio's score picker and is embedded in
both browser and native MP4 exports.

Open `projects/fourier-whale-shorts.story.json` in Studio, select **Hear score**,
and press Play to hear the sound with the animation. Selecting a score card
auditions audio from the playhead; the transport plays picture and sound together.

The calls and visible pulses use the same chapter-relative cue function in
`src/story/scores/whaleSong.js`. They accompany the finished opening, surface
reveal, two swimming phrases, and closing whale. Changing chapter durations
retimes both. Selecting another score, disabling audio, or setting its volume
to zero hides the whale-call pulses.

Render the upload edition:

```powershell
node cli/story.mjs --project projects/fourier-whale-shorts.story.json --out out/fourier-whale-youtube-shorts
```

Delivery: 60 seconds, 1080 × 1920, 30 fps, two temporal samples, H.264 High,
yuv420p, Rec.709, stereo AAC at 48 kHz, fast-start MP4. The delivery folder also
contains the WAV soundtrack, editable project, cover, chapter contact sheet,
and technical verification manifest.

Suggested YouTube title: **A Whale Made of Circles 🐋 | 3D Fourier Art #Shorts**

Suggested description:

> Watch rotating circles build a whale in three dimensions. Fourier contours
> become a surface, then come to life with an original synthesized whale song.
> The calls and light pulses share one timeline. Created in Mathloop Studio.
>
> #Shorts #Fourier #MathArt #3DAnimation #Whale
