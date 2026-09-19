import { GameAudio } from '../src/platform/audio.ts';
import type { BattleEvent } from '../src/core/types.ts';

// Real Web Audio nodes, with a silent output bus; never included in shipping builds.
export async function runBrowserAudioAudit(){
  const checks:{name:string;expected:unknown;actual:unknown;passed:boolean}[]=[];
  const connectedOscillators=new Set<OscillatorNode>(),connectedGains=new Set<GainNode>();
  let created=0,maxConnected=0,immediateStops=0,ended=0;
  const context=new AudioContext(),silent=context.createGain();silent.gain.value=0;silent.connect(context.destination);
  const port=new Proxy(context,{get(target,key){
    if(key==='destination')return silent;
    if(key==='createOscillator')return ()=>{
      const osc=target.createOscillator(),connect=osc.connect.bind(osc),disconnect=osc.disconnect.bind(osc),stop=osc.stop.bind(osc);created++;
      osc.connect=((...args:Parameters<OscillatorNode['connect']>)=>{const result=Reflect.apply(connect,osc,args);connectedOscillators.add(osc);maxConnected=Math.max(maxConnected,connectedOscillators.size);return result;}) as OscillatorNode['connect'];
      osc.disconnect=()=>{disconnect();connectedOscillators.delete(osc);};
      osc.stop=(at?:number)=>{if(at===undefined)immediateStops++;stop(at);};
      osc.addEventListener('ended',()=>{ended++;});return osc;
    };
    if(key==='createGain')return ()=>{
      const gain=target.createGain(),connect=gain.connect.bind(gain),disconnect=gain.disconnect.bind(gain);
      gain.connect=((...args:Parameters<GainNode['connect']>)=>{const result=Reflect.apply(connect,gain,args);connectedGains.add(gain);return result;}) as GainNode['connect'];
      gain.disconnect=()=>{disconnect();connectedGains.delete(gain);};return gain;
    };
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  let audio=new GameAudio(()=>port),failure:string|null=null;
  const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
  const event=(id:number,type:BattleEvent['type']):BattleEvent=>({id,type,atMs:0});
  const check=(name:string,actual:unknown,expected:unknown)=>{
    const passed=JSON.stringify(actual)===JSON.stringify(expected);checks.push({name,expected,actual,passed});if(!passed)throw new Error(name);
  };
  const resources=()=>({oscillators:connectedOscillators.size,gains:connectedGains.size,voices:(audio as unknown as {voices:unknown[]}).voices.length});
  const empty={oscillators:0,gains:0,voices:0};
  try{
    audio.unlock();await context.resume();check('native context running',context.state,'running');
    const first=created;audio.play([event(1,'dispatch')],true,'coalesce');audio.play([event(2,'dispatch')],true,'coalesce');
    check('same-category immediate calls merge',created-first,1);
    await wait(130);audio.play([event(3,'dispatch')],true,'coalesce');check('later category call plays',created-first,2);
    await wait(130);audio.play([event(3,'dispatch')],true,'coalesce');check('replayed event stays silent after cooldown',created-first,2);
    audio.stop();check('explicit stop disconnects nodes',resources(),empty);

    audio=new GameAudio(()=>port);audio.unlock();const burst=created,stops=immediateStops;
    for(const [i,type]of (['dispatch','arrival','card','tower-shot'] as const).entries())audio.play([event(i+1,type)],true,'burst');
    check('four distinct categories connect four voices',resources(),{oscillators:4,gains:4,voices:4});
    audio.play([event(5,'capture')],true,'burst');audio.play([{...event(6,'result'),faction:'P'}],true,'burst');
    check('two higher-priority sounds preempt two nodes',immediateStops-stops,2);check('preemption keeps four connected voices',resources(),{oscillators:4,gains:4,voices:4});
    audio.click(true);check('lower-priority click cannot exceed ceiling',created-burst,6);
    await wait(450);check('native ended callbacks release every voice',resources(),empty);

    audio=new GameAudio(()=>port);audio.unlock();const muted=created;
    audio.play([event(1,'capture')],false,'mute');await wait(130);audio.play([event(1,'capture')],true,'mute');check('muted history is not queued for unmute',created-muted,0);
    audio.play([event(2,'capture')],true,'mute');check('new unmuted event plays',created-muted,1);
    audio.play([],false,'mute');check('muting disconnects active nodes immediately',resources(),empty);
    audio.play([event(3,'result')],true,'mute');check('sound exists before suspension',resources(),{oscillators:1,gains:1,voices:1});
    audio.suspend();check('suspend disconnects before awaiting context',resources(),empty);await context.suspend();check('native context suspended',context.state,'suspended');
    audio.unlock();await context.resume();const resumed=created;audio.play([event(2,'capture')],true,'mute');check('resume does not replay past events',created-resumed,0);
    audio.play([event(4,'dispatch')],true,'mute');check('new event plays after resume',created-resumed,1);
    audio.play([event(2,'card')],true,'mute',1);audio.play([event(2,'card')],true,'mute',1);check('restored lower event ID plays exactly once',created-resumed,2);
    audio.suspend();check('final suspension releases restored voices',resources(),empty);
  }catch(error){failure=String(error);}
  finally{audio.stop();silent.disconnect();await context.close();}
  return {passed:failure===null,failure,method:'Real AudioContext with native oscillator/gain nodes and real wall-clock delays; final output bus is muted. Boundary-exact100ms/500ms checks remain in Node tests.',checks,createdOscillators:created,maxConnectedOscillators:maxConnected,immediateStops,nativeEndedEvents:ended,finalResources:resources(),contextState:context.state,limits:['Controlled event batches, not normal player play or physical listening.','Direct GameAudio suspension, not an OS background/lifecycle event.','Silent output bus is a test-only gain node excluded from per-voice counts.']};
}
