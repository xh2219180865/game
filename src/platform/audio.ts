import type { BattleEvent } from '../core/types.ts';

interface AudioParamPort {setValueAtTime(value:number,time:number):unknown;exponentialRampToValueAtTime(value:number,time:number):unknown}
interface AudioNodePort {connect(destination:AudioNodePort):unknown;disconnect():void}
interface OscillatorPort extends AudioNodePort {type:string;frequency:AudioParamPort;onended:((...args:never[])=>unknown)|null;start(at:number):void;stop(at?:number):void}
interface GainPort extends AudioNodePort {gain:AudioParamPort}
export interface AudioContextPort {
  state:string;currentTime:number;destination:AudioNodePort;
  createOscillator():OscillatorPort;createGain():GainPort;
  resume():Promise<unknown>;suspend():Promise<unknown>;
}
interface Sound {key:string;frequency:number;end:number;duration:number;priority:number;wave:'sine'|'triangle'}
export function eventSound(event:BattleEvent):Sound|null {
  const common={wave:'sine' as const,duration:.09,priority:2};
  switch(event.type){
    case 'result': return {...common,key:'result',frequency:event.faction==='P'?523:event.amount===1?330:220,end:event.faction==='P'?784:event.amount===1?330:165,duration:.32,priority:9};
    case 'capture': return {...common,key:'capture',frequency:392,end:587,duration:.2,priority:8};
    case 'upgrade': return {...common,key:'command',frequency:360,end:540,duration:.16,priority:6,wave:'triangle'};
    case 'card': return {...common,key:'command',frequency:event.reason==='mobilize'?110:event.reason==='feint'?170:330,end:event.reason==='mobilize'?70:event.reason==='feint'?80:440,duration:.16,priority:6,wave:'triangle'};
    case 'dispatch': return {...common,key:'dispatch',frequency:220,end:event.reason==='march'?440:290,priority:4};
    case 'arrival': return {...common,key:'arrival',frequency:event.reason==='friendly'?330:180,end:event.reason==='friendly'?392:130,wave:'triangle'};
    case 'tower-shot': return {...common,key:'arrow',frequency:650,end:180,duration:.07,wave:'triangle'};
    case 'volley': return {...common,key:'arrow',frequency:830,end:240,duration:.1,wave:'triangle'};
    default:return null;
  }
}
export class GameAudio {
  private context:AudioContextPort|null=null;
  private playedMatch='';
  private restorationVersion=0;
  private lastEvent=0;
  private lastAt=new Map<string,number>();
  private voices:{osc:OscillatorPort;gain:GainPort;priority:number;end:number}[]=[];
  private createContext:()=>AudioContextPort;
  private now:()=>number;
  private resumePending:Promise<void>|null=null;
  private stopVersion=0;
  private failureReported=false;
  private onFailure:()=>void;
  constructor(createContext:()=>AudioContextPort=()=>new AudioContext(),now:()=>number=()=>Date.now(),onFailure:()=>void=()=>{}){this.createContext=createContext;this.now=now;this.onFailure=onFailure;}
  private reportFailure():void{if(this.failureReported)return;this.failureReported=true;try{this.onFailure();}catch{/* Reporting cannot block input. */}}
  unlock():void {
    try{
      if(this.context?.state==='closed'){this.stop();this.context=null;this.resumePending=null;}
      this.context??=this.createContext();
      if((this.context.state==='suspended'||this.context.state==='interrupted')&&!this.resumePending){
        const ctx=this.context,pending=Promise.resolve(ctx.resume()).then(()=>{if(this.context===ctx&&ctx.state!=='running')this.reportFailure();}).catch(()=>this.reportFailure());
        this.resumePending=pending;void pending.then(()=>{if(this.resumePending===pending)this.resumePending=null;});
      }
    }catch{this.stop();this.context=null;this.resumePending=null;this.reportFailure();}
  }
  click(enabled:boolean):void {
    if(!enabled)return;
    this.afterResume({key:'click',frequency:420,end:350,duration:.035,priority:1,wave:'sine'});
  }
  preview():void {
    this.unlock();
    this.afterResume({key:'preview',frequency:523,end:784,duration:.24,priority:1,wave:'triangle'});
  }
  private afterResume(sound:Sound,stillCurrent:()=>boolean=()=>true):void {
    try{
      if(this.resumePending&&this.context?.state!=='running'){const version=this.stopVersion;void this.resumePending.then(()=>{if(version===this.stopVersion&&stillCurrent())this.emit(sound);});}
      else this.emit(sound);
    }catch{this.reportFailure();}
  }
  play(events:BattleEvent[],enabled:boolean,matchId='',restorationVersion=0):void {
    if(this.playedMatch!==matchId||this.restorationVersion!==restorationVersion){this.playedMatch=matchId;this.restorationVersion=restorationVersion;this.lastEvent=0;}
    const fresh=events.filter(e=>e.id>this.lastEvent);this.lastEvent=Math.max(this.lastEvent,...events.map(e=>e.id));
    if(!enabled){this.stop();return;}
    const sounds=fresh.map(eventSound).filter((s):s is Sound=>s!==null).sort((a,z)=>z.priority-a.priority);
    if(sounds[0])this.afterResume(sounds[0],()=>this.playedMatch===matchId&&this.restorationVersion===restorationVersion);
  }
  private emit(sound:Sound):void {
    let osc:OscillatorPort|undefined,gain:GainPort|undefined,voice:GameAudio['voices'][number]|undefined;
    try{
      const ctx=this.context,now=this.now();if(!ctx||ctx.state!=='running'||now-(this.lastAt.get(sound.key)??-Infinity)<100)return;
      for(const expired of [...this.voices])if(expired.end<=ctx.currentTime)this.remove(expired,true);
      if(this.voices.length>=4){
        const lowest=[...this.voices].sort((a,z)=>a.priority-z.priority)[0]!;if(lowest.priority>=sound.priority)return;
        this.remove(lowest,true);
      }
      this.lastAt.set(sound.key,now);
      const start=ctx.currentTime;osc=ctx.createOscillator();gain=ctx.createGain();voice={osc,gain,priority:sound.priority,end:start+sound.duration+.01};
      osc.type=sound.wave;osc.frequency.setValueAtTime(sound.frequency,start);osc.frequency.exponentialRampToValueAtTime(sound.end,start+sound.duration);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.045,start+.01);gain.gain.exponentialRampToValueAtTime(.0001,start+sound.duration);
      osc.connect(gain);gain.connect(ctx.destination);this.voices.push(voice);const active=voice;osc.onended=()=>this.remove(active,false);osc.start(start);osc.stop(voice.end);this.failureReported=false;
    }catch{
      if(voice)this.remove(voice,true);else{if(osc)this.releaseOscillator(osc,true);try{gain?.disconnect();}catch{/* Best-effort native cleanup. */}}
      this.reportFailure();
    }
  }
  private releaseOscillator(osc:OscillatorPort,stop:boolean):void {
    try{osc.onended=null;}catch{/* Best-effort native cleanup. */}
    if(stop)try{osc.stop();}catch{/* A native node may already have ended. */}
    try{osc.disconnect();}catch{/* Best-effort native cleanup. */}
  }
  private remove(voice:GameAudio['voices'][number],stop:boolean):void {
    this.voices=this.voices.filter(v=>v!==voice);this.releaseOscillator(voice.osc,stop);try{voice.gain.disconnect();}catch{/* Best-effort native cleanup. */}
  }
  stop():void {this.stopVersion++;for(const voice of [...this.voices])this.remove(voice,true);}
  suspend():void {this.stop();try{if(this.context?.state==='running')void this.context.suspend().catch(()=>{});}catch{/* Audio failure cannot block a game pause. */}}
}
