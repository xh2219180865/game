// Design-only renderer. Reuses production art, maps and rules; no storage or platform entry.
import { loadArt, ART_SOURCES } from '../../../src/render/assets.ts';
import { building, campPennant, cardSymbol, marchingSoldier, flag, rankBadge, cardAccent } from '../../../src/render/art.ts';
import { drawTerrain } from '../../../src/render/terrain.ts';
import { drawRoads, tacticalAccent, shotAccent } from '../../../src/render/tactical-art.ts';
import { battlefieldLandforms, drawBattlefieldLandforms, drawBattlefieldBridges } from '../../../src/render/battlefield-landforms.ts';
import { createBattle, applyBattleAction, advanceBattle } from '../../../src/core/battle.ts';
import { armyPosition } from '../../../src/core/geometry.ts';
import { MAPS } from '../../../src/core/maps.ts';
import { CARDS, CARD_IDS, rankName } from '../../../src/core/progress.ts';
import { infantryDistanceFrame } from '../../../src/render/sample-sprite-regions.ts';
import type { Battle, BattleEvent, CardId, MapId, CampType } from '../../../src/core/types.ts';
export { CARDS, CARD_IDS, MAPS, rankName };
export const artReady=loadArt(()=>new Image());
const iconArt=new Image();iconArt.src='/artifacts/strategy-design-v1/icon-art-direction.png';
function orderArt(c:CanvasRenderingContext2D,id:CardId,w:number,h:number):void{
  const cells:Partial<Record<CardId,number>>={mobilize:0,march:1,supply:2,feint:3,farming:7,logistics:8};
  const index=cells[id];
  if(iconArt.complete&&iconArt.naturalWidth&&index!==undefined){
    const sw=iconArt.naturalWidth/5,sh=iconArt.naturalHeight/2,size=Math.min(w,h);
    c.drawImage(iconArt,(index%5)*sw,Math.floor(index/5)*sh,sw,sh,(w-size)/2,(h-size)/2,size,size);
  }else if(id==='fortification'){building(c,w/2,h*.63,Math.min(w,h)*.68,'barracks',3,'P');}
  else cardSymbol(c,w/2,h/2,Math.min(w,h)*.39,id);
}
export const artCount=Object.keys(ART_SOURCES).length;
let activeCanvases:HTMLCanvasElement[]=[];
let reduced=false,freeze=false,started=0;
let sample:Battle=createSample('A01'),effects:BattleEvent[]=[];
let mode='idle';
function createSample(map:MapId):Battle{return createBattle(map,{id:'page-design-only',firstDragCompleted:true,inventory:{mobilize:3,march:2,supply:1,feint:4}});}
export function setMotion(value:boolean):void{reduced=value;}
export function mountArt():void{activeCanvases=[...document.querySelectorAll<HTMLCanvasElement>('#phone canvas')];}
export function setMap(id:MapId):void{sample=createSample(id);effects=[];mode='idle';}
export function freezeMap(value:boolean):void{freeze=value;if(!value)started=performance.now()-sample.gameMs;}
export function playScene(next:string):void{
  const id=sample.mapId;
  sample=createSample(id);effects=[];started=performance.now();mode=next;
  const source=sample.camps.find(c=>c.owner==='P')!;
  if(next==='supply')source.garrison=48;
  else source.garrison=40;
  if(['mobilize','supply','feint'].includes(next)){
    const result=applyBattleAction(sample,{kind:'card',faction:'P',sequence:1,cardId:next as 'supply'|'mobilize'|'feint',targetId:next==='feint'?sample.camps.find(c=>c.owner&&c.owner!=='P')!.id:source.id});
    if(result.ok)effects.push(...result.events);
  }else{
    const target=MAPS[id].roads.flatMap(([a,z])=>a===source.id?[z]:z===source.id?[a]:[]).find(cid=>sample.camps.find(c=>c.id===cid)?.owner===null)!;
    const result=applyBattleAction(sample,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target,march:next==='march'});
    if(result.ok)effects.push(...result.events);
  }
}
function text(c:CanvasRenderingContext2D,value:string,x:number,y:number,size=14,color='#39291c'):void{
  c.font='500 '+size+'px Campaign,"Kaiti SC",serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(value,x,y);
}
function paintMap(c:CanvasRenderingContext2D,w:number,h:number,b:Battle,counts:boolean,live:boolean):void{
  const k=Math.min((w-18)/360,(h-30)/540),ox=(w-360*k)/2,oy=(h-540*k)/2+9;
  const point=(p:{x:number;y:number})=>({x:ox+p.x*k,y:oy+p.y*k});
  const centers=b.camps.map(point),routes=MAPS[b.mapId].roads.map(([a,z])=>({from:point(b.camps.find(t=>t.id===a)!),to:point(b.camps.find(t=>t.id===z)!)}));
  drawTerrain(c,w,h,centers,b.mapId,routes);
  const land=battlefieldLandforms(w,h,centers,routes,b.mapId);
  drawBattlefieldLandforms(c,land,b.mapId);drawRoads(c,b,point,null,k);drawBattlefieldBridges(c,land);
  const objects:[number,()=>void][]=[];
  for(const camp of b.camps){const p=point(camp);objects.push([p.y,()=>building(c,p.x,p.y,counts?Math.max(21,29*k):25,camp.type,camp.tier,camp.owner)]);}
  for(const army of b.armies){
    const pos=armyPosition(army,b.gameMs),p=point(pos);
    objects.push([p.y,()=>{
      const moving=reduced?0:infantryDistanceFrame((b.gameMs-army.departedAtMs)/1000*army.speed,0,true);
      marchingSoldier(c,p.x,p.y,army.troopType,army.faction,.9,0,0,1,moving);
      flag(c,p.x-12,p.y-23,7,army.faction);text(c,String(army.remainingCount),p.x+6,p.y-25,14);
    }]);
  }
  objects.sort((a,z)=>a[0]-z[0]).forEach(o=>o[1]());
  if(live){
    for(const event of effects){
      const age=b.gameMs-event.atMs;
      if(age<0||age>800)continue;
      const camp=b.camps.find(t=>t.id===event.targetId);if(!camp)continue;
      const p=point(camp),source=b.camps.find(t=>t.id===event.sourceId);
      if(event.type==='capture'||event.type==='arrival')tacticalAccent(c,event.type==='capture'?'capture':'arrival',p,source?point(source):null,'P',age,reduced,false);
      if(event.type==='card'&&(event.reason==='supply'||event.reason==='mobilize'||event.reason==='feint'))cardAccent(c,p.x,p.y-36,event.reason,'infantry','P',event.amount??0,age,reduced,600);
      if(event.type==='tower-shot'||event.type==='volley')shotAccent(c,event.position?point(event.position):source?point(source):p,p,'P',age,event.type==='volley',reduced,false);
    }
  }
  if(counts)for(const camp of b.camps){const p=point(camp);campPennant(c,p.x,p.y+28,camp.garrison,camp.owner,false,camp.tier);}
}
function guide(c:CanvasRenderingContext2D,w:number,h:number,chapter:string,t:number):void{
  c.fillStyle='#cbb486';c.fillRect(0,0,w,h);
  if(chapter==='tiers'){
    for(const [row,type] of (['barracks','archery','relay','fort'] as const).entries())for(const tier of [1,2,3]){
      const x=w*(tier-.5)/3,y=row*h/4+h/8-10;
      building(c,x,y,31,type,tier,'P');campPennant(c,x,y+30,30,'P',false,tier);
      text(c,['步兵营','弓营','骑营','塔营'][row]!,x,y+52,12);
    }
  }else if(chapter==='upgrade'){
    for(const tier of [1,2,3]){const x=w*(tier-.5)/3;building(c,x,h*.47,30,'barracks',tier,'P');campPennant(c,x,h*.47+33,[30,70,45][tier-1]!,'P',false,tier);text(c,['花 10 兵','花 25 兵','最高三级'][tier-1]!,x,h*.84,12);}
  }else if(chapter==='troops'){
    for(const [i,type] of (['infantry','archer','cavalry','guard'] as const).entries()){
      const x=w*(i+.5)/4;marchingSoldier(c,x,h*.48,type,'P',1.8,0,0,1,reduced?0:infantryDistanceFrame(t/40,0,true));
      text(c,['步兵','弓兵','骑兵','守备兵'][i]!,x,h*.82,14);
    }
  }else{
    const a={x:w*.22,y:h*.61},z={x:w*.78,y:h*.40};
    drawTerrain(c,w,h,[a,z],'A01',[{from:a,to:z}]);
    const roadSample=createSample('L01');
    const [roadFrom,roadTo]=MAPS.L01.roads[0]!;
    roadSample.camps=roadSample.camps.filter(camp=>camp.id===roadFrom||camp.id===roadTo);
    for(const camp of roadSample.camps)Object.assign(camp,camp.id===roadFrom?a:z);
    drawRoads(c,roadSample,p=>p,null,1.15);
    building(c,a.x,a.y,32,'barracks',1,'P');building(c,z.x,z.y,32,'archery',chapter==='supply'?1:2,chapter==='supply'?'P':null);
    if(chapter==='supply'){
      cardSymbol(c,w*.47,h*.25,24,'supply');campPennant(c,z.x,z.y+34,t>0?50:48,'P',false,1);campPennant(c,a.x,a.y+34,20,'P',false,1);
      text(c,t>0?'乡勇实际补入 +2':'点乡勇，再点己方营地',w/2,h*.9,14);
    }else{
      const moving=t>0,p=Math.min(1,t/3000),px=a.x+(z.x-a.x)*p,py=a.y+(z.y-a.y)*p;
      campPennant(c,a.x,a.y+33,moving?10:20,'P',false,1);campPennant(c,z.x,z.y+33,p===1?2:8,p===1?'P':null,false,2);
      if(moving&&p<1){marchingSoldier(c,px,py,'infantry','P',1,0,0,1,reduced?0:infantryDistanceFrame(t/40,0,true));text(c,'10',px,py-24,15);}
      text(c,p===1?'10 对 8，余 2 兵占领':'按住己营，沿道路拖到邻城',w/2,h*.12,14);
    }
  }
}
let guideStart:number|null=null;
export function playGuide():void{guideStart=performance.now();}
export function resetGuide():void{guideStart=null;}
function frame(now:number):void{
  if(!freeze&&mode!=='idle'){
    const target=Math.min(7000,Math.max(0,Math.floor(now-started)));
    if(target>sample.gameMs)effects.push(...advanceBattle(sample,target));
    effects=effects.filter(e=>sample.gameMs-e.atMs<900);
  }
  for(const canvas of activeCanvases){
    if(!canvas.isConnected)continue;
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)continue;
    const dpr=Math.min(devicePixelRatio||1,2),w=r.width,h=r.height;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    if(canvas.dataset.map){
      paintMap(c,w,h,canvas.dataset.live?sample:createSample(canvas.dataset.map as MapId),canvas.dataset.counts==='true',!!canvas.dataset.live);
      if(canvas.dataset.live){
        canvas.dataset.gameMs=String(sample.gameMs);
        canvas.setAttribute('aria-label','战场演示：'+sample.mapId+'，行军 '+sample.armies.length+' 队，己方驻军 '+sample.camps.filter(c=>c.owner==='P').map(c=>c.garrison).join('／'));
      }
    }
    else if(canvas.dataset.card)orderArt(c,canvas.dataset.card as CardId,w,h);
    else if(canvas.dataset.camp)building(c,w/2,h*.55,Math.min(w,h)*.65,canvas.dataset.camp as CampType,Number(canvas.dataset.tier??1),'P');
    else if(canvas.dataset.rank)rankBadge(c,w/2,h/2,Math.min(w,h)*.38,480);
    else if(canvas.dataset.guide){const age=guideStart===null?0:Math.min(3000,now-guideStart);guide(c,w,h,canvas.dataset.guide,reduced?(age>0?3000:0):age);}
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
