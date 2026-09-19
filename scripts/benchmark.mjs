import { performance } from 'node:perf_hooks';
import { createBattle } from '../src/core/battle.ts';
import { advanceSimulation } from '../src/core/ai.ts';

function run(id){
  const b=createBattle(id,{id:`bench-${id}`}),samples=[];let frame=0;
  while(b.status==='running'){
    const start=performance.now();advanceSimulation(b,Math.min(240000,Math.round(++frame*1000/30)));samples.push(performance.now()-start);
  }
  samples.sort((a,z)=>a-z);return {mapId:id,gameMs:b.gameMs,frames:frame,p95Ms:samples[Math.floor(samples.length*.95)],p99Ms:samples[Math.floor(samples.length*.99)],maxMs:samples.at(-1),result:b.result.playerRank};
}
for(const id of ['A01','A02','A03'])run(id);
global.gc?.();const before=process.memoryUsage().heapUsed,start=performance.now(),runs=[];
for(let i=0;i<20;i++){const result=run(['A01','A02','A03'][i%3]);global.gc?.();runs.push({...result,retainedHeapBytes:process.memoryUsage().heapUsed});}
global.gc?.();console.log(JSON.stringify({runtime:process.version,platform:process.platform,architecture:process.arch,scope:'Node rule simulation at 30 game frames/s; not device rendering FPS',wallMs:performance.now()-start,beforeHeapBytes:before,afterHeapBytes:process.memoryUsage().heapUsed,runs},null,2));
