import { GameSession } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { GameAudio } from '../src/platform/audio.ts';
import { advanceSimulation, chooseAiAction } from '../src/core/ai.ts';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { validateBattle } from '../src/app/validation.ts';
import { CARD_IDS, claimChoice, freshProfile, settleMatch } from '../src/core/progress.ts';
import { createStatePressure } from './pressure-fixture.ts';
import { createMixedPressure } from './mixed-pressure-fixture.ts';
import { runBrowserAudioAudit } from './browser-audio.ts';
import { loadArt } from '../src/render/assets.ts';

await loadArt(()=>new Image());

const canvas=document.querySelector<HTMLCanvasElement>('canvas')!,ctx=canvas.getContext('2d')!;
const testWidth=Number(new URLSearchParams(location.search).get('width'));
if([320,375,430].includes(testWidth)){canvas.style.width=`${testWidth}px`;canvas.style.height=`${testWidth===320?568:testWidth===375?812:932}px`;}
const status=document.querySelector<HTMLElement>('#status')!,report=document.querySelector<HTMLElement>('#report')!,button=document.querySelector<HTMLButtonElement>('button')!;
if(new URLSearchParams(location.search).get('grayscale')==='true')canvas.style.filter='grayscale(1)';
const session=new GameSession({storage:{async read(){return null;},async write(){},async remove(){}},now:Date.now,random:()=>.3,notify:()=>{},events:()=>{}});
const view=new GameView(ctx,session);
const now=Date.now(),profile=freshProfile(now,'render-benchmark');session.profile=profile;
profile.firstDragCompleted=true;profile.tutorialFirstWins=['L01','L02','L03'];profile.unlockedCardIds=[...CARD_IDS];
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,3);canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);view.viewport={width:r.width,height:r.height,top:16,bottom:12};}
resize();window.addEventListener('resize',resize);
const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
const quantile=(samples:number[],p:number)=>[...samples].sort((a,b)=>a-b)[Math.min(samples.length-1,Math.floor(samples.length*p))]??0;
type Run={mapId:string;ruleRevision:string;gameMs:number;frames:number;rank:number;wallMs:number;fps:number;frameP95Ms:number;workP95Ms:number;drawP95Ms:number;workMaxMs:number;maxArmies:number;maxEffects:number;maxVoices:number;effectsAfter:number;seenAfter:number;voicesAfter:number;heapBytes:number|null};
button.addEventListener('click',()=>void run());
const audioButton=document.createElement('button');audioButton.textContent='检查音效并发（静音输出）';button.after(audioButton);
audioButton.addEventListener('click',()=>void (async()=>{
  if(button.disabled)return;
  const buttons=[...document.querySelectorAll('button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>{b.disabled=true;});status.textContent='正在检查真实音频节点…';
  try{const result=await runBrowserAudioAudit();report.textContent=JSON.stringify(result,null,2);status.textContent=result.passed?'音频节点检查通过':'音频节点检查失败，请查看报告';}
  catch(error){status.textContent=`音频节点检查未完成：${String(error)}`;}
  finally{buttons.forEach((b,i)=>{b.disabled=disabled[i]!;});}
})());
const crowdButton=document.createElement('button');crowdButton.textContent='检查 256 队拥挤场景';button.after(crowdButton);crowdButton.addEventListener('click',()=>void crowd());
let statePressure:ReturnType<typeof createStatePressure>|null=null;
let pressureSequence=0;
const stateButton=document.createElement('button');stateButton.textContent='载入多城 256 队状态';crowdButton.after(stateButton);
const stateRun=document.createElement('button');stateRun.textContent='推进多城压力至到达';stateRun.disabled=true;stateButton.after(stateRun);
stateButton.addEventListener('click',()=>{
  statePressure=createStatePressure(`state-pressure-${++pressureSequence}`);const {battle,events}=statePressure;validateBattle(battle);
  profile.activeMatch={battle,modeId:'arena-four',rankedCommitment:false,realStartedAt:now,startWeekId:profile.weekId};session.page='battle';view.events(events);view.draw(performance.now());stateRun.disabled=false;
  status.textContent='已载入 v1.5 历史直达压力：四方各 64 队，9 城各有征兵和停产状态；只用测试数据。';
  report.textContent=JSON.stringify({ruleRevision:battle.ruleRevision,gameMs:battle.gameMs,armies:battle.armies.length,camps:battle.camps.map(c=>({id:c.id,owner:c.owner,garrison:c.garrison,feintUntil:c.feintUntil,mobilizeUntil:c.mobilizeUntil}))},null,2);
});
stateRun.addEventListener('click',()=>void crowd(true));
let mixedPressure:ReturnType<typeof createMixedPressure>|null=null;
const mixedButton=document.createElement('button');mixedButton.textContent='载入混合交战 256 队';stateRun.after(mixedButton);
const mixedRun=document.createElement('button');mixedRun.textContent='推进混合压力至结束';mixedRun.disabled=true;mixedButton.after(mixedRun);
function lockControls(){const buttons=[...document.querySelectorAll('button')],previous=buttons.map(b=>b.disabled);buttons.forEach(b=>{b.disabled=true;});return ()=>buttons.forEach((b,i)=>{b.disabled=previous[i]!;});}
mixedButton.addEventListener('click',()=>{
  mixedPressure=createMixedPressure(`mixed-pressure-${++pressureSequence}`);const {battle,events}=mixedPressure;
  profile.settings.reducedMotion=new URLSearchParams(location.search).get('motion')==='reduced';
  profile.activeMatch={battle,modeId:'arena-four',rankedCommitment:false,realStartedAt:now,startWeekId:profile.weekId};session.page='battle';view.events(events);view.draw(performance.now());mixedRun.disabled=false;
  status.textContent='已载入 v1.5 历史直达压力：9 城、256 队混合行军；全部出征、升级及施策经正式规则执行，仅内存测试数据。';
  report.textContent=JSON.stringify({phase:'initial',canvas:view.viewport,reducedMotion:profile.settings.reducedMotion,battle,setupEvents:events},null,2);
});
mixedRun.addEventListener('click',()=>void mixed());
async function run(){
  const unlock=lockControls(),runs:Run[]=[];let context:AudioContext|null=null,audio:GameAudio|null=null;
  try{
    Object.assign(profile,freshProfile(now,'render-benchmark'));profile.firstDragCompleted=true;profile.tutorialFirstWins=['L01','L02','L03'];profile.unlockedCardIds=[...CARD_IDS];
    try{context=new AudioContext();const silent=context.createGain();silent.gain.value=0;silent.connect(context.destination);
      const port=new Proxy(context,{get(target,key){if(key==='destination')return silent;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
      audio=new GameAudio(()=>port);audio.unlock();
    }catch{/* Record audio absence separately; rendering remains measurable. */}
    const start=performance.now();
    for(let index=0;index<20;index++){
      const mapId=(['A01','A02','A03'] as const)[index%3]!,battle=createBattle(mapId,{id:`render-${index}`,firstDragCompleted:true,inventory:profile.activeInventory,passives:profile.passiveLevels});
      if(battle.ruleRevision!=='1.6')throw new Error('Standard benchmark must use current road rules');
      profile.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:now,startWeekId:profile.weekId};session.page='battle';view.draw(performance.now());
      const gaps:number[]=[],work:number[]=[],draw:number[]=[];let previous=await frame(),wallStart=previous,maxArmies=0,maxEffects=0,maxVoices=0,nextPlayerAt=8000;
      while(battle.status==='running'){
        const tick=await frame();gaps.push(tick-previous);previous=tick;const before=performance.now();
        if(battle.gameMs>=nextPlayerAt){nextPlayerAt+=3500;const action=chooseAiAction(battle,'P');if(action){const result=applyBattleAction(battle,action);view.events(result.events);audio?.play(result.events,true,battle.id);}}
        const events=advanceSimulation(battle,Math.min(240000,battle.gameMs+250));view.events(events);audio?.play(events,true,battle.id);
        const drawStart=performance.now();view.draw(drawStart);draw.push(performance.now()-drawStart);work.push(performance.now()-before);
        const resources=view as unknown as {effects:unknown[];seenEffects:Set<string>},voices=(audio as unknown as {voices:unknown[]}|null)?.voices.length??0;
        maxArmies=Math.max(maxArmies,battle.armies.length);maxEffects=Math.max(maxEffects,resources.effects.length);maxVoices=Math.max(maxVoices,voices);
        if(resources.effects.length>100||resources.seenEffects.size>400||voices>4)throw new Error('Transient resource bound exceeded');
        if(battle.gameMs%10000===0)status.textContent=`进行中 ${index+1}/20 · ${mapId} · ${battle.gameMs/1000} 游戏秒 · ${battle.armies.length} 队`;
      }
      profile.activeInventory={...factionOf(battle,'P')!.inventory};
      const result=settleMatch(profile,battle.id,now,'natural',()=>.3);session.page='result';view.draw(performance.now());
      if(profile.choice?.state==='pending')claimChoice(profile,profile.choice.choiceId,profile.choice.candidateIds[0]!,now);
      if(profile.latestResult)profile.latestResult.resultAcknowledged=true;session.page='home';audio?.stop();view.draw(performance.now());
      const resources=view as unknown as {effects:unknown[];seenEffects:Set<string>},voices=(audio as unknown as {voices:unknown[]}|null)?.voices.length??0;
      if(resources.effects.length||resources.seenEffects.size||voices)throw new Error('Previous match resources were retained');
      const wallMs=performance.now()-wallStart;
      runs.push({mapId,ruleRevision:battle.ruleRevision,gameMs:battle.gameMs,frames:gaps.length,rank:result.result!.playerRank,wallMs,fps:gaps.length*1000/wallMs,frameP95Ms:quantile(gaps,.95),workP95Ms:quantile(work,.95),drawP95Ms:quantile(draw,.95),workMaxMs:Math.max(...work),maxArmies,maxEffects,maxVoices,effectsAfter:resources.effects.length,seenAfter:resources.seenEffects.size,voicesAfter:voices,heapBytes:(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??null});
      status.textContent=`已完成 ${index+1}/20 局；每局结束特效、事件缓存、声部均已释放。`;
    }
    report.textContent=JSON.stringify({scope:'Actual browser Canvas rendering with v1.6 road rules and automated player decisions from 8 s, every 3.5 s; 250 game ms per rAF (accelerated), not normal-speed mobile FPS or human playtesting. In-memory settlement; no user save.',userAgent:navigator.userAgent,canvas:{width:view.viewport.width,height:view.viewport.height},audioAvailable:!!context,wallMs:performance.now()-start,runs},null,2);
    status.textContent='完成 20/20；详细记录见下方。';
  }catch(e){status.textContent=`失败：${String(e)}`;report.textContent=JSON.stringify({runs},null,2);}
  finally{audio?.stop();await context?.close();unlock();statePressure=null;mixedPressure=null;stateRun.disabled=true;mixedRun.disabled=true;}
}
async function crowd(multi=false){
  if(multi&&!statePressure)return;
  const unlock=lockControls();
  try{
    const battle=multi?statePressure!.battle:createBattle('L03',{id:'crowd',firstDragCompleted:true});
    if(!multi){const source=battle.camps.find(c=>c.id==='L03-P2')!;for(let sequence=1;sequence<=256;sequence++){source.garrison=2;const result=applyBattleAction(battle,{kind:'dispatch',faction:'P',sequence,sourceId:source.id,targetId:'L03-N2'});if(!result.ok)throw new Error(result.reason);}}
    validateBattle(battle);const bytes=new TextEncoder().encode(JSON.stringify(battle)).length,arrival=battle.armies[0]!.arrivalAtMs;
    profile.activeMatch={battle,modeId:multi?'arena-four':'tutorial',rankedCommitment:false,realStartedAt:now,startWeekId:profile.weekId};session.page='battle';view.draw(performance.now());
    const draws:number[]=[],gaps:number[]=[];let last=await frame(),maxEffects=0;
    for(let i=1;i<=300;i++){
      const tick=await frame();gaps.push(tick-last);last=tick;
      const events=advanceBattle(battle,Math.floor(i*(arrival-1)/300));view.events(events);
      if(battle.armies.length!==256)throw new Error('An in-flight record was lost before arrival');
      const start=performance.now();view.draw(start);draws.push(performance.now()-start);
      maxEffects=Math.max(maxEffects,(view as unknown as {effects:unknown[]}).effects.length);
      if(i%30===0)status.textContent=`256 队拥挤场景：${i}/300 帧，全部队伍保留。`;
    }
    const events=advanceBattle(battle,arrival),arrivals=events.filter(e=>e.type==='arrival').length;view.events(events);view.draw(performance.now());
    if(arrivals!==256||battle.armies.length!==0)throw new Error('Arrival batch was truncated');
    report.textContent=JSON.stringify({scope:'Actual Canvas, 300 rendered frames across one real journey of 256 fixture armies. Source soldiers are replenished during test setup only; no player reward or save.',ruleRevision:battle.ruleRevision,multiCamp:multi,canvas:view.viewport,armies:256,serializedBytes:bytes,arrivals,remainingArmies:battle.armies.length,maxEffects,fps:300000/gaps.reduce((a,b)=>a+b,0),frameP95Ms:quantile(gaps,.95),drawP95Ms:quantile(draws,.95),drawMaxMs:Math.max(...draws),camps:multi?battle.camps.map(c=>({id:c.id,owner:c.owner,garrison:c.garrison,feintUntil:c.feintUntil,mobilizeUntil:c.mobilizeUntil})):undefined},null,2);
    status.textContent=`v${battle.ruleRevision} ${battle.ruleRevision==='1.5'?'历史直达':'相邻道路'} 256 队检查完成：300 帧无丢队，到达批全部处理。`;
  }catch(e){status.textContent=`失败：${String(e)}`;}
  finally{unlock();statePressure=null;mixedPressure=null;stateRun.disabled=true;mixedRun.disabled=true;}
}
async function mixed(){
  if(!mixedPressure)return;
  const unlock=lockControls(),{battle,events:setupEvents}=mixedPressure,initial=structuredClone(battle),end=Math.max(...battle.armies.map(a=>a.arrivalAtMs))+1;
  let context:AudioContext|null=null,audio:GameAudio|null=null;
  try{
    context=new AudioContext();const silent=context.createGain();silent.gain.value=0;silent.connect(context.destination);
    const port=new Proxy(context,{get(target,key){if(key==='destination')return silent;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
    audio=new GameAudio(()=>port);audio.unlock();audio.play(setupEvents,true,battle.id);
    const events=[...setupEvents],draws:number[]=[],gaps:number[]=[];let previous=await frame(),maxEffects=0,maxSeen=0,maxVoices=0;
    for(let i=1;i<=300;i++){
      const tick=await frame();gaps.push(tick-previous);previous=tick;
      const batch=advanceBattle(battle,Math.floor(i*end/300));events.push(...batch);view.events(batch);audio.play(batch,true,battle.id);validateBattle(battle);
      const before=JSON.stringify(battle),start=performance.now();view.draw(start);draws.push(performance.now()-start);
      if(JSON.stringify(battle)!==before)throw new Error('Drawing changed authoritative mixed battle');
      const resources=view as unknown as {effects:unknown[];seenEffects:Set<string>},voices=(audio as unknown as {voices:unknown[]}).voices.length;
      maxEffects=Math.max(maxEffects,resources.effects.length);maxSeen=Math.max(maxSeen,resources.seenEffects.size);maxVoices=Math.max(maxVoices,voices);
      if(maxEffects>100||maxSeen>400||maxVoices>4)throw new Error('Mixed resource bound exceeded');
      if(i%30===0)status.textContent=`混合交战：${i}/300 帧，剩余 ${battle.armies.length} 队；损失与到达按规则处理。`;
    }
    const reference=structuredClone(initial),referenceEvents=advanceBattle(reference,end);
    if(JSON.stringify(reference)!==JSON.stringify(battle)||JSON.stringify(referenceEvents)!==JSON.stringify(events.slice(setupEvents.length)))throw new Error('Mixed frame slicing changed state or event order');
    const eventCounts:Record<string,number>={};for(const e of events)eventCounts[e.type]=(eventCounts[e.type]??0)+1;
    for(const type of ['tower-shot','volley','arrival','upgrade','card'])if(!eventCounts[type])throw new Error(`Missing mixed condition: ${type}`);
    if(battle.armies.length)throw new Error('Mixed armies remain after all original arrival times');
    audio.stop();const voicesAfter=(audio as unknown as {voices:unknown[]}).voices.length;
    report.textContent=JSON.stringify({scope:'300 actual desktop Canvas frames; mixed test setup and production rules, muted native audio; no player save or mobile claim.',ruleRevision:battle.ruleRevision,canvas:view.viewport,reducedMotion:profile.settings.reducedMotion,initialArmies:initial.armies.length,end,eventCounts,maxEffects,maxSeen,maxVoices,voicesAfter,frameStateAndEventsEqual:true,fps:300000/gaps.reduce((a,b)=>a+b,0),frameP95Ms:quantile(gaps,.95),drawP95Ms:quantile(draws,.95),drawMaxMs:Math.max(...draws),initial,battle,events},null,2);
    status.textContent='v1.5 历史直达混合压力完成：300 帧，完整终态与事件顺序一致，队伍到达／损失均按规则处理。';
  }catch(e){status.textContent=`失败：${String(e)}`;}
  finally{audio?.stop();await context?.close();unlock();mixedPressure=null;statePressure=null;mixedRun.disabled=true;stateRun.disabled=true;}
}
