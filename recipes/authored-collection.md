# Circles into life / production collection

Fourteen showcase films have a finished-art opening, construction, reveal,
performance and return to the opening, all in 60 seconds. The polar rose is
also available in the studio. The collection command includes every showcase
film automatically; `--story` selects a single film.

| Film | Dimension | Duration | Direction |
| --- | --- | --- | --- |
| A whale, drawn through space. | 3D | 60 s | Glacier blue, mint fins, a slow tail wave, an orbit that reveals depth |
| Manta Ray: Fourier in 3D | 3D | 60 s | Violet manta, travelling wing motion, a view above the wings |
| An impossible-looking loop. | 3D | 60 s | Gold trefoil, a continuous tube, an orbit around its three crossings |
| The butterfly effect. In circles. | 2D | 60 s | Copper and plum wings, ivory eyespots, delicate veins and a first flutter |
| A koi. A little quiet magic. | 2D | 60 s | Jade water, porcelain and vermilion, fine scales and a swaying tail |
| Fourier monkey | 2D | 60 s | An articulated character, a fixed grip and a greeting |
| Four wings. One equation. | 2D | 60 s | Glass wings, a jade body and a hovering dragonfly |
| A curl of the sea. | 2D | 60 s | Amber armour, bony rings and a curled seahorse tail |
| A bell that breathes. | 3D | 60 s | A pulsing jellyfish bell and trailing tentacles |
| A shell that keeps its ratio. | 3D | 60 s | A spiral nautilus shell with chamber walls |
| Who draws the night? | 2D | 60 s | Moon-blue owl, amber eyes, a slow blink and a curious tilt |
| A little wild in the equations. | 2D | 60 s | Russet fox, cream-tipped tail and a listening pose |
| The geometry of taking it slow. | 3D | 60 s | Olive shell, jade flippers and a steady sea turtle glide |
| A bloom in three dimensions. | 3D | 60 s | Twenty-one rose and ivory petals opening around a golden centre |

## Reproduce the collection

```powershell
npm run collection:preview -- --width 540
npm run collection
npm run collection -- --story fourier-whale-3d --fps 60
```

The collection command defaults to 1080 × 1920, 30 fps and two temporal
samples, with CRF 14 H.264 High, Rec.709, fast start and the original 48 kHz
stereo score. `--fps 60` produces 60 fps masters. Each folder contains a cover,
chapter contact sheet, WAV score, saved edit and production manifest. The
manifest verifies dimensions, timing, codec and Fourier closure. Projects
under `projects/` are starting edits at the studio's 60 fps defaults.

## Editorial notes

The opening asks a visual question, construction makes the mechanism visible,
and colour rewards the wait. Short captions avoid competing with the drawing.
The camera is part of the authored timeline and is reproduced in every export.
The spatial films open for five seconds, then study a single ring in steps 2
and 3. Step 4 gets the five seconds saved from the opening: the study settles
into place and individual rings slowly trace the sculpture around it. The
surface appears only after all the contours have formed.
The smaller sphere cages are optional guides; the visible spatial signal is
a sum of rotating circles. This distinction should remain in educational copy.

The 2D films use independently reconstructed contours for anatomy and colour
patches. Decorative markings and character poses are authored illustration.
The 3D films loft reconstructed contours and use faceted directional shading.
Camera orbit, wing motion and tail motion are authored, not outputs of a
physical simulation.

Potential video titles: “Can circles draw a whale in 3D?”, “I taught circles
to fly underwater”, “This knot is just rotating circles”, “A butterfly made of
Fourier circles”, and “From one circle to a swimming koi”. These are creative
starting points; audience response has not been measured.

Do a final full-screen playback before publication, especially after changing
camera zoom or chapter timings. The app exports locally; it does not publish
to YouTube.
