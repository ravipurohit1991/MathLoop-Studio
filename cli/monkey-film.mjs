// Kept for existing recipes; all films now use the shared renderer.
import { runStoryCli } from './story.mjs';
runStoryCli(process.argv.slice(2),{story:'fourier-monkey',out:'out/stories/fourier-monkey'})
  .catch(error=>{console.error(error.message);process.exitCode=1;});
