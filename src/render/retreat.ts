import { armyPosition } from '../core/geometry.ts';
import type { Army, Battle, BattleEvent, FactionId, Point, TroopType } from '../core/types.ts';

type Ghost={id:string;faction:FactionId;troopType:TroopType;position:Point;started:number};

export class RetreatPresentation {
  private observed=new Map<string,Army>();
  private ghosts=new Map<string,Ghost>();
  private lastEvent=0;
  reset():void{this.observed.clear();this.ghosts.clear();this.lastEvent=0;}
  private available(battle:Battle,enabled:boolean):boolean{
    if(!enabled||battle.status==='finished'||battle.armies.length>40){this.reset();return false;}return true;
  }
  observe(battle:Battle,enabled:boolean):void{
    if(!this.available(battle,enabled))return;
    this.frames(battle.gameMs);
    this.observed=new Map(battle.armies.map(a=>[a.id,{...a,from:{...a.from},to:{...a.to}}]));
  }
  consume(battle:Battle,events:BattleEvent[],enabled:boolean):void{
    if(!this.available(battle,enabled))return;
    this.frames(battle.gameMs);
    for(const event of events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.type==='army-loss'){
        const army=this.observed.get(event.targetId!);
        if(army){army.remainingCount-=event.amount??0;if(army.remainingCount<=0)this.observed.delete(army.id);}
      }
      if(event.type!=='eliminated'||event.atMs>battle.gameMs||!battle.factions.some(f=>f.id===event.faction&&f.eliminated))continue;
      for(const [id,army]of this.observed){
        if(army.faction!==event.faction)continue;
        this.observed.delete(id);
        if(army.remainingCount<=0||army.arrivalAtMs<=event.atMs||army.departedAtMs>event.atMs||battle.armies.some(a=>a.id===id))continue;
        this.ghosts.set(id,{id,faction:army.faction,troopType:army.troopType,position:armyPosition(army,event.atMs),started:event.atMs});
        if(this.ghosts.size>40)this.ghosts.delete(this.ghosts.keys().next().value!);
      }
    }
    this.frames(battle.gameMs);
  }
  frames(gameMs:number):{id:string;faction:FactionId;troopType:TroopType;position:Point;alpha:number}[]{
    const frames=[];
    for(const [id,ghost]of this.ghosts){
      const age=gameMs-ghost.started;
      if(age<0||age>=160){this.ghosts.delete(id);continue;}
      frames.push({id,faction:ghost.faction,troopType:ghost.troopType,position:{...ghost.position},alpha:.45*(1-age/160)});
    }
    return frames;
  }
}
