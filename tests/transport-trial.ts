/** Isolated transport model. No production, combat, rewards, platform access or persistence. */
export class TransportTrial {
  ratio:50|80;
  automatic:boolean;
  counts:number[];
  clock=0;
  commands=0;
  overflow=0;
  middleOwned=true;
  pending:{source:number;target:number;count:number;at:number;follow:boolean}|null=null;
  log:string[]=[];
  constructor(ratio:50|80=50,automatic=false,middle=0){this.ratio=ratio;this.automatic=automatic;this.counts=[40,middle,0];}
  dispatch(source:number,target:number,follow=false):boolean {
    if(this.pending||![[0,1],[1,2]].some(([a,b])=>a===source&&b===target)||!this.middleOwned)return false;
    const n=this.counts[source]!;
    const sent=Math.min(n-1,Math.floor(n*this.ratio/100));
    if(sent<1)return false;
    this.counts[source]=n-sent;this.pending={source,target,count:sent,at:this.clock+4,follow};
    this.log.push(`${this.clock}秒：${source===0?'步营':'骑营'}派${sent}，留${n-sent}`);return true;
  }
  order(source:number,target:number):boolean {
    // A queued route must explicitly cross the owned middle; the UI collects the waypoint.
    const ok=this.dispatch(source,target,this.automatic&&source===0);if(ok)this.commands++;return ok;
  }
  step():void {
    this.clock++;
    const a=this.pending;if(!a||a.at>this.clock)return;
    this.pending=null;
    if(!this.middleOwned){this.log.push(`${this.clock}秒：中转失守，试验停止；不模拟交战`);return;}
    const total=this.counts[a.target]!+a.count;
    this.counts[a.target]=Math.min(50,total);this.overflow+=Math.max(0,total-50);
    this.log.push(`${this.clock}秒：${a.count}兵到达${a.target===1?'骑营，转为骑兵':'弓营，转为弓兵'}${total>50?`，溢出${total-50}`:''}`);
    if(a.follow){this.log.push('预排订单按中转当前总驻军再次取比例，包含原驻军');this.dispatch(1,2);}
  }
}
