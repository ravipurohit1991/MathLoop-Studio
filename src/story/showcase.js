import { defineStory } from './definition.js';
import { createTimeline } from './timeline.js';
import { createStoryProject } from './project.js';

const at=(chapter,progress=0)=>({chapter,progress});
const key=(chapter,progress,value,ease='smooth')=>({at:at(chapter,progress),value,ease});

/** A finished opening, the construction, then the same finished state at the seam. */
export function createShowcaseEdit(story, input, { duration=60, hookDuration=story.dimension==='3d'?5:10, finishDuration=4 } = {}) {
  const project=createStoryProject(story,input),source=createTimeline(project);
  if(source.chapters.some(c=>c.id==='hook'))throw new Error('This project already has a finished-art opening.');
  const perform=source.chapters.find(c=>c.id==='perform'),outro=source.chapters.find(c=>c.id==='outro');
  if(!perform||!outro||outro!==source.chapters.at(-1))throw new Error('A showcase edit needs a performance and a final outro chapter.');
  if(![duration,hookDuration,finishDuration].every(Number.isFinite)||hookDuration<=0||finishDuration<=0||duration<=hookDuration+finishDuration)throw new Error('Leave time for the opening, construction and finished ending.');
  const available=duration-hookDuration-finishDuration;
  // Give the shorter spatial opening's time to assembly, keeping the other
  // chapters at their existing pace in the standard 60-second films.
  const assemblyBonus=story.dimension==='3d'?Math.min(Math.max(0,10-hookDuration),available/2):0;
  const rate=(available-assemblyBonus)/outro.start;
  const title=perform.title.slice(),caption='The finished artwork. The circles that draw it.';
  const chapters=[
    {id:'hook',duration:hookDuration,title,caption},
    ...project.chapters.filter(c=>c.id!=='outro').map(c=>({...c,duration:c.duration*rate+(c.id==='draw'?assemblyBonus:0)})),
    {id:'outro',duration:finishDuration,title,caption},
  ];
  chapters.at(-1).duration=duration-chapters.slice(0,-1).reduce((sum,c)=>sum+c.duration,0);
  // Derive the completed pose from the film, then keep its visible anatomy alive.
  const complete={...source.at(perform.start+perform.duration*.4).values,
    terms:story.artwork?.study?.terms.length??story.artwork?.contours?.[story.artwork.studyId]?.chain.length??64,
    study:0,studyOpacity:0,studyLabel:0,studyRigs:0,studyRigFade:0,studyZoom:1,
    artOpacity:1,fill:1,skin:1,construction:1,life:1,wave:1,branch:1,faceOpacity:1,
  };
  const tracks={};
  for(const [name,compiled]of Object.entries(source.tracks)){
    const build=compiled.filter(k=>k.time>0&&k.time<perform.start).map(k=>{
      const c=source.chapters.find(c=>k.time<c.end)??source.chapters.at(-1);
      return key(c.id,(k.time-c.start)/c.duration,k.value,k.ease);
    });
    // The finished opening cuts to the single-element study.
    const value=complete[name]??compiled.at(-1).value;
    tracks[name]=[key('hook',0,value),key('seed',0,source.at(0).values[name],'hold'),...build,key('perform',0,value),key('outro',1,value)];
  }
  const shading=[key('hook',0,1),key('hook',.16,1),key('hook',.3,0),key('hook',.62,0),key('hook',.82,1)];
  for(const name of ['fill','skin'])if(tracks[name])tracks[name]=[...shading,...tracks[name].filter(k=>k.at.chapter!=='hook')];
  tracks.showcase=[key('hook',0,1),key('seed',0,0,'hold'),key('perform',0,1,'hold')];
  tracks.guideOpacity=[key('hook',0,.3),key('hook',.16,.3),key('hook',.3,.8),key('hook',.62,.8),key('hook',.82,.3),key('seed',0,0,'hold'),key('reveal',0,0),key('perform',0,.3),key('outro',1,.3)];
  tracks.wire=[key('hook',0,0),key('hook',.16,0),key('hook',.3,1),key('hook',.62,1),key('hook',.82,0),key('seed',0,0),key('outro',1,0)];
  if(tracks.orbit)tracks.orbit=[key('hook',0,0),key('outro',1,1,'linear')];
  if(tracks.motionPhase){
    const velocity=4*Math.PI/hookDuration;
    tracks.motionPhase=[key('hook',0,0),key('hook',.999,4*Math.PI*.999,'linear'),key('seed',0,0,'hold'),key('reveal',0,0),key('outro',0,4*Math.PI-velocity*finishDuration,'linear'),key('outro',1,4*Math.PI,'linear')];
  }
  const audio={...project.audio,bars:32,transitions:['seed',...new Set(project.audio.transitions??['combine','draw','reveal','perform'])]};
  return {...project,chapters,tracks,audio};
}

export function createShowcaseStory(story, options) {
  const edit=createShowcaseEdit(story,undefined,options);
  return defineStory({...story,chapters:edit.chapters,tracks:edit.tracks,audio:edit.audio,
    edition:'showcase',constructionStory:story,
    requiredTracks:[...new Set([...(story.requiredTracks??[]),'showcase','guideOpacity','wire'])],
    description:`${story.description} A finished-art opening leads into the construction and loops back to the reveal.`,
  });
}
