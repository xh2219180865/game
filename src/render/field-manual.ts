import { displayFont } from './typography.ts';
import { createBattle } from '../core/battle.ts';
import { MAPS } from '../core/maps.ts';
import { UPGRADE } from '../core/config.ts';
import { building, campPennant, marchingSoldier } from './art.ts';
import { drawRoads } from './tactical-art.ts';
import { drawStrategyIllustration } from './strategy-illustration.ts';
import { infantryDistanceFrame } from './sample-sprite-regions.ts';

export type ManualChapter=0|1|2;
export const MANUAL_STEPS=[
  ['按住己方营地','沿道路拖向相邻营地','松手派出一半，留下守军'],
  ['兵力达到门槛，点建筑檐角箭头','军牌数字是现有驻军，升级先扣兵','最高三级，出兵不会降级'],
  ['点底部锦囊，再点合法目标','乡勇立即补兵，受容量限制','兼行随下一次合法派兵生效'],
] as const;
// Isolated, static road geometry; this illustration never receives a player session.
const roads=createBattle('L01',{id:'manual-illustration'});
const [from,to]=MAPS.L01.roads[0]!;
roads.camps=roads.camps.filter(c=>c.id===from||c.id===to);

/** A one-shot storyboard, using the same architecture, pennants, roads and troops as battle. */
export function drawManualDiagram(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,chapter:ManualChapter,elapsed:number|null,reduced:boolean):void{
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x,y);
  const label=(value:string,px:number,py:number,size=13)=>{c.font=`500 ${size}px ${displayFont()}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#38291E';c.fillText(value,px,py);};
  const age=elapsed===null?0:reduced?3000:Math.max(0,Math.min(3000,elapsed));
  const a={x:w*.19,y:h*.61},z={x:w*.8,y:h*.42};
  if(chapter===1){
    for(const tier of [1,2] as const){
      const row=(tier-1)*h/2,py=row+45,rule=UPGRADE[tier];
      for(const [px,level,count]of [[w*.22,tier,rule.threshold],[w*.83,tier+1,rule.threshold-rule.cost]]){
        c.fillStyle='#71502A18';c.beginPath();c.ellipse(px!,py+17,29,7,0,0,Math.PI*2);c.fill();
        building(c,px!,py,Math.min(32,w/8.6),'barracks',level!,'P');
        campPennant(c,px!,py+30,count!,'P',false,level!);
      }
      label(tier===1?'升二级':'升三级',w*.52,py-14,15);
      label(`消耗 ${rule.cost} 兵`,w*.52,py+8,12);
      c.strokeStyle='#896438';c.lineWidth=1.4;c.beginPath();c.moveTo(w*.43,py+29);c.lineTo(w*.61,py+29);c.lineTo(w*.61-4,py+25);c.moveTo(w*.61,py+29);c.lineTo(w*.61-4,py+33);c.stroke();
      label('升级前',w*.22,row+h/2-13,11);label('升级后',w*.83,row+h/2-13,11);
      if(tier===1){c.strokeStyle='#82603B40';c.lineWidth=.7;c.beginPath();c.moveTo(12,h/2-1);c.lineTo(w-12,h/2-1);c.stroke();}
    }
  }else{
    drawRoads(c,roads,p=>p===roads.camps.find(camp=>camp.id===from)?a:z,null,1);
    const completed=age>=3000,moving=elapsed!==null,owner=chapter===2||completed?'P':null;
    building(c,a.x,a.y,30,'barracks',1,'P');building(c,z.x,z.y,30,'archery',chapter===2?1:2,owner);
    campPennant(c,a.x,a.y+28,chapter===0&&moving?10:20,'P',false,1);
    campPennant(c,z.x,z.y+28,chapter===2?(moving?50:48):completed?2:8,owner,false,chapter===2?1:2);
    if(chapter===0){
      if(moving&&!completed){const p=age/3000,px=a.x+(z.x-a.x)*p,py=a.y+(z.y-a.y)*p;
        marchingSoldier(c,px,py,'infantry','P',1,0,0,1,reduced?0:infantryDistanceFrame(age/40,0,true));label('10',px,py-23);
      }
      label(completed?'10 对 8，余 2 兵占领':'沿相连道路派兵',w/2,16);
    }else{
      drawStrategyIllustration(c,w*.38,6,w*.22,h*.32,'supply');
      label(moving?'48 / 50 → 50，实际补入 2':'一级营容量 50，当前 48',w/2,h-11,12);
    }
  }
  c.restore();
}
