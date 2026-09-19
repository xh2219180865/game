import { factionOf } from '../core/battle.ts';
import { CAMP_CONFIG, CAMP_RADIUS, TOWER_RANGE, campCapacity, movementSpeed } from '../core/config.ts';
import { connected } from '../core/maps.ts';
import { asNumber } from '../core/fraction.ts';
import { distance, travelTime } from '../core/geometry.ts';
import type { ActiveCardId, Army, Battle, BattleEvent, Camp, Point } from '../core/types.ts';

export interface DispatchPreview {
  valid:boolean; reason:string; sent:number; retained:number; normalMs:number; travelMs:number;
  conversion:string; volleyDamage:number|null; towerIds:string[];
}
function segmentDistance(point:Point,start:Point,end:Point):number {
  const dx=end.x-start.x,dy=end.y-start.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/length)):0;
  return distance(point,{x:start.x+t*dx,y:start.y+t*dy});
}
export function dispatchPreview(b:Battle,source:Camp,target:Camp|null,march:boolean):DispatchPreview {
  const actor=factionOf(b,'P')!,sent=Math.floor(source.garrison/2);
  const normalMs=target?travelTime(source,target,movementSpeed(b,source,actor)):0;
  const travelMs=target?travelTime(source,target,movementSpeed(b,source,actor,march)):0;
  const reason=b.status!=='running'?'当前不能派兵':source.owner!=='P'?'源营已易主':sent<1?'至少需要 2 兵':
    !target?'移到目标营地，松手派兵':source.id===target.id?'拖回源营，松手取消':
    b.awaitingFirstDispatch&&(source.id!=='L01-P1'||target.id!=='L01-N1')?'请先拖到提示的营地':
    !connected(b,source.id,target.id)?'道路不相连，请先到相邻城池':
    march&&actor.inventory.march<1?'兼行库存不足':march&&travelMs>=normalMs?'此路线无需加急，松手取消':'';
  let towerIds:string[]=[];
  if(target&&source.id!==target.id&&connected(b,source.id,target.id)){
    const d=distance(source,target),dx=(target.x-source.x)/d,dy=(target.y-source.y)/d;
    const from={x:source.x+dx*CAMP_RADIUS,y:source.y+dy*CAMP_RADIUS},to={x:target.x-dx*CAMP_RADIUS,y:target.y-dy*CAMP_RADIUS};
    towerIds=b.camps.filter(c=>c.type==='fort'&&c.owner&&c.owner!=='P'&&segmentDistance(c,from,to)<=TOWER_RANGE).map(c=>c.id);
  }
  return {valid:!reason,reason,sent,retained:source.garrison-sent,normalMs,travelMs,towerIds,
    conversion:target?`${CAMP_CONFIG[source.type].troopName} → ${CAMP_CONFIG[target.type].troopName}（${target.owner==='P'?'到达后':'占领后'}）`:'',
    volleyDamage:source.type==='archery'?Math.floor(sent*3/10):null};
}
export function cardTargetPreview(b:Battle,id:Exclude<ActiveCardId,'march'>,target:Camp):{valid:boolean;message:string} {
  const actor=factionOf(b,'P')!,room=campCapacity(target,actor)-target.garrison;
  if(b.status!=='running'||actor.eliminated)return {valid:false,message:'当前不能施策'};
  if(actor.inventory[id]<1)return {valid:false,message:'本周库存不足，不消耗'};
  if(id==='feint')return target.owner&&target.owner!=='P'
    ?{valid:true,message:`停产 ${Math.max(0,(target.feintUntil-b.gameMs)/1000).toFixed(1)} → ${(Math.max(0,target.feintUntil-b.gameMs)/1000+4).toFixed(1)} 秒${target.type==='fort'?'，同时停射':''}`}
    :{valid:false,message:'请选择敌方营地，不消耗'};
  if(target.owner!=='P')return {valid:false,message:'请选择己方营地，不消耗'};
  if(room<=0)return {valid:false,message:'此营已满，不消耗；移出取消'};
  if(id==='supply'){const added=Math.min(6,room);return {valid:true,message:`松手补 ${added} 兵：${target.garrison} → ${target.garrison+added}/${campCapacity(target,actor)}`};}
  if(target.feintUntil>b.gameMs)return {valid:false,message:'停产中不能征兵，不消耗'};
  return {valid:true,message:`征兵 ${Math.max(0,(target.mobilizeUntil-b.gameMs)/1000).toFixed(1)} → ${(Math.max(0,target.mobilizeUntil-b.gameMs)/1000+6).toFixed(1)} 秒，额度 ${asNumber(target.bonusBudget).toFixed(1)} → ${(asNumber(target.bonusBudget)+8).toFixed(1)}`};
}
export function isMarching(b:Battle,a:Army):boolean {
  const source=b.camps.find(c=>c.id===a.sourceId),f=factionOf(b,a.faction);
  return !!source&&!!f&&a.speed>movementSpeed(b,source,f)+1e-8;
}
/** Presentation-only edge detection; loading an already threatened save is silent. */
export class LastCampAlerts {
  private matchId:string|null=null;
  private previous:string|null=null;
  private lastAt=-Infinity;
  private until=0;
  update(b:Battle):{campId:string|null;fresh:boolean;emphasized:boolean}{
    const owned=b.camps.filter(c=>c.owner==='P'),campId=owned.length===1&&b.armies.some(a=>a.faction!=='P'&&a.targetId===owned[0]!.id)?owned[0]!.id:null;
    if(this.matchId!==b.id){this.matchId=b.id;this.previous=campId;this.lastAt=-Infinity;this.until=0;return {campId,fresh:false,emphasized:false};}
    const fresh=b.status==='running'&&campId!==null&&campId!==this.previous&&b.gameMs-this.lastAt>=3000;
    if(fresh){this.lastAt=b.gameMs;this.until=b.gameMs+300;}
    this.previous=campId;return {campId,fresh,emphasized:campId!==null&&b.gameMs<this.until};
  }
}
export interface Rect {x:number;y:number;w:number;h:number}
/** One transient accent per destination; the limit is decorative, never a rule cap. */
export function selectBattleAccents(events:BattleEvent[]):Set<number>{
  const priority=(e:BattleEvent)=>e.type==='capture'?10:e.type==='arrival'?9:e.type==='upgrade'?8:e.type==='card'?6:e.type==='volley'||e.type==='tower-shot'?5:e.type==='dispatch'?4:0;
  const selected=new Map<string,BattleEvent>();
  for(const e of events){const key=e.type==='dispatch'?e.sourceId:e.targetId;if(!key||!priority(e))continue;const old=selected.get(key);
    if(!old||priority(e)>priority(old)||priority(e)===priority(old)&&e.id>old.id)selected.set(key,e);
  }
  const result=new Set<number>();let cost=0;
  for(const e of [...selected.values()].sort((a,b)=>priority(b)-priority(a)||b.id-a.id)){
    const next=e.type==='capture'?5:e.type==='dispatch'||e.type==='arrival'&&e.reason==='enemy'?2:['volley','card'].includes(e.type)?3:1;if(cost+next>80)continue;cost+=next;result.add(e.id);
  }
  return result;
}
const overlaps=(a:Rect,b:Rect):boolean=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
interface ArmyLabelOffset {x:number;y:number;anchor:0|0.5|1}
/** Keeps a label beside its own army. Hidden labels remain individually queryable. */
export class StableArmyLabels {
  private offsets=new Map<string,ArmyLabelOffset>();
  reset():void {this.offsets.clear();}
  layout(items:{id:string;point:Point;width:number}[],bounds:Rect,obstacles:Rect[]):Map<string,Rect> {
    const active=new Set(items.map(item=>item.id));
    for(const id of this.offsets.keys())if(!active.has(id))this.offsets.delete(id);
    const placed=new Map<string,Rect>(),occupied=[...obstacles,...items.map(item=>({x:item.point.x-10,y:item.point.y-22,w:20,h:32}))];
    const candidates:ArmyLabelOffset[]=[
      {x:14,y:-26,anchor:0},{x:-14,y:-26,anchor:1},
      {x:14,y:-38,anchor:0},{x:-14,y:-38,anchor:1},
      {x:14,y:0,anchor:0},{x:-14,y:0,anchor:1},
      {x:0,y:-50,anchor:0.5},{x:0,y:-62,anchor:0.5},{x:0,y:-74,anchor:0.5},
      {x:0,y:14,anchor:0.5},
      {x:14,y:14,anchor:0},{x:-14,y:14,anchor:1},
    ];
    const attempt=(item:typeof items[number],offset:ArmyLabelOffset):boolean=>{
      if(![item.point.x,item.point.y,item.width,bounds.x,bounds.y,bounds.w,bounds.h,bounds.x+bounds.w,bounds.y+bounds.h].every(Number.isFinite)||item.width<=0||item.width>bounds.w||bounds.h<24)return false;
      const r={x:Math.max(bounds.x,Math.min(bounds.x+bounds.w-item.width,item.point.x+offset.x-item.width*offset.anchor)),
        y:Math.max(bounds.y,Math.min(bounds.y+bounds.h-24,item.point.y+offset.y)),w:item.width,h:24};
      // Measure the gap to the visible figure, not its feet: a nearby overhead flag is still attached.
      const dx=Math.max(r.x-(item.point.x+10),0,item.point.x-10-r.x-r.w),
        dy=Math.max(r.y-(item.point.y+9),0,item.point.y-27-r.y-r.h);
      if(Math.hypot(dx,dy)>24||occupied.some(o=>overlaps(r,o)))return false;
      occupied.push(r);placed.set(item.id,r);
      // Anchor at the edge nearest the army, so digit growth does not swap sides.
      this.offsets.set(item.id,{x:r.x+item.width*offset.anchor-item.point.x,y:r.y-item.point.y,anchor:offset.anchor});
      return true;
    };
    // Reserve existing placements before new arrivals can take their positions.
    for(const item of items){const previous=this.offsets.get(item.id);if(previous)attempt(item,previous);}
    for(const item of items)if(!placed.has(item.id)){
      // Camp roofs can leave only a narrow strip between two avoidance boxes. Fit that local edge
      // instead of increasing the search radius or dropping an ordinary, uncrowded army count.
      const roofEdges=obstacles.filter(o=>item.point.x+item.width/2>o.x-3.5&&item.point.x-item.width/2<o.x+o.w+3.5)
        .map(o=>({x:0,y:o.y-27.5-item.point.y,anchor:0.5 as const}))
        .filter(o=>o.y<=-49&&o.y>=-75).sort((a,b)=>b.y-a.y);
      for(const candidate of [...candidates.slice(0,6),...roofEdges,...candidates.slice(6)])if(attempt(item,candidate))break;
    }
    return placed;
  }
}
/** Important armies are passed first. Omitted labels never imply merged forces. */
export function placeArmyLabels(items:{id:string;point:Point;width:number}[],bounds:Rect,obstacles:Rect[],searchBoard=false):Map<string,Rect> {
  const placed=new Map<string,Rect>(),occupied=[...obstacles,...items.map(i=>({x:i.point.x-10,y:i.point.y-22,w:20,h:32}))];
  const boardSlots=new Map<number,Rect[]>();
  for(const item of items){
    if(item.width>bounds.w)continue;
    // Camp receipts can share the roof line without competing with the approaching army's badge.
    const candidates=searchBoard?[[-item.width/2,-69],[14,-69],[-item.width-14,-69]]:[];
    candidates.push(...[[14,-12],[-item.width-14,-12],[42,-12],[-item.width-42,-12],[8,-50],[8,26],[-item.width-8,26],[-item.width-8,-50],[8,54],[-item.width-8,54]]);
    for(const [dx,dy]of candidates){
      const r={x:Math.max(bounds.x,Math.min(bounds.x+bounds.w-item.width,item.point.x+dx!)),y:item.point.y+dy!,w:item.width,h:24};
      if(r.y<bounds.y||r.y+r.h>bounds.y+bounds.h||occupied.some(o=>overlaps(r,o)))continue;
      occupied.push(r);placed.set(item.id,r);break;
    }
    if(searchBoard&&!placed.has(item.id)){
      let slots=boardSlots.get(item.width);
      if(!slots){
        slots=[];
        for(let y=bounds.y;y+24<=bounds.y+bounds.h;y+=24)for(let x=bounds.x;x+item.width<=bounds.x+bounds.w;x+=24)slots.push({x,y,w:item.width,h:24});
      }
      // Occupied space only grows during this placement pass; rejected slots stay unavailable.
      slots=slots.filter(r=>!occupied.some(o=>overlaps(r,o)));boardSlots.set(item.width,slots);
      let nearest:Rect|undefined,best=Infinity;
      for(const r of slots){const d=(r.x+r.w/2-item.point.x)**2+(r.y+r.h/2-item.point.y)**2;if(d<best){best=d;nearest=r;}}
      if(nearest){occupied.push(nearest);placed.set(item.id,nearest);}
    }
  }
  return placed;
}
