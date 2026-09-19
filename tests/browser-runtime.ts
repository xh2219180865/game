import type { GameSession } from '../src/app/session.ts';
import type { GameAudio } from '../src/platform/audio.ts';
import type { GameView } from '../src/render/game.ts';
import { SaveStore } from '../src/app/storage.ts';
import { CARD_IDS, freshProfile } from '../src/core/progress.ts';
import { createBattle } from '../src/core/battle.ts';
import { armyPosition } from '../src/core/geometry.ts';

// Appended only by scripts/runtime.mjs. Production event handlers and clocks are unchanged.
type RuntimeStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function runtimeStorage(storage:RuntimeStorage):RuntimeStorage{
  const prefix='runtime-audit:v1:';
  return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};
}
export function observeRuntime(session:GameSession,audio:GameAudio,view:GameView,localStorage:RuntimeStorage){
  const key='runtime-audit:trace',report=document.querySelector<HTMLElement>('#runtime-report')!;
  let trace:unknown[]=[];try{trace=JSON.parse(localStorage.getItem(key)??'[]') as unknown[];}catch{/* Only audit history may be discarded. */}
  const recentEvents:unknown[]=[];
  const inputState=view as unknown as {gesture:{id:number;source:string|null;drag:boolean;point:{x:number;y:number}}|null};
  const audioState=audio as unknown as {context:AudioContext|null;voices:unknown[]};
  const audioCalls={mutedPlays:0,mutedClicks:0,enabledPlays:0,enabledClicks:0,maxVoicesAfterMutedCall:0};
  const playAudio=audio.play.bind(audio);audio.play=(...args:Parameters<GameAudio['play']>)=>{
    playAudio(...args);if(args[1])audioCalls.enabledPlays++;else{audioCalls.mutedPlays++;audioCalls.maxVoicesAfterMutedCall=Math.max(audioCalls.maxVoicesAfterMutedCall,audioState.voices.length);}
  };
  const clickAudio=audio.click.bind(audio);audio.click=enabled=>{
    clickAudio(enabled);if(enabled)audioCalls.enabledClicks++;else{audioCalls.mutedClicks++;audioCalls.maxVoicesAfterMutedCall=Math.max(audioCalls.maxVoicesAfterMutedCall,audioState.voices.length);}
  };
  function snapshot(){
    const b=session.match?.battle;
    return {at:Date.now(),visibility:document.visibilityState,page:session.page,busy:session.busy,error:session.error,battleId:b?.id??null,gameMs:b?.gameMs??null,battleStatus:b?.status??null,
      rank:session.profile?.rankPoints,inventory:session.profile?.activeInventory,settings:session.profile?.settings,vibrationAvailable:typeof navigator.vibrate==='function',audioCalls:{...audioCalls},
      input:{card:view.card,gesture:inputState.gesture?{id:inputState.gesture.id,source:inputState.gesture.source,drag:inputState.gesture.drag}:null},
      armies:b?.armies.map(a=>({id:a.id,count:a.remainingCount,position:armyPosition(a,b.gameMs),arrivalAtMs:a.arrivalAtMs,volleyState:a.volleyState,volleyCheckAtMs:a.volleyCheckAtMs})),
      camps:b?.camps.map(c=>({id:c.id,owner:c.owner,garrison:c.garrison,nextShotAtMs:c.nextShotAtMs,mobilizeUntil:c.mobilizeUntil,feintUntil:c.feintUntil})),
      audioContext:audioState.context?.state??'not-created',voices:audioState.voices.length,restorationVersion:session.restorationVersion,battleState:b?structuredClone(b):null};
  }
  function record(event:string,details:unknown=null){trace.push({event,details,state:snapshot()});trace=trace.slice(-36);localStorage.setItem(key,JSON.stringify(trace));}
  const cancelInput=view.cancel.bind(view);view.cancel=id=>{record('input.cancel.before');cancelInput(id);record('input.cancel.after');};
  const suspendAudio=audio.suspend.bind(audio);audio.suspend=()=>{record('audio.suspend.before');suspendAudio();record('audio.suspend.after');};
  const suspendSession=session.suspend.bind(session);session.suspend=async()=>{record('session.suspend.before');await suspendSession();record('session.suspend.saved');};
  const events=view.events.bind(view);view.events=batch=>{events(batch);recentEvents.push(...batch.filter(e=>e.type!=='production'));if(recentEvents.length>48)recentEvents.splice(0,recentEvents.length-48);};
  document.addEventListener('visibilitychange',event=>record('visibilitychange',{trusted:event.isTrusted}));
  window.addEventListener('pagehide',event=>record('pagehide',{trusted:event.isTrusted,persisted:event.persisted}));
  window.addEventListener('pageshow',event=>record('pageshow',{trusted:event.isTrusted,persisted:event.persisted}));
  const leaveOnDrag=document.querySelector<HTMLInputElement>('#runtime-leave-drag')!;
  const trackInput=document.querySelector<HTMLInputElement>('#runtime-track-input')!,canvas=document.querySelector<HTMLCanvasElement>('canvas')!,ctx=canvas.getContext('2d')!;
  type InputSample={kind:string;at:number;eventAt:number;trusted:boolean;buttons:number;pointerId:number;x:number;y:number;gameMs:number|null;source:string|null;garrison:number|null};
  const inputTiming:{inputs:InputSample[];frames:unknown[]}={inputs:[],frames:[]};let pendingInput:InputSample|null=null,trackingDraw=false;
  const routePoints:{x:number;y:number}[]=[],previewLabels:string[]=[];
  const lineTo=ctx.lineTo.bind(ctx);ctx.lineTo=(x,y)=>{if(trackingDraw&&ctx.lineWidth===2.5)routePoints.push({x,y});lineTo(x,y);};
  const fillText=ctx.fillText.bind(ctx);ctx.fillText=(...args:Parameters<CanvasRenderingContext2D['fillText']>)=>{if(trackingDraw&&(/^(派 |预计 |.*秒到达|拖向目标)/.test(args[0])))previewLabels.push(args[0]);fillText(...args);};
  for(const kind of ['pointerdown','pointermove','pointerup'] as const)canvas.addEventListener(kind,event=>{
    if(!trackInput.checked||!event.isTrusted||(kind==='pointermove'&&event.buttons!==1))return;
    const r=canvas.getBoundingClientRect(),source=inputState.gesture?.source??null,b=session.match?.battle;
    pendingInput={kind,at:performance.now(),eventAt:event.timeStamp,trusted:event.isTrusted,buttons:event.buttons,pointerId:event.pointerId,x:event.clientX-r.left,y:event.clientY-r.top,gameMs:b?.gameMs??null,source,garrison:b?.camps.find(c=>c.id===source)?.garrison??null};
    inputTiming.inputs.push(pendingInput);if(inputTiming.inputs.length>240)inputTiming.inputs.shift();
  },true);
  const draw=view.draw.bind(view);view.draw=now=>{
    const input=pendingInput;pendingInput=null;trackingDraw=trackInput.checked&&input!==null;routePoints.length=0;previewLabels.length=0;
    try{draw(now);}finally{trackingDraw=false;}
    if(input&&trackInput.checked){
      const finishedAt=performance.now(),g=inputState.gesture,b=session.match?.battle;
      inputTiming.frames.push({input,frameAt:now,finishedAt,eventToDrawMs:finishedAt-input.eventAt,handlerToDrawMs:finishedAt-input.at,gesture:g?{source:g.source,drag:g.drag,point:{...g.point}}:null,routePoints:[...routePoints],previewLabels:[...previewLabels],gameMs:b?.gameMs??null,garrisons:b?.camps.map(c=>({id:c.id,garrison:c.garrison})),armies:b?.armies.filter(a=>a.faction==='P').map(a=>({id:a.id,count:a.remainingCount,source:a.sourceId,target:a.targetId,departedAtMs:a.departedAtMs,position:armyPosition(a,b.gameMs)}))});
      if(inputTiming.frames.length>240)inputTiming.frames.shift();
    }
  };
  trackInput.addEventListener('change',()=>{inputTiming.inputs.length=0;inputTiming.frames.length=0;pendingInput=null;});
  document.querySelector<HTMLCanvasElement>('canvas')!.addEventListener('pointermove',event=>{
    if(leaveOnDrag.checked&&event.isTrusted&&event.buttons===1&&inputState.gesture?.drag){
      leaveOnDrag.checked=false;record('input.drag.leave',{trusted:event.isTrusted,buttons:event.buttons});window.location.assign('/away');
    }
  });
  record('observer.attached');
  const idle=async()=>{while(session.busy)await new Promise<void>(resolve=>setTimeout(resolve,0));};
  const seed=document.querySelector<HTMLButtonElement>('#runtime-seed')!;
  seed.onclick=()=>void (async()=>{
    seed.disabled=true;
    try{
      await session.suspend();await idle();
      const now=Date.now(),p=freshProfile(now,session.profile!.generation);p.nextMatchSequence=session.profile!.nextMatchSequence;
      p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:3,march:3,supply:3,feint:3};p.passiveLevels={farming:2,logistics:2,fortification:2};p.rankPoints=60;p.highestRankPoints=90;
      const battle=createBattle('A01',{id:`${p.generation}:${p.nextMatchSequence++}`,firstDragCompleted:true,inventory:p.activeInventory,passives:p.passiveLevels});
      const archer=battle.camps.find(c=>c.id==='A01-N2')!,tower=battle.camps.find(c=>c.id==='A01-N5')!;archer.owner='P';archer.garrison=20;tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;battle.status='paused';
      p.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:now,startWeekId:p.weekId};
      const store=new SaveStore({async read(k){return localStorage.getItem(k);},async write(k,v){localStorage.setItem(k,v);},async remove(k){localStorage.removeItem(k);}});await store.load();await store.save(p,now);await session.load();
      trace=[];recentEvents.length=0;record('fixture.loaded');
    }catch(error){record('fixture.failed',String(error));}finally{seed.disabled=false;}
  })();
  document.querySelector<HTMLButtonElement>('#runtime-read')!.onclick=()=>void (async()=>{await session.suspend();await idle();await session.load();record('explicit.reload');})();
  setInterval(()=>{report.textContent=JSON.stringify({current:snapshot(),recentEvents,trace,inputTiming},null,2);},200);
}
