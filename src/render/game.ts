import { drawDeskScene, drawNoticeScene, fieldPaper, meritRuler, yardAtmosphere } from './page-scenes.ts';
import { displayFont, getFontRevision } from './typography.ts';
import { drawManualDiagram, MANUAL_STEPS, type ManualChapter } from './field-manual.ts';
import { GameSession } from '../app/session.ts';
import type { Page, SessionPresentation } from '../app/session.ts';
import { battleStats, factionOf } from '../core/battle.ts';
import { BASE_CAPACITY, CAMP_CONFIG, campCapacity, productionRate, passiveBonus, SHOT_INTERVAL, TIER_RATE, movementSpeed, UPGRADE } from '../core/config.ts';
import { asNumber } from '../core/fraction.ts';
import { armyPosition, distance } from '../core/geometry.ts';
import { MAPS, neighbors } from '../core/maps.ts';
import { ACTIVE_IDS, CARD_IDS, CARDS, lessonOpen, nextWeekAt, PASSIVE_IDS, rankName } from '../core/progress.ts';
import type { ActiveCardId, BattleEvent, Camp, CardId, MapId, Point } from '../core/types.ts';
import { arrivalAccent, arrow, building, campPennant, CAMP_COUNT_FONT, cardAccent, cardSymbol, COLORS, departureAccent, factionColor, factionName, flag, marchingSoldier, passiveRewardSymbol, rankBadge, rounded, soldierHit } from './art.ts';
import { battleAccentCost, cardTargetPreview, dispatchPreview, incomingSummary, resultExplanation, standingSummary, isMarching, LastCampAlerts, StableArmyLabels, placeArmyLabels, selectBattleAccents } from './battle-presentation.ts';
import type { Rect } from './battle-presentation.ts';
import { RetreatPresentation } from './retreat.ts';
import { drawTerrain } from './terrain.ts';
import { battlefieldLandforms, drawBattlefieldLandforms, drawBattlefieldBridges } from './battlefield-landforms.ts';
import { drawRoads, marchTrail, shotAccent, tacticalAccent, tacticalDuration, upgradeAccent } from './tactical-art.ts';
import { drawHomeScene } from './home-scene.ts';
import { drawHomeAtmosphere } from './home-atmosphere.ts';
import { drawArt, getArtStatus, getArtRevision, retryArt } from './assets.ts';
import { drawMobileIcon } from './mobile-icons.ts';
import { drawGameControl, drawHomeEntryIcon } from './game-controls.ts';
import { infantryDistanceFrame } from './sample-sprite-regions.ts';
import { drawArmyPennant } from './army-pennant.ts';
import { drawOrderCard, drawOrderMount } from './order-card.ts';
import { drawStrategyIllustration } from './strategy-illustration.ts';
import { drawSampleGround } from './sample-ground.ts';
import type { MobileIcon } from './mobile-icons.ts';
import { placeCampPopover } from './mobile-layout.ts';
import { drawRankStandard } from './scheme-a.ts';
import { drawCourtyardPanel, drawCourtyardHeading, drawSettingSeal } from './courtyard-ui.ts';

export interface Region {id:string;label:string;x:number;y:number;w:number;h:number;run:()=>void}
export interface Viewport {width:number;height:number;top:number;bottom:number}
type Gesture={id:number;x:number;y:number;lastY:number;point:Point;region:Region|null;source:string|null;drag:boolean;page:Page;context:string;started:number};
type Modal={title:string;body:string;label:string;run:()=>void};
const count=(n:number):string=>n>999?'999+':String(n);
const time=(ms:number):string=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}`;

export class GameView {
  regions:Region[]=[];
  soundPreview:(()=>void)|null=null;
  private currentViewport:Viewport={width:375,height:812,top:16,bottom:16};
  get viewport():Viewport{return this.currentViewport;}
  set viewport(value:Viewport){const wasUsable=this.viewportUsable;this.currentViewport=value;this.clearInput();this.regions=[];if(!this.viewportUsable&&(wasUsable||this.session.page==='battle'))void this.session.suspend();}
  private get boardScale():number{const {width,height,top,bottom}=this.viewport;return Math.min((width-16)/360,(height-top-bottom-124)/540);}
  get viewportUsable():boolean{return this.viewport.width>=280&&this.boardScale>=.5;}
  selected:string|null=null;
  card:ActiveCardId|null=null;
  selectedChoice:CardId|null=null;
  private librarySelection:CardId|null=null;
  private detailScroll=0;
  private detailStarted=0;
  private settingVisuals=new Map<string,{enabled:boolean;from:number;started:number}>();
  private detailMaxScroll=0;
  modal:Modal|null=null;
  private ctx:CanvasRenderingContext2D;
  private session:GameSession;
  private gesture:Gesture|null=null;
  private scroll=0;
  private maxScroll=0;
  private previousPage:Page='loading';
  private pageStarted=0;
  private shownModal:Modal|null=null;
  private modalStarted=0;
  private toastText='';
  private toastUntil=0;
  private effects:{event:BattleEvent;created:number;owner:string|null|undefined}[]=[];
  private board={x:0,y:0,k:1};
  private now=0;
  private matchId:string|null=null;
  private restorationVersion=-1;
  private seenEffects=new Set<string>();
  private retreats=new RetreatPresentation();
  private queryOffset=0;
  private armyPage:number|null=null;
  private armyLabels=new StableArmyLabels();
  private campDetailsOpen=false;
  private upgradePending=false;
  private rankRulesOpen=false;
  private resultDetailsOpen=false;
  private pauseDetailsOpen=false;
  private cardRulesOpen=false;
  private prepareRulesOpen=false;
  private aboutSection:number|null=null;
  private aboutRulesOpen=false;
  private manualChapter:ManualChapter=0;
  private manualStarted:number|null=null;
  private manualChanged:number|null=null;
  private inputVersion=0;
  private renderedContext:string|null=null;
  private renderedArtRevision=(getArtRevision()+getFontRevision());
  private preparedWeek:string|null=null;
  private threats=new LastCampAlerts();
  private onThreat:()=>void;
  private resultFeedback:{matchId:string;started:number|null}|null=null;
  private lastResultFeedbackId:string|null=null;
  private passiveReward:(Extract<SessionPresentation,{kind:'passive-claim'}>&{started:number|null})|null=null;
  private passiveStart:{matchId:string;started:number|null}|null=null;
  private lastPassiveClaimId:string|null=null;
  private lastPassiveStartId:string|null=null;
  constructor(ctx:CanvasRenderingContext2D,session:GameSession,onThreat:()=>void=()=>{}){this.ctx=ctx;this.session=session;this.onThreat=onThreat;}
  notify(message:string):void{this.toastText=message;this.toastUntil=Date.now()+3200;}
  present(event:SessionPresentation):void{
    this.syncMatch();const s=this.session;
    if(event.kind==='passive-claim'){
      if(this.lastPassiveClaimId===event.choiceId||s.page!=='home'||s.profile?.choice?.choiceId!==event.choiceId||s.profile.choice.state!=='claimed'||s.profile.passiveLevels[event.cardId]!==event.after||event.after!==event.before+1)return;
      this.lastPassiveClaimId=event.choiceId;this.passiveReward={...event,started:null};this.toastText='';
    }else if(this.lastPassiveStartId!==event.matchId&&s.page==='battle'&&s.match?.battle.id===event.matchId&&s.match.battle.gameMs===0){
      this.lastPassiveStartId=event.matchId;this.passiveStart={matchId:event.matchId,started:null};
    }
  }
  events(events:BattleEvent[]):void{
    this.syncMatch();
    const record=this.session.profile?.latestResult;
    if(events.some(e=>e.type==='result')&&this.session.page==='result'&&record?.modeId==='arena-four'&&record.matchId!==this.lastResultFeedbackId){
      this.lastResultFeedbackId=record.matchId;this.resultFeedback={matchId:record.matchId,started:null};
    }
    for(const event of events)if(['dispatch','arrival','capture','tower-shot','volley','volley-skipped','upgrade','card','garrison-loss','army-loss','garrison-change','overflow'].includes(event.type)){
      const key=`${this.session.match?.battle.id}:${event.id}`;if(this.seenEffects.has(key))continue;this.seenEffects.add(key);this.effects.push({event,created:this.session.match?.battle.gameMs??event.atMs,owner:this.session.match?.battle.camps.find(c=>c.id===event.targetId)?.owner});
    }
    if(this.seenEffects.size>400)this.seenEffects=new Set([...this.seenEffects].slice(-200));
    if(this.effects.length>100)this.effects=this.effects.slice(-100);
    const battle=this.session.match?.battle;
    if(battle)this.retreats.consume(battle,events,!this.session.profile?.settings.reducedMotion);else this.retreats.reset();
  }
  private syncMatch():void {
    const restored=this.restorationVersion!==this.session.restorationVersion;
    if(restored||this.matchId!==this.session.match?.battle.id){
      this.matchId=this.session.match?.battle.id??null;this.restorationVersion=this.session.restorationVersion;
      this.effects=[];this.seenEffects.clear();this.retreats.reset();this.armyLabels.reset();
      if(restored){this.threats=new LastCampAlerts();this.resultFeedback=null;this.passiveReward=null;this.passiveStart=null;}
    }
  }
  private inputContext():string {const s=this.session,p=s.profile,backup=s.backup;return JSON.stringify([s.page,this.librarySelection,p?.generation,s.match?.battle.id,p?.latestResult?.matchId,p?.choice?.choiceId,p?.weekId,backup?.data.generation,backup?.revision,backup?.writtenAt,backup?.checksum,this.viewport.width,this.viewport.height,this.viewport.top,this.viewport.bottom]);}
  private clearInput():void {this.inputVersion++;this.gesture=null;this.card=null;this.selected=null;this.selectedChoice=null;this.modal=null;this.armyPage=null;this.campDetailsOpen=false;}
  cancel(id?:number):void{if(id!==undefined&&this.gesture?.id!==id)return;this.inputVersion++;this.gesture=null;this.card=null;this.resultFeedback=null;this.passiveReward=null;this.passiveStart=null;}
  escape():void{
    const hasInput=!!(this.gesture||this.card||this.selected||this.modal);
    if(this.renderedContext!==this.inputContext()){this.clearInput();if(!hasInput&&this.session.page==='battle')void this.session.pause();return;}
    this.cancel();
    if(this.modal){this.modal=null;return;}
    if(this.librarySelection){this.closeCardDetails();return;}
    if(this.campDetailsOpen){this.campDetailsOpen=false;return;}
    if(this.armyPage!==null){this.armyPage=null;return;}
    if(hasInput){this.selected=null;return;}
    if(this.session.page==='battle'){void this.session.pause();return;}
    this.regions.find(r=>r.id==='back')?.run();
  }
  private nightPanel=false;
  private panelText(color:string):string{
    if(!this.nightPanel)return color;
    if(color===COLORS.ink)return '#F3DFC0';
    if(color===COLORS.muted)return '#D6BFA0';
    if(color===COLORS.player)return '#EAC27D';
    if(color===COLORS.enemy1)return '#FFAC95';
    return color;
  }
  private text(value:string,x:number,y:number,size=16,color=COLORS.ink,weight=400,align:CanvasTextAlign='left',display=false):void{
    const c=this.ctx;c.font=`${weight} ${size}px ${display?displayFont():'-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'}`;c.fillStyle=this.panelText(color);c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y);
  }
  private box(x:number,y:number,w:number,h:number,fill=COLORS.surface,r=16,stroke?:string):void{
    if(this.nightPanel&&fill===COLORS.surface){
      drawCourtyardPanel(this.ctx,x,y,w,h,h>=60&&w>=100?'panel':'tile',false,true);
      return;
    }
    rounded(this.ctx,x,y,w,h,Math.min(r,4));this.ctx.fillStyle=fill;this.ctx.fill();
    if(stroke){this.ctx.strokeStyle=stroke;this.ctx.lineWidth=1;this.ctx.stroke();}
  }
  private paragraph(value:string,x:number,y:number,w:number,size=15,color=COLORS.ink,line=24):number{
    for(const text of this.lines(value,w,size)){this.text(text,x,y,size,color);y+=line;}return y;
  }
  private lines(value:string,w:number,size:number):string[]{
    this.ctx.font=`400 ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
    const lines:string[]=[];
    const tokens=(value.match(/[A-Za-z0-9]+(?:[./][A-Za-z0-9]+)*|[\s\S]/gu)??[]).flatMap(token=>this.ctx.measureText(token).width>w?[...token]:[token]);
    let current='';for(const char of tokens){if(char==='\n'||this.ctx.measureText(current+char).width>w){
      if(char!=='\n'&&/[，。！？、；：]/.test(char)&&current.length>1){lines.push(current.slice(0,-1));current=current.slice(-1)+char;}
      else{lines.push(current);current=char==='\n'?'':char;}
    }else current+=char;}
    if(current)lines.push(current);return lines;
  }
  private button(id:string,label:string,x:number,y:number,w:number,h:number,run:()=>void,style:'primary'|'secondary'|'quiet'|'danger'='secondary'):void{
    const primary=style==='primary'||style==='danger',pressed=this.gesture?.region?.id===id&&!this.gesture.drag;
    const wooden=this.nightPanel||this.session.page==='prepare'||this.session.page==='recovery';
    const fill=primary?(pressed?'#773E2D':'#8F3526'):style==='quiet'?'#DED8CA':'#EEE9DD';
    const yy=y+(pressed&&!this.session.profile?.settings.reducedMotion?2*Math.min(1,Math.max(0,(this.now-this.gesture!.started)/80)):0);
    if(primary){
      const c=this.ctx,cut=Math.min(7,h*.14);
      const edge=(inset:number,offset:number)=>{c.beginPath();c.moveTo(x+inset+cut,yy+inset+offset);c.lineTo(x+w-inset-cut,yy+inset+offset);c.lineTo(x+w-inset,yy+inset+cut+offset);c.lineTo(x+w-inset,yy+h-inset-cut+offset);c.lineTo(x+w-inset-cut,yy+h-inset+offset);c.lineTo(x+inset+cut,yy+h-inset+offset);c.lineTo(x+inset,yy+h-inset-cut+offset);c.lineTo(x+inset,yy+inset+cut+offset);c.closePath();};
      edge(0,2);c.fillStyle='#625344';c.fill();edge(0,0);
      const lacquer=c.createLinearGradient(0,yy,0,yy+h);lacquer.addColorStop(0,pressed?'#773E2D':'#A5442D');lacquer.addColorStop(.45,fill);lacquer.addColorStop(1,pressed?'#66372A':'#692A20');c.fillStyle=lacquer;c.fill();c.strokeStyle='#A68B61';c.lineWidth=1;c.stroke();
      edge(3,0);c.strokeStyle='#D6B68A';c.lineWidth=.6;c.stroke();
    }else if(wooden)drawCourtyardPanel(this.ctx,x,yy,w,h,'tile',style==='quiet',true);
    else this.box(x,yy,w,h,fill,4,style==='quiet'?undefined:'#B7AD96');
    const symbol=id==='pause'?'Ⅱ':id==='back'?'‹':id==='close-camp'?'×':null;
    const homePrimary=this.session.page==='home'&&id==='primary';
    this.text(symbol??label,x+w/2,yy+h/2,homePrimary?30:symbol?25:primary&&w>=140?20:w<90?14:16,primary?'#FFF9EB':wooden?'#F3DFC0':COLORS.ink,650,'center',!symbol);

    if(y+h>this.viewport.top&&y<this.viewport.height-this.viewport.bottom)this.regions.push({id,label,x,y,w,h,run});
  }
  private iconButton(id:string,label:string,x:number,y:number,size:number,icon:MobileIcon,run:()=>void,caption=false):void{
    const pressed=this.gesture?.region?.id===id&&!this.gesture.drag,yy=y+(pressed?2:0);
    drawGameControl(this.ctx,x,y,size,icon,pressed);
    if(caption)this.text(label,x+size/2,yy+size+13,12,COLORS.ink,650,'center',true);
    this.regions.push({id,label,x,y,w:size,h:size+(caption?24:0),run});
  }
  private textButton(id:string,label:string,x:number,y:number,w:number,h:number,run:()=>void):void{
    const pressed=this.gesture?.region?.id===id&&!this.gesture.drag;
    this.text(label,x+w/2,y+h/2+(pressed?2:0),14,pressed?COLORS.ink:COLORS.player,550,'center',true);
    this.regions.push({id,label,x,y,w,h,run});
  }
  private orderButton(id:ActiveCardId,label:string,x:number,y:number,w:number,run:()=>void):void{
    const c=this.ctx,selected=this.card===id,split=label.lastIndexOf(' '),inventory=label.slice(split+1);
    const pressed=this.gesture?.region?.id===`card-${id}`&&!this.gesture.drag,yy=y+(pressed?2:0);
    drawOrderCard(c,x,y,w,54,id,selected,pressed,inventory!=='锁'&&inventory!=='0');
    this.text(label.slice(0,split),x+w/2,yy+11,14,COLORS.ink,650,'center',true);
    const badge=inventory==='锁'?'锁':`×${inventory}`;
    this.box(x+w-33,yy+35,29,16,'#39291FEF',2,'#A58155');
    this.text(badge,x+w-18,yy+43,11,'#FFF1D4',650,'center');
    this.regions.push({id:`card-${id}`,label,x,y,w,h:56,run});
  }

  private wide(id:string,label:string,y:number,run:()=>void,primary=false):void{this.button(id,label,20,y,this.viewport.width-40,50,run,primary?'primary':'secondary');}
  private startScroll(top:number,bottom:number):number{const first=this.regions.length;this.ctx.save();this.ctx.beginPath();this.ctx.rect(0,top,this.viewport.width,bottom-top);this.ctx.clip();return first;}
  private endScroll(first:number,top:number,bottom:number,end:number):void{
    this.ctx.restore();this.maxScroll=Math.max(0,end+this.scroll-bottom);
    if(this.maxScroll>0){const track=bottom-top-8,thumb=Math.max(24,track*track/(track+this.maxScroll));this.ctx.fillStyle=this.nightPanel?'#C1A16E99':'#76533177';this.ctx.fillRect(this.viewport.width-7,top+4+(track-thumb)*this.scroll/this.maxScroll,2,thumb);}
    this.regions=this.regions.flatMap((r,i)=>{if(i<first)return [r];const y=Math.max(top,r.y),edge=Math.min(bottom,r.y+r.h);return edge-y>=44?[{...r,y,h:edge-y}]:[];});
  }
  private returnPlaque(right:number,y:number,run:()=>void,label='返回'):void{
    const width=68,x=right-width;
    const pressed=this.gesture?.region?.id==='back'&&!this.gesture.drag;
    const tagY=y+7+(pressed?2:0);
    drawCourtyardHeading(this.ctx,x,tagY,width,30);
    drawMobileIcon(this.ctx,x+15,tagY+15,13,'back','#E2C395');
    this.text('返回',x+43,tagY+15,15,'#F5E9D0',650,'center',true);
    this.regions.push({id:'back',label,x,y,w:width,h:44,run});
  }
  private header(title:string,back:(()=>void)|null=()=>{this.session.page='home';}):number{
    const {top,width:w}=this.viewport;
    const titleWidth=Math.min(w-(back?112:32),Math.max(112,title.length*21+32));
    const titleX=back?16:(w-titleWidth)/2;
    drawCourtyardHeading(this.ctx,titleX,top+8,titleWidth,38);
    this.text(title,titleX+titleWidth/2,top+27,title.length>7?20:24,'#F5E9D0',650,'center',true);
    if(back)this.returnPlaque(w-16,top+5,back);
    return top+72;
  }
  private courtyardBackdrop():void{
    const c=this.ctx,{width:w,height:h}=this.viewport;
    if(!drawArt(c,'home',0,0,w,h,'cover'))drawHomeScene(c,0,0,w,h);
    const veil=c.createLinearGradient(0,0,0,h);
    veil.addColorStop(0,'#16131088');
    veil.addColorStop(.25,'#1A1410C9');
    veil.addColorStop(.68,'#1A1410DB');
    veil.addColorStop(1,'#14110FEF');
    c.fillStyle=veil;c.fillRect(0,0,w,h);
  }
  private open(page:Page):void{this.session.returnPage=this.session.page==='battle'?'pause':this.session.page;if(this.session.page==='battle')void this.session.pause(page);else this.session.page=page;this.cancel();}
  private point(c:Point):Point{return {x:this.board.x+c.x*this.board.k,y:this.board.y+c.y*this.board.k};}
  private route(from:Point,to:Point,color:string,animated:boolean,valid=true):void{
    const c=this.ctx,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(length<12)return;
    const ux=dx/length,uy=dy/length;
    const start=Math.min(30,length*.3),end=Math.min(25,length*.25),a={x:from.x+ux*start,y:from.y+uy*start},z={x:to.x-ux*end,y:to.y-uy*end};
    c.save();c.lineCap='round';c.strokeStyle='#EDE0C3';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(z.x,z.y);c.stroke();
    c.strokeStyle=color;c.lineWidth=1.4;if(!valid)c.setLineDash([3,4]);
    c.beginPath();c.moveTo(a.x,a.y);c.lineTo(z.x,z.y);c.stroke();c.setLineDash([]);
    if(valid&&length>70){
      const t=.25+(animated?(this.now%1600)/1600:.5)*.5,x=a.x+(z.x-a.x)*t,y=a.y+(z.y-a.y)*t;
      c.lineWidth=1.6;c.beginPath();c.moveTo(x-ux*4-uy*3,y-uy*4+ux*3);c.lineTo(x,y);c.lineTo(x-ux*4+uy*3,y-uy*4-ux*3);c.stroke();
    }
    c.restore();
  }
  private campAt(x:number,y:number,padding=0,sourceId?:string):Camp|null{
    const scale=Math.max(20,30*this.board.k)/28;
    const candidates=this.session.match?.battle.camps.map(c=>({c,p:this.point(c)})).filter(({c,p})=>{
      if(sourceId&&!neighbors(this.session.match!.battle,sourceId).includes(c.id))return false;
      // Include the building's painted box above its ground point, plus the existing count/tap area.
      const width=(c.type==='barracks'?([52,58,66] as const)[c.tier-1]!:62)*scale;
      return Math.abs(p.x-x)<=Math.max(28,width/2)+padding&&y>=p.y-Math.max(24,6+34*scale)-padding&&y<=p.y+Math.max(32,22*scale-6)+padding;
    }).sort((a,z)=>distance(a.p,{x,y})-distance(z.p,{x,y}));
    return candidates?.[0]?.c??null;
  }
  private dragTarget(x:number,y:number,sourceId:string):Camp|null{
    return this.campAt(x,y)??this.campAt(x,y,8,sourceId);
  }
  draw(now:number):void{
    this.now=now;const s=this.session,c=this.ctx,{width:w,height:h}=this.viewport;
    this.nightPanel=s.page!=='home'&&s.page!=='battle';
    const artRevision=(getArtRevision()+getFontRevision());
    if(this.renderedArtRevision!==artRevision){this.inputVersion++;this.gesture=null;this.renderedArtRevision=artRevision;}
    if(s.page!==this.previousPage){this.prepareRulesOpen=false;this.scroll=0;this.librarySelection=null;this.maxScroll=0;this.gesture=null;this.selected=null;this.card=null;this.modal=null;this.previousPage=s.page;this.pageStarted=now;this.pauseDetailsOpen=false;this.rankRulesOpen=false;this.resultDetailsOpen=false;this.cardRulesOpen=false;this.campDetailsOpen=false;this.aboutSection=null;this.aboutRulesOpen=false;this.manualChapter=0;this.manualStarted=null;this.manualChanged=null;this.settingVisuals.clear();}
    const context=this.inputContext();if(this.renderedContext!==null&&this.renderedContext!==context)this.clearInput();this.renderedContext=context;
    this.syncMatch();
    if(s.page!=='home'||s.profile?.choice?.choiceId!==this.passiveReward?.choiceId||s.profile?.choice?.state!=='claimed')this.passiveReward=null;
    if(s.page!=='battle'||s.match?.battle.id!==this.passiveStart?.matchId)this.passiveStart=null;
    if(s.page!=='result'||s.profile?.settings.reducedMotion)this.resultFeedback=null;
    if(this.gesture?.source&&s.match?.battle.camps.find(c=>c.id===this.gesture!.source)?.owner!=='P')this.cancel();
    if(this.preparedWeek!==s.profile?.weekId){if(this.preparedWeek!==null)this.cancel();this.preparedWeek=s.profile?.weekId??null;}
    this.regions=[];c.clearRect(0,0,w,h);c.fillStyle=COLORS.paper;c.fillRect(0,0,w,h);
    if(s.page!=='battle'&&s.page!=='home'&&s.page!=='settings'&&s.page!=='about'&&s.page!=='library'&&s.page!=='lessons'&&(s.page!=='pause'||!s.match))this.courtyardBackdrop();
    if(s.page==='prepare'||s.page==='choice'||s.page==='recovery'){drawDeskScene(c,w,h,this.viewport.top,this.viewport.bottom,s.page==='prepare'?'map':s.page==='choice'?'orders':'records');this.nightPanel=s.page==='choice';}
    if(s.page==='leaderboard'){drawNoticeScene(c,w,h,this.viewport.top,this.viewport.bottom);this.nightPanel=false;}
    if(!this.viewportUsable){
      if(s.page==='settings'||s.page==='about'||s.page==='library')this.courtyardBackdrop();
      this.clearInput();if(s.page==='battle')void s.suspend();
      this.text('请竖屏使用',w/2,h/2-16,16,COLORS.ink,500,'center');this.text('或调大窗口后继续',w/2,h/2+16,14,COLORS.ink,400,'center');return;
    }
    if(s.page==='loading'){
      const titleWidth=Math.min(w-40,240);
      drawCourtyardHeading(c,(w-titleWidth)/2,h*.38-27,titleWidth,54);
      this.text('谋定山河',w/2,h*.38,34,'#F4DFC0',750,'center',true);
      this.text('正在读取本地记录',w/2,h*.68,16,COLORS.ink,400,'center');
      const art=getArtStatus();
      this.text(art.failed?'部分画面暂用简图':`载入画面 ${art.ready}/${art.total}`,w/2,h*.68+30,13,COLORS.muted,400,'center');
    }
    else if(s.page==='battle')this.battle();
    else if(s.page==='home')this.home();
    else if(s.page==='lessons')this.lessons();
    else if(s.page==='prepare')this.prepare();
    else if(s.page==='pause')this.pause();
    else if(s.page==='result')this.result();
    else if(s.page==='choice')this.choice();
    else if(s.page==='library')this.library();
    else if(s.page==='ranks')this.ranks();
    else if(s.page==='settings')this.settings();
    else if(s.page==='about')this.about();
    else if(s.page==='recovery')this.recovery();
    else if(s.page==='leaderboard')this.leaderboard();
    if(this.armyPage!==null&&s.page==='pause')this.armyPanel();
    if(this.campDetailsOpen&&this.selected&&s.match)this.campDetailScreen();
    if(this.librarySelection&&(s.page==='library'||s.page==='prepare'))this.drawCardSheet();
    if(this.toastText&&Date.now()<this.toastUntil&&!this.modal){
      if(this.toastText.startsWith('还剩 30 秒：')||this.toastText.startsWith('新周已开始，')||this.toastText.startsWith('已升至')){
        if(s.page==='battle'){this.box(8,this.viewport.top+48,w-16,14,COLORS.paper,0);this.text(this.toastText,w/2,this.viewport.top+55,12,COLORS.ink,500,'center');}
      }else{const y=h-this.viewport.bottom-58;this.box(16,y,w-32,44,COLORS.ink,12);this.text(this.toastText.length>26?this.toastText.slice(0,26)+'…':this.toastText,w/2,y+22,14,'#FFFFFF',400,'center');}
    }
    if(s.busy){this.box(w-100,this.viewport.top+54,84,28,COLORS.surface,8);this.text('保存中…',w-58,this.viewport.top+68,12,COLORS.muted,400,'center');}
    if(this.modal!==this.shownModal){this.shownModal=this.modal;this.modalStarted=now;}
    if(this.modal){this.nightPanel=true;this.drawModal();}
    const modal=this.modal,armyPage=this.armyPage,choice=this.selectedChoice,campDetails=this.campDetailsOpen,selected=this.selected,rankRules=this.rankRulesOpen,prepareRules=this.prepareRulesOpen,aboutSection=this.aboutSection,aboutRules=this.aboutRulesOpen,manualChapter=this.manualChapter,manualStarted=this.manualStarted,resultDetails=this.resultDetailsOpen,cardRules=this.cardRulesOpen,pauseDetails=this.pauseDetailsOpen;
    this.regions=this.regions.map(r=>({...r,run:()=>{if(artRevision===(getArtRevision()+getFontRevision())&&context===this.inputContext()&&modal===this.modal&&armyPage===this.armyPage&&choice===this.selectedChoice&&campDetails===this.campDetailsOpen&&selected===this.selected&&rankRules===this.rankRulesOpen&&prepareRules===this.prepareRulesOpen&&aboutSection===this.aboutSection&&aboutRules===this.aboutRulesOpen&&manualChapter===this.manualChapter&&manualStarted===this.manualStarted&&resultDetails===this.resultDetailsOpen&&cardRules===this.cardRulesOpen&&pauseDetails===this.pauseDetailsOpen)r.run();}}));
  }
  private primaryAction():void{
    const s=this.session;if(s.busy)return;s.primary();
    if(s.page==='prepare')void s.start(s.nextMap);
  }
  private paintedHome():boolean{
    const s=this.session,p=s.profile!,{width:w,height:h,top,bottom}=this.viewport,c=this.ctx;
    if(!drawArt(c,'home',0,0,w,h,'cover'))drawHomeScene(c,0,0,w,h);
    drawHomeAtmosphere(c,w,h,this.now-this.pageStarted,p.settings.reducedMotion);
    const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#161310B8');shade.addColorStop(.23,'#18141012');shade.addColorStop(.69,'#18141000');shade.addColorStop(1,'#171311ED');c.fillStyle=shade;c.fillRect(0,0,w,h);
    c.save();
    c.shadowColor='#17120D';c.shadowBlur=5;c.shadowOffsetY=2;
    this.text('谋定山河',w/2-12,top+28,Math.min(52,(w-100)/4),'#F2DFC0',850,'center',true);
    c.restore();
    const settingsPressed=this.gesture?.region?.id==='settings'&&!this.gesture.drag;
    const settingY=top+11+(settingsPressed?2:0);
    drawCourtyardHeading(c,w-57,settingY,42,29);
    this.text('设置',w-36,settingY+14.5,15,'#F3E0BA',650,'center',true);
    this.regions.push({id:'settings',label:'设置',x:w-58,y:top+4,w:44,h:44,run:()=>this.open('settings')});
    const rank=rankName(p.rankPoints),rankWidth=Math.min(196,w-92);
    drawCourtyardHeading(c,22,top+56,Math.min(rankWidth,125),34,true);
    drawHomeEntryIcon(c,39,top+73,30,'rank',this.gesture?.region?.id==='rank-card'&&!this.gesture.drag);
    const rankSize=this.lines(rank,rankWidth-42,14).length>1?11:14;
    this.text(rank,61,top+73,rankSize,'#F3E0BA',650,'left',true);
    this.regions.push({id:'rank-card',label:rank,x:22,y:top+51,w:rankWidth,h:44,run:()=>this.open('ranks')});
    const navY=h-bottom-82;
    for(const [id,label,kind,fraction,page]of [['lessons','练兵','lessons',.22,'lessons'],['library','策略','cards',.5,'library'],['leaderboard','周榜','leaderboard',.78,'leaderboard']] as const){
      const x=w*fraction,pressed=this.gesture?.region?.id===id&&!this.gesture.drag;
      drawHomeEntryIcon(c,x,navY+23,38,kind,pressed);
      drawCourtyardHeading(c,x-33,navY+42,66,26);
      this.text(label,x,navY+55+(pressed?1:0),16,'#F4DFC0',750,'center',true);
      this.regions.push({id,label,x:x-34,y:navY,w:68,h:70,run:()=>this.open(page)});
    }
    const primaryY=h-bottom-164,noticeBottom=primaryY-12,noticeTop=top+108,noticeWidth=Math.min(300,w-40),noticeX=(w-noticeWidth)/2;
    const first=this.startScroll(noticeTop,noticeBottom);let row=noticeTop-this.scroll;
    if(this.passiveReward){
      const reward=this.passiveReward;reward.started??=this.now;
      const rewardWidth=noticeWidth,lines=this.lines(`层数 ${reward.before} → ${reward.after}`,rewardWidth-24,14),height=112+lines.length*21+(reward.cardId==='fortification'?22:0);
      this.box(noticeX,row,rewardWidth,height,'#F4EFE3F5',4,'#B7AD96');passiveRewardSymbol(c,noticeX+24,row+26,15,reward.cardId,(this.now-reward.started)/250,p.settings.reducedMotion);
      this.text(CARDS[reward.cardId].name,noticeX+47,row+26,17,COLORS.ink,650);
      let yy=this.paragraph(`层数 ${reward.before} → ${reward.after}`,noticeX+12,row+59,rewardWidth-24,14,COLORS.player,21);
      const limit=reward.cardId==='logistics'?15:20,label=reward.cardId==='farming'?'产兵':reward.cardId==='logistics'?'移速':'容量';
      yy=this.paragraph(`${label} +${(asNumber(passiveBonus(limit,reward.before))*100).toFixed(2)}% → +${(asNumber(passiveBonus(limit,reward.after))*100).toFixed(2)}%`,noticeX+12,yy+4,rewardWidth-24,12,COLORS.player,20);
      if(reward.cardId==='fortification'){const capacity=(level:number)=>campCapacity({tier:1},{passives:{...p.passiveLevels,fortification:level}});this.paragraph(`一级容量 ${capacity(reward.before)} → ${capacity(reward.after)}`,noticeX+12,yy+3,rewardWidth-24,12,COLORS.ink,20);}
      row+=height+12;
    }
    if(s.weekNotice){
      const nw=noticeWidth;this.box(noticeX,row,nw,168,'#F4EFE3F5',4,'#B7AD96');this.text('新周开启',noticeX+12,row+25,17,COLORS.ink,650);
      this.paragraph('旧锦囊、兵法、待选已到期',noticeX+12,row+54,nw-24,13,COLORS.muted,20);
      this.paragraph(p.weeklyRecord?`最近一周 ${p.weeklyRecord.lastWeekWins} 胜已归档，军功保留`:'军功与历史最高保留',noticeX+12,row+98,nw-24,12,COLORS.player,18);
      this.textButton('dismiss-week','知道了',noticeX+12,row+120,nw-24,44,()=>{s.weekNotice=false;});row+=180;
    }
    this.endScroll(first,noticeTop,noticeBottom,row+12);
    const label=s.error?'恢复记录':p.latestResult&&!p.latestResult.resultAcknowledged?'查看战果':p.choice?.state==='pending'?'领取奖励':p.activeMatch?'继续对战':!p.tutorialFirstWins.includes('L01')?'开始练兵':'出征';
    const pw=Math.min(220,w*.55);this.button('primary',label,(w-pw)/2,primaryY,pw,52,()=>this.primaryAction(),'primary');
    drawHomeEntryIcon(c,w-36,primaryY+26,34,'map',this.gesture?.region?.id==='home-prepare'&&!this.gesture.drag);
    this.regions.push({id:'home-prepare',label:'战前情报',x:w-58,y:primaryY+4,w:44,h:44,run:()=>this.open('prepare')});
    return true;
  }
  private cardPainting(id:CardId,x:number,y:number,w:number,h:number):void{
    drawOrderMount(this.ctx,x,y,w,h);
    drawStrategyIllustration(this.ctx,x+4,y+4,w-8,h-8,id);
  }
  private home():void{this.paintedHome();}
  private miniature(mapId:MapId,y:number,height:number):void{
    const m=MAPS[mapId],w=this.viewport.width,k=Math.min((w-56)/360,height/540),x=(w-360*k)/2;
    const centers=m.camps.map(c=>({x:x+c.x*k-20,y:c.y*k}));
    const routes=m.roads.map(([a,z])=>({from:centers[m.camps.findIndex(c=>c.id===a)]!,to:centers[m.camps.findIndex(c=>c.id===z)]!}));
    const landforms=battlefieldLandforms(w-40,height,centers,routes,mapId);
    this.ctx.save();rounded(this.ctx,20,y,w-40,height,12);this.ctx.clip();this.ctx.translate(20,y);const paintedTerrain=drawTerrain(this.ctx,w-40,height,centers,mapId,routes);drawBattlefieldLandforms(this.ctx,landforms,mapId,paintedTerrain);this.ctx.restore();
    drawRoads(this.ctx,{mapId,ruleRevision:'1.6',camps:m.camps},p=>({x:x+p.x*k,y:y+p.y*k}),null,Math.max(.55,k));
    this.ctx.save();rounded(this.ctx,20,y,w-40,height,12);this.ctx.clip();this.ctx.translate(20,y);drawBattlefieldBridges(this.ctx,landforms);this.ctx.restore();
    for(const c of m.camps)building(this.ctx,x+c.x*k,y+c.y*k,Math.min(28,Math.max(20,height*.09)),c.type,c.tier,c.owner);
  }
  private lessons():void{
    const s=this.session,p=s.profile,{width:w,height:h,bottom}=this.viewport,c=this.ctx;
    if(!drawArt(c,'drill-yard',0,0,w,h,'cover'))this.courtyardBackdrop();
    yardAtmosphere(c,w,h,this.now-this.pageStarted,!!p?.settings.reducedMotion);
    const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#17150FE0');shade.addColorStop(.3,'#17150F12');shade.addColorStop(1,'#17150FBB');c.fillStyle=shade;c.fillRect(0,0,w,h);
    const y=this.header('练兵场');
    const start=y+28,edge=h-bottom,spacing=138,ids=['L01','L02','L03'] as const;
    this.text('三关习兵',22,y+5,14,COLORS.ink,550);this.text(`已通关 ${p?.tutorialFirstWins.length??0} / 3`,w-22,y+5,13,COLORS.muted,500,'right');
    const first=this.startScroll(start,edge);
    for(const [i,id]of ids.entries()){
      const row=start+i*spacing-this.scroll,open=p?lessonOpen(p,id):id==='L01',won=p?.tutorialFirstWins.includes(id),tx=122,tw=w-tx-36;
      drawCourtyardHeading(c,110,row+8,w-130,36);
      c.fillStyle='#1E170D66';c.fillRect(114,row+47,w-138,17);
      c.fillStyle='#93836826';c.beginPath();c.ellipse(72,row+91,39,12,0,0,Math.PI*2);c.fill();
      building(c,68,row+80,38,(['barracks','fort','relay'] as const)[i]!,i===0?1:2,open?'P':null);
      this.text(['壹','贰','叁'][i]!,43,row+26,14,'#E4B675',650,'center',true);
      this.text(MAPS[id].name,tx,row+28,w<340?16:18,COLORS.ink,650,'left',true);
      this.text(won?'已通关':open?['派兵 · 夺城','塔营 · 升级','整编 · 驰援'][i]!: `先通关第 ${i} 关`,tx,row+52,12,won?COLORS.player:COLORS.muted,500);
      this.button(`lesson-${id}`,won?'重玩':open?'进入':'未解锁',tx,row+67,Math.min(112,tw),44,()=>{if(open)void s.start(id);else this.notify('先完成上一课，即可解锁');},open?'primary':'quiet');
    }
    let end=start+ids.length*spacing-this.scroll;
    end=this.paragraph('首胜解锁选策资格，不直接赠卡。',26,end+8,w-52,13,COLORS.muted,21)+20;
    if(s.error||p?.activeMatch||p?.choice?.state==='pending'||(p?.latestResult&&!p.latestResult.resultAcknowledged))end=this.paragraph('本次为无奖励练兵，原对局和待领策略保留。',24,end,w-48,13,COLORS.muted,21)+12;
    this.endScroll(first,start,edge,end+12);
  }
  private prepare():void{
    const s=this.session,p=s.profile!,w=this.viewport.width,top=this.header('战前准备'),startY=this.viewport.height-this.viewport.bottom-68;
    const first=this.startScroll(top-10,startY-12),y=top-this.scroll;
    this.text(MAPS[s.nextMap].name,22,y+10,24,COLORS.ink,700,'left',true);this.text('你与 3 个电脑，四分钟一局',22,y+43,14,COLORS.muted);
    const mh=Math.max(160,Math.min(330,(startY-top)*.48));this.miniature(s.nextMap,y+66,mh);
    let row=y+mh+92;
    row=this.paragraph('占城最多者胜，同城数比兵力。',22,row,w-44,14,COLORS.ink,22);
    row=this.paragraph(`本周锦囊 ${ACTIVE_IDS.reduce((n,id)=>n+p.activeInventory[id],0)} 张 · 兵法 ${PASSIVE_IDS.reduce((n,id)=>n+p.passiveLevels[id],0)} 层`,22,row+10,w-44,14,COLORS.player,22);
    this.button('prepare-rules',this.prepareRulesOpen?'收起对局规则':'查看对局规则',22,row+8,w-44,44,()=>{this.prepareRulesOpen=!this.prepareRulesOpen;this.scroll=0;},'quiet');row+=64;
    if(this.prepareRulesOpen)row=this.paragraph('电脑各有乡勇 1 张，无被动加成。有效冠军 +30；失败、平局和放弃不扣分，不获策略或周胜。',22,row,w-44,13,COLORS.muted,21)+20;
    const cw=(w-64)/4;
    for(const [i,id]of ACTIVE_IDS.entries()){
      const x=20+i*(cw+8),open=p.unlockedCardIds.includes(id);
      this.cardPainting(id,x,row,cw,64);this.text(CARDS[id].short,x+cw/2,row+80,13,COLORS.ink,650,'center');
      this.text(open?`×${count(p.activeInventory[id])}`:'未解锁',x+cw/2,row+99,12,COLORS.muted,400,'center');
      this.regions.push({id:`prepare-card-${id}`,label:`查看${CARDS[id].name}，${open?`${p.activeInventory[id]}张`:'未解锁'}`,x,y:row,w:cw,h:108,run:()=>{this.openCardDetails(id);}});
    }
    row+=126;
    const passiveWidth=(w-56)/3;
    for(const [i,id]of PASSIVE_IDS.entries()){
      const x=20+i*(passiveWidth+8),open=p.unlockedCardIds.includes(id);
      drawCourtyardPanel(this.ctx,x,row,passiveWidth,54,'tile',!open,true);
      this.text(CARDS[id].short,x+passiveWidth/2,row+18,14,'#F3DFC0',650,'center',true);
      this.text(open?`${count(p.passiveLevels[id])} 层`:'未解锁',x+passiveWidth/2,row+39,11,'#D6BFA0',400,'center');
      this.regions.push({id:`prepare-card-${id}`,label:`查看${CARDS[id].name}，${open?`${p.passiveLevels[id]}层`:'未解锁'}`,x,y:row,w:passiveWidth,h:54,run:()=>this.openCardDetails(id)});
    }
    row+=70;
    this.wide('prepare-library','查看策略详情',row,()=>this.open('library'));row+=60;
    this.endScroll(first,top-10,startY-12,row);
    this.regions=this.regions.filter(r=>r.h>=44);
    if(this.maxScroll>0)this.text('上滑查看准备信息',w/2,startY-6,11,'#E3CBA9',400,'center');
    this.wide('start-arena','开始对战',startY,()=>void s.start(s.nextMap),true);
  }
  private battle(interactive=true):void{
    const s=this.session,b=s.match!.battle,{width:w,height:h,top,bottom}=this.viewport;
    const boardTop=top+52,footer=72,boardHeight=h-bottom-footer-boardTop;const k=this.boardScale;
    this.board={x:(w-360*k)/2,y:boardTop+(boardHeight-540*k)/2,k};
    const nightPanel=this.nightPanel;this.nightPanel=false;
    const terrainPoint=(p:Point)=>this.point(p);
    const terrainEdges=b.ruleRevision==='1.6'?MAPS[b.mapId].roads:b.camps.flatMap((c,i)=>b.camps.slice(i+1).map(z=>[c.id,z.id] as const));
    const terrainRoutes=terrainEdges.flatMap(([a,z])=>{const from=b.camps.find(c=>c.id===a),to=b.camps.find(c=>c.id===z);return from&&to?[{from:terrainPoint(from),to:terrainPoint(to)}]:[];});
    const centers=b.camps.map(terrainPoint),landforms=b.ruleRevision==='1.6'?battlefieldLandforms(w,h-bottom-footer,centers,terrainRoutes,b.mapId):null;
    const paintedTerrain=drawTerrain(this.ctx,w,h-bottom-footer,centers,b.mapId,terrainRoutes);
    if(landforms){this.ctx.save();this.ctx.beginPath();this.ctx.rect(0,0,w,h-bottom-footer);this.ctx.clip();drawBattlefieldLandforms(this.ctx,landforms,b.mapId,paintedTerrain);this.ctx.restore();}
    const fieldShade=this.ctx.createLinearGradient(0,0,0,h-bottom-footer);
    fieldShade.addColorStop(0,'#211A1766');fieldShade.addColorStop(.24,'#2C211611');
    fieldShade.addColorStop(.72,'#2C211600');fieldShade.addColorStop(1,'#211A1766');
    this.ctx.fillStyle=fieldShade;this.ctx.fillRect(0,0,w,h-bottom-footer);
    const pausePressed=this.gesture?.region?.id==='pause'&&!this.gesture.drag;
    if(interactive){
      drawGameControl(this.ctx,18,top+8,32,'pause',pausePressed);
      this.regions.push({id:'pause',label:'暂停',x:12,y:top+2,w:44,h:44,run:()=>{this.cancel();void s.pause();}});
    }
    const clockWidth=Math.min(88,w-200);
    drawCourtyardHeading(this.ctx,(w-clockWidth)/2,top+7,clockWidth,33);
    drawCourtyardHeading(this.ctx,w-98,top+10,86,28);
    const stats=battleStats(b),owned=stats.find(st=>st.faction==='P')!.camps;
    const alert=this.threats.update(b);if(alert.fresh&&s.page==='battle')this.onThreat();
    this.text(b.deadlineMs!==null?time(b.deadlineMs-b.gameMs):time(b.gameMs),w/2,top+23,20,'#F3E1BC',650,'center');
    const order=[...this.effects].reverse().find(({event:e,created})=>e.faction==='P'&&b.gameMs>=created&&b.gameMs-created<600&&ACTIVE_IDS.includes(e.reason as ActiveCardId)&&(e.type==='card'||e.type==='dispatch'&&e.reason==='march'));
    if(order){const id=order.event.reason as ActiveCardId;this.box(w/2-58,top+43,116,20,'#F1E9D8E3',8);cardSymbol(this.ctx,w/2-45,top+53,8,id);this.text(CARDS[id].name,w/2+9,top+53,12,COLORS.ink,650,'center');}
    else if(b.ruleRevision==='1.5')this.text('旧版直达',w/2,top+49,10,COLORS.muted,500,'center');
    this.text(standingSummary(b),w-23,top+24,11,'#E5D4B2',600,'right');
    const selected=b.camps.find(c=>c.id===this.selected);
    const g=this.gesture,source=g?.source?b.camps.find(c=>c.id===g.source):undefined;
    const target=g?(g.drag&&g.source?this.dragTarget(g.point.x,g.point.y,g.source):this.campAt(g.point.x,g.point.y)):null;
    const preview=source&&g?.drag&&!g.region?.id.startsWith('upgrade-camp-')&&(!this.card||this.card==='march')?dispatchPreview(b,source,target,this.card==='march'):null;
    const roadSource=this.gesture?.source??(selected?.owner==='P'?selected.id:null);
    drawSampleGround(this.ctx,b,p=>this.point(p),k);
    drawRoads(this.ctx,b,p=>this.point(p),roadSource,k);
    if(landforms){this.ctx.save();this.ctx.beginPath();this.ctx.rect(0,0,w,h-bottom-footer);this.ctx.clip();drawBattlefieldBridges(this.ctx,landforms,MAPS[b.mapId].roads.flatMap(([a,z],i)=>a===roadSource||z===roadSource?[i]:[]));this.ctx.restore();}
    if(selected?.type==='fort'){const p=this.point(selected);this.ctx.strokeStyle=factionColor(selected.owner);this.ctx.fillStyle='#176D7010';this.ctx.beginPath();this.ctx.arc(p.x,p.y,120*k,0,Math.PI*2);this.ctx.fill();this.ctx.setLineDash([5,5]);this.ctx.stroke();this.ctx.setLineDash([]);}
    const crowded=b.armies.length>40,animateMarch=!crowded&&!s.profile?.settings.reducedMotion;
    if(crowded||s.profile?.settings.reducedMotion)this.retreats.reset();
    for(const ghost of this.retreats.frames(b.gameMs)){
      const p=this.point(ghost.position);this.ctx.save();this.ctx.globalAlpha=ghost.alpha;
      marchingSoldier(this.ctx,p.x,p.y,ghost.troopType,ghost.faction);flag(this.ctx,p.x-6,p.y-19,4,ghost.faction);this.ctx.restore();
    }
    const accents=this.activeAccents(),towerAims=new Map<string,number>(),bowLifts=new Map<string,number>();
    if(!s.profile?.settings.reducedMotion)for(const {event:e,created}of this.effects){
      const age=b.gameMs-created;if(age<0||age>=300||!accents.has(e.id))continue;
      if(e.type==='tower-shot'&&e.sourceId&&e.position){
        const source=b.camps.find(c=>c.id===e.sourceId);if(source&&source.owner===e.faction){const p=this.point(source),q=this.point(e.position);towerAims.set(source.id,Math.atan2(q.y-p.y+6,q.x-p.x));}
      }
      if(e.type==='volley'&&e.sourceId&&(e.amount??0)>0&&!crowded)bowLifts.set(e.sourceId,2*Math.sin(Math.PI*age/300));
    }
    const moving=b.armies.map(a=>({army:a,point:this.point(armyPosition(a,b.gameMs)),march:isMarching(b,a)}));
    this.retreats.observe(b,!s.profile?.settings.reducedMotion);
    const bounds={x:8,y:boardTop,w:w-16,h:boardHeight},obstacles:Rect[]=[];
    const compactStatus=k<.8;
    const remaining=(deadline:number)=>compactStatus?String(Math.ceil((deadline-b.gameMs)/1000)):((deadline-b.gameMs)/1000).toFixed(1);
    const statuses=new Map(b.camps.map(camp=>{
      const suppressed=camp.feintUntil>b.gameMs;
      const stop=suppressed?`${camp.type==='fort'?'停产/射':'停产'} ${remaining(camp.feintUntil)}s`:null;
      const drum=camp.mobilizeUntil>b.gameMs?`${asNumber(camp.bonusBudget)>0?'':'尽·'}${remaining(camp.mobilizeUntil)}s`:null;
      return [camp.id,{stop,drum}];
    }));
    const upgradeTargets=new Map<string,Rect>();
    const showUpgrade=interactive&&!this.card&&(!g||g.region?.id.startsWith('upgrade-camp-'))&&!this.upgradePending&&!s.busy&&b.status==='running'&&!b.awaitingFirstDispatch;
    for(const camp of b.camps){
      const p=this.point(camp);obstacles.push({x:p.x-32,y:p.y-34,w:66,h:70});
      this.ctx.font=CAMP_COUNT_FONT;
      const countWidth=Math.max(34,Math.ceil(this.ctx.measureText(String(camp.garrison)).width)+14);
      obstacles.push({x:p.x-countWidth/2-26,y:p.y+13,w:countWidth+26,h:22});
      const status=(value:string,y:number,size:number,symbol=false)=>{this.ctx.font=`600 ${size}px sans-serif`;const width=this.ctx.measureText(value).width+(symbol?14:6);obstacles.push({x:p.x-width/2,y:y-size/2-2,w:width,h:size+4});};
      const {stop,drum}=statuses.get(camp.id)!;
      if(stop)status(stop,p.y-39,11,true);
      if(drum)status(drum,p.y-(stop?54:39),11,true);
      if(camp.owner==='P'&&camp.id===alert.campId)status('末城受袭',p.y+45,11);
      if(showUpgrade&&(!selected||selected.id===camp.id)&&camp.owner==='P'&&camp.tier<3&&camp.garrison>=UPGRADE[camp.tier as 1|2].threshold){
        const scale=Math.max(20,30*k)/28,width=camp.tier===1?46:58,height=camp.tier===1?38:48;
        // The visible seal touches this tier's right eave; extra touch space extends outwards.
        const r={x:p.x+Math.max(12,width*.32*scale)-10,y:p.y-6+(22-height*.72)*scale-22,w:44,h:44};
        if(r.y>=bounds.y&&r.x>=bounds.x&&r.x+r.w<=bounds.x+bounds.w){upgradeTargets.set(camp.id,r);obstacles.push(r);}
      }
    }
    const priority=(a:typeof moving[number])=>a.army.targetId===this.selected||a.army.sourceId===this.gesture?.source?0:a.army.arrivalAtMs-b.gameMs<=1000?1:a.army.targetId===alert.campId?2:3;
    const sorted=[...moving].sort((a,z)=>priority(a)-priority(z)||a.army.arrivalAtMs-z.army.arrivalAtMs||a.army.id.localeCompare(z.army.id));
    // Reserve the dispatched column's digit width: real tower losses must not shrink or relocate its banner.
    const labels=this.armyLabels.layout(sorted.map(({army:a,point:p})=>({id:a.id,point:p,width:Math.max(36,22+String(a.initialCount).length*9)})),bounds,obstacles);
    const departures=this.drawEffects(bounds,[...obstacles,...labels.values(),...moving.map(({point:p})=>({x:p.x-10,y:p.y-22,w:20,h:32}))],accents);
    const accentCost=this.effects.reduce((n,{event})=>n+(accents.has(event.id)?battleAccentCost(event):0),0);
    const dustSlots=Math.max(0,Math.floor((80-accentCost)/3));
    const statusText=(value:string,x:number,y:number,size:number,color:string,symbol?:'feint'|'mobilize')=>{
      this.ctx.font=`600 ${size}px sans-serif`;const width=this.ctx.measureText(value).width+(symbol?14:6);
      this.ctx.fillStyle=symbol==='feint'?'#44372A':COLORS.surface;this.ctx.fillRect(x-width/2,y-size/2-2,width,size+4);
      if(symbol)cardSymbol(this.ctx,x-width/2+6,y,4.5,symbol);
      this.text(value,x+(symbol?5:0),y,size,color,600,'center');
    };
    // Ground target marks stay below city artwork and every authoritative count.
    if(this.card&&this.card!=='march')for(const camp of b.camps){
      if(cardTargetPreview(b,this.card,camp).valid)this.targetHalo(this.point(camp),COLORS.player,false);
    }
    if(g?.drag&&source?.owner==='P'&&preview&&target&&target!==source)this.targetHalo(this.point(target),preview.valid?COLORS.player:COLORS.muted,true);
    // Sort world actors by their ground contact, not by object category. Counts stay above them.
    const actors:{depth:number;draw:()=>void}[]=[];
    for(const camp of b.camps){
      const p=this.point(camp),active=camp.id===this.selected||camp.id===this.gesture?.source;
      if(alert.campId===camp.id&&alert.emphasized&&!s.profile?.settings.reducedMotion){this.ctx.strokeStyle=COLORS.enemy1;this.ctx.lineWidth=3;this.ctx.strokeRect(p.x-31,p.y-32,62,69);}
      if(active){this.ctx.strokeStyle=COLORS.player;this.ctx.lineWidth=2.5;this.ctx.beginPath();this.ctx.arc(p.x,p.y,29,0,Math.PI*2);this.ctx.stroke();}
      actors.push({depth:p.y+16,draw:()=>building(this.ctx,p.x,p.y-6,Math.max(20,30*k),camp.type,camp.tier,camp.owner,towerAims.get(camp.id))});
    }
    for(const [armyIndex,{army:a,point:p,march}] of moving.entries()){
      actors.push({depth:p.y+9,draw:()=>{
      const angle=Math.atan2(a.to.y-a.from.y,a.to.x-a.from.x);
      const walked=distance(a.from,armyPosition(a,b.gameMs)),phase=[...a.id].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,0)/997;
      marchTrail(this.ctx,p,angle,a.faction,b.gameMs,!!s.profile?.settings.reducedMotion,crowded||armyIndex>=dustSlots,march);
      const people=crowded?1:a.remainingCount<5?1:a.remainingCount<10?2:a.remainingCount<20?3:a.remainingCount<40?4:5;
      if(march&&animateMarch){
        this.ctx.strokeStyle=factionColor(a.faction);this.ctx.lineWidth=1;this.ctx.beginPath();
        this.ctx.moveTo(p.x-16*Math.cos(angle),p.y-16*Math.sin(angle));this.ctx.lineTo(p.x-30*Math.cos(angle),p.y-30*Math.sin(angle));
        this.ctx.moveTo(p.x-18*Math.cos(angle)-4*Math.sin(angle),p.y-18*Math.sin(angle)+4*Math.cos(angle));this.ctx.lineTo(p.x-26*Math.cos(angle)-4*Math.sin(angle),p.y-26*Math.sin(angle)+4*Math.cos(angle));this.ctx.stroke();
      }
      for(let i=people-1;i>=0;i--)marchingSoldier(this.ctx,p.x-Math.cos(angle)*i*12+Math.sin(angle)*(i===0?0:i%2?5:-3),p.y-Math.sin(angle)*i*12-Math.cos(angle)*(i===0?0:i%2?5:-3),a.troopType,a.faction,i===0?1:.7,animateMarch?Math.sin(walked/2.75+phase*6.28+i)*.8:0,i===0?bowLifts.get(a.id)??0:0,Math.cos(angle)<-.1?-1:1,infantryDistanceFrame(walked,i,animateMarch,phase));
      if(!labels.has(a.id))flag(this.ctx,p.x-6,p.y-19,4,a.faction);
      }});
    }
    for(const actor of actors.sort((a,z)=>a.depth-z.depth))actor.draw();
    for(const {event:e,created}of this.effects){
      if(e.type!=='army-loss'||b.gameMs-created>=300)continue;
      const a=b.armies.find(a=>a.id===e.targetId);if(!a)continue;
      const p=this.point(armyPosition(a,b.gameMs));soldierHit(this.ctx,p.x,p.y,a.troopType,a.faction,b.gameMs-created,!!s.profile?.settings.reducedMotion||crowded);
    }
    this.drawCombatAccents(accents);
    for(const camp of b.camps){
      const p=this.point(camp),active=camp.id===this.selected||camp.id===this.gesture?.source;
      const departure=departures.get(camp.id);
      if(departure&&camp.owner)departureAccent(this.ctx,p.x,p.y,this.point(departure.target),camp.owner,departure.age*160/450);
      campPennant(this.ctx,p.x,p.y+24,camp.garrison,camp.owner,active,camp.tier);
      const {stop,drum}=statuses.get(camp.id)!;
      if(stop)statusText(stop,p.x,p.y-39,11,'#F6E7C7','feint');
      if(drum)statusText(drum,p.x,p.y-(stop?54:39),11,COLORS.player,'mobilize');
      if(camp.owner==='P'&&camp.id===alert.campId){
        const threat=b.armies.some(a=>a.targetId===camp.id&&a.faction!==camp.owner);
        if(threat)statusText('末城受袭',p.x,p.y+45,11,COLORS.enemy1);
      }
    }
    if(b.awaitingFirstDispatch){
      const source=this.point(b.camps.find(c=>c.id==='L01-P1')!),target=this.point(b.camps.find(c=>c.id==='L01-N1')!);
      this.ctx.strokeStyle=COLORS.player;this.ctx.lineWidth=3;this.ctx.setLineDash([5,6]);this.ctx.beginPath();this.ctx.moveTo(source.x,source.y);this.ctx.lineTo(target.x,target.y);this.ctx.stroke();this.ctx.setLineDash([]);
      const t=s.page!=='battle'||s.profile?.settings.reducedMotion?.5:(this.now%1700)/1700;this.ctx.fillStyle=COLORS.player;this.ctx.beginPath();this.ctx.arc(source.x+(target.x-source.x)*t,source.y+(target.y-source.y)*t,6,0,Math.PI*2);this.ctx.fill();
    }
    if(g?.drag&&source?.owner==='P'&&preview){
      const color=preview.valid?COLORS.player:COLORS.muted;
      this.route(this.point(source),g.point,color,!s.profile?.settings.reducedMotion,preview.valid);
      for(const id of preview.towerIds){const tower=b.camps.find(c=>c.id===id)!,p=this.point(tower);this.ctx.strokeStyle=COLORS.enemy1;this.ctx.lineWidth=1;this.ctx.setLineDash([3,5]);this.ctx.beginPath();this.ctx.arc(p.x,p.y,120*k,0,Math.PI*2);this.ctx.stroke();this.ctx.setLineDash([]);}
    }
    for(const {army:a,point:p}of sorted){const r=labels.get(a.id);if(!r)continue;
      const hit=this.effects.filter(({event:e,created})=>e.type==='army-loss'&&e.targetId===a.id&&b.gameMs-created<300).reduce((n,{event:e})=>n+(e.amount??0),0);
      drawArmyPennant(this.ctx,r,p,a.faction,a.remainingCount,hit,animateMarch?Math.sin(b.gameMs/140+a.departedAtMs)*1.2:0);
      if(hit)this.text(`−${hit}`,r.x+r.w/2,r.y>=bounds.y+18?r.y-8:r.y+r.h+9,12,COLORS.enemy1,700,'center');
    }
    if(!interactive){this.nightPanel=nightPanel;return;}
    for(const [campId,r]of upgradeTargets){
      const camp=b.camps.find(c=>c.id===campId)!,id=`upgrade-camp-${campId}`;
      const pressed=g?.region?.id===id&&!g.drag;
      this.upgradeArrow(r.x+10,r.y+22+(pressed?1:0),pressed);
      const tier=camp.tier,matchId=b.id;
      this.regions.push({id,label:`升级${CAMP_CONFIG[camp.type].name}，消耗 ${UPGRADE[tier as 1|2].cost} 兵`,...r,run:()=>this.commitUpgrade(campId,tier,matchId)});
    }
    const fy=h-bottom-footer;
    this.ctx.fillStyle=preview||MAPS[b.mapId].tutorial?'#D7C5A1F2':'#302A23F5';this.ctx.fillRect(0,fy,w,footer+bottom);this.ctx.fillStyle='#A18A5E';this.ctx.fillRect(0,fy,w,2);
    if(preview){
      this.text(`派 ${preview.sent} · 留 ${preview.retained}`,20,fy+22,15,COLORS.ink,550);
      const digits=(preview.normalMs/1000).toFixed(2)===(preview.travelMs/1000).toFixed(2)?3:2;
      const eta=this.card==='march'?`普通 ${(preview.normalMs/1000).toFixed(digits)} → 加急 ${(preview.travelMs/1000).toFixed(digits)} 秒`:`${(preview.travelMs/1000).toFixed(1)} 秒到达`;
      const note=g?.drag?preview.valid?`${eta}${preview.towerIds.length?' · 当心箭塔':''}`:preview.reason:'沿亮路拖向邻城';
      this.paragraph(note,20,fy+43,w-40,13,preview.towerIds.length?COLORS.enemy1:COLORS.muted,18);
      const incoming=target?incomingSummary(b,target):null;
      if(preview.valid&&incoming)this.text(`另有${factionName(incoming.faction)} ${incoming.count}兵 · ${(incoming.etaMs/1000).toFixed(1)}秒到${incoming.teams>1?` · 共${incoming.teams}队`:''}`,20,fy+63,11,incoming.faction==='P'?COLORS.muted:COLORS.enemy1);
      else if(preview.valid&&preview.volleyDamage!==null)this.text(`齐射按本队人数取整 · 当前预计 ${preview.volleyDamage} 兵`,20,fy+63,11,COLORS.muted);
    }else if(this.card){
      const target=g&&!g.region?this.campAt(g.point.x,g.point.y):null;
      this.box(8,fy-44,w-16,44,'#FFFCF3F2',18);
      this.regions.push({id:'card-hint',label:'用策提示',x:8,y:fy-44,w:w-16,h:44,run:()=>{}});
      const hint=this.card==='march'?'拖兵出征 · 提速40%':target?cardTargetPreview(b,this.card,target).message:this.card==='feint'?'点敌营 · 停产停射4秒':this.card==='mobilize'?'点己营 · 短时加快征兵':'点己营 · 补6兵';
      this.text(hint,20,fy-22,w<350?12:13,COLORS.ink,550);
      this.iconButton('cancel-card','取消',w-56,fy-44,44,'close',()=>this.cancel());
      this.battleCards(fy);
    }else if(MAPS[b.mapId].tutorial){
      const upgradeCue=b.mapId==='L02'&&!selected?b.camps.find(c=>c.owner==='P'&&c.tier===1&&c.garrison>=UPGRADE[1].threshold):null;
      const hint=b.awaitingFirstDispatch?'拖向亮起的营地，派出一半兵':upgradeCue?`${CAMP_CONFIG[upgradeCue.type].name}已达${UPGRADE[1].threshold}兵，轻点升级`:s.temporary?'临时练兵 · 无奖励':MAPS[b.mapId].description;
      if(b.awaitingFirstDispatch||upgradeCue||b.gameMs<6500)this.paragraph(hint,20,fy+23,w-40,14,COLORS.ink,22);
    }else{
      this.battleCards(fy);
    }
      if(selected&&!this.card&&!g?.drag)this.campSummary(selected,fy);
    this.nightPanel=nightPanel;
  }
  private battleCards(fy:number):void{
      const s=this.session,b=s.match!.battle,w=this.viewport.width,inv=factionOf(b,'P')!.inventory,bw=(w-40)/4;
      for(const [i,id]of ACTIVE_IDS.entries()){
        const unlocked=s.profile!.unlockedCardIds.includes(id),label=`${CARDS[id].short} ${unlocked?count(inv[id]):'锁'}`;
        this.orderButton(id,label,14+i*(bw+4),fy+9,bw,()=>{
          this.selected=null;if(!unlocked){this.notify(`通关 ${MAPS[CARDS[id].lesson].name} 解锁`);return;}if(inv[id]<1){this.notify('暂无库存，获胜后可选择获得');return;}this.inputVersion++;this.card=this.card===id?null:id;
        });
      }
  }
  private targetHalo(p:Point,color:string,active:boolean):void{
    const c=this.ctx;c.save();c.strokeStyle=color;c.fillStyle=active?'#327C7025':'#327C7014';c.lineWidth=active?2.5:1.5;
    c.beginPath();c.ellipse(p.x,p.y+9,32,18,0,0,Math.PI*2);c.fill();c.stroke();
    for(const side of [-1,1]){c.beginPath();c.moveTo(p.x+side*38,p.y+9);c.lineTo(p.x+side*33,p.y+9);c.stroke();}c.restore();
  }
  private campSummary(camp:Camp,_y:number):void{
    const {width:w,height:h,top:inset,bottom}=this.viewport,b=this.session.match!.battle,point=this.point(camp);
    const bounds={x:8,y:inset+66,w:w-16,h:h-bottom-72-inset-70};
    const obstacles=b.camps.filter(c=>c.id!==camp.id).map(c=>{const p=this.point(c);return{x:p.x-29,y:p.y-32,w:58,h:68};});
    const shortcut=this.regions.find(r=>r.id===`upgrade-camp-${camp.id}`);
    if(shortcut)obstacles.push(shortcut);
    const panel=placeCampPopover(point,bounds,obstacles,{w:Math.min(160,w-32),h:64});
    if(panel.x<point.x+34&&panel.x+panel.w>point.x-34&&panel.y<point.y+34&&panel.y+panel.h>point.y-34)return;
    const {x,y,w:pw,h:ph}=panel;
    this.box(x,y,pw,ph,'#EFE3C8F2',3);
    this.ctx.strokeStyle='#A79C7B80';this.ctx.lineWidth=.7;this.ctx.beginPath();this.ctx.moveTo(x+9,y+ph-1);this.ctx.lineTo(x+pw-9,y+ph-1);this.ctx.stroke();
    this.regions.push({id:'camp-surface',label:'城池军情',...panel,run:()=>{}});
    const owner=factionOf(b,camp.owner),capacity=campCapacity(camp,owner);
    const rate=camp.garrison>=capacity?0:asNumber(productionRate(b,camp,owner,b.gameMs))*(camp.mobilizeUntil>b.gameMs&&asNumber(camp.bonusBudget)>0?2:1);
    this.text(`产兵 ${rate.toFixed(2)} 兵/秒`,x+10,y+21,12,COLORS.ink);
    this.text(`容量 ${capacity} 兵`,x+10,y+46,12,COLORS.muted);
    drawMobileIcon(this.ctx,x+pw-19,y+21,12,'close',COLORS.muted);
    this.regions.push({id:'close-camp',label:'收起',x:x+pw-44,y,w:44,h:44,run:()=>{this.selected=null;}});
  }
  private upgradeButton(camp:Camp,x:number,y:number,w:number,h:number):void{
    if(camp.tier===3)return;
    const tier=camp.tier,u=UPGRADE[tier],ready=camp.garrison>=u.threshold,next=tier===1?'二级':'三级';
    const label=this.upgradePending?'升级中…':!ready?`还差 ${u.threshold-camp.garrison} 兵`:`升至${next} · 消耗 ${u.cost} · 留 ${camp.garrison-u.cost}`;
    const matchId=this.session.match!.battle.id;
    this.button('upgrade',label,x,y,w,h,()=>this.commitUpgrade(camp.id,tier,matchId),ready&&!this.upgradePending?'primary':'quiet');
  }
  private commitUpgrade(campId:string,tier:number,expectedMatchId:string):void{
      if(tier!==1&&tier!==2)return;
      const s=this.session,u=UPGRADE[tier],next=tier===1?'二级':'三级',current=s.match?.battle.camps.find(c=>c.id===campId);
      if(s.match?.battle.id!==expectedMatchId||s.match.battle.awaitingFirstDispatch||this.card)return;
      if(this.upgradePending||s.busy||s.page!=='battle'||!current||current.owner!=='P'||current.tier!==tier||s.match?.battle.status!=='running')return;
      if(current.garrison<u.threshold){this.notify(`还差 ${u.threshold-current.garrison} 兵，驻军达到 ${u.threshold} 可升级`);return;}
      const matchId=s.match.battle.id,version=this.inputVersion;this.upgradePending=true;
      void s.action({kind:'upgrade',targetId:campId}).then(ok=>{
        if(ok&&s.page==='battle'&&s.match?.battle.id===matchId){
          if(version===this.inputVersion&&this.selected===campId){this.selected=null;this.campDetailsOpen=false;}
          this.notify(`已升至${next}`);this.toastUntil=Date.now()+1400;
        }
      }).finally(()=>{this.upgradePending=false;});
  }
  private campDetailScreen():void{
    this.nightPanel=true;
    const b=this.session.match!.battle,camp=b.camps.find(c=>c.id===this.selected);if(!camp){this.campDetailsOpen=false;return;}
    const w=this.viewport.width,h=this.viewport.height;this.regions=[];this.courtyardBackdrop();
    const y=this.header('营地详情',()=>{this.campDetailsOpen=false;});
    building(this.ctx,w/2,y+48,48,camp.type,camp.tier,camp.owner);
    campPennant(this.ctx,w/2,y+99,camp.garrison,camp.owner,true,camp.tier);
    this.box(16,y+132,w-32,151);
    this.campPanel(camp,y+139);
    this.text(this.session.page==='pause'?'已暂停 · 返回后可继续对战':'查询中战斗继续',w/2,y+309,12,COLORS.muted,400,'center');
  }

  private armyButton(y:number):void{
    this.button('army-list',`${this.session.match!.battle.ruleRevision==='1.6'?'沿路行军':'旧版直达'} · ${this.session.match!.battle.armies.length} 队`,22,y,this.viewport.width-44,44,()=>{this.cancel();this.selected=null;this.armyPage=0;});
  }
  private armyPanel():void{
    const b=this.session.match!.battle,{width:w,height:h,top,bottom}=this.viewport;
    this.regions=[];this.courtyardBackdrop();
    const y=this.header('行军军情',()=>{this.armyPage=null;});
    const armies=[...b.armies].sort((a,z)=>a.arrivalAtMs-z.arrivalAtMs||a.id.localeCompare(z.id));
    const size=Math.max(1,Math.floor((h-bottom-56-y-34+8)/88)),pages=Math.max(1,Math.ceil(armies.length/size));
    this.armyPage=Math.min(this.armyPage!,pages-1);
    this.text(`共 ${armies.length} 队 · 已暂停 · 点队伍查看目标`,22,y+10,13,COLORS.muted);
    const location=(id:string)=>{const c=b.camps.find(c=>c.id===id)!;return `${c.y<210?'上':c.y>350?'下':'中'}${c.x<120?'左':c.x>240?'右':'央'}${CAMP_CONFIG[c.type].name}`;};
    for(const [i,a]of armies.slice(this.armyPage*size,(this.armyPage+1)*size).entries()){
      const row=y+34+i*88,type={infantry:'步兵',archer:'弓兵',cavalry:'骑兵',guard:'守备兵'}[a.troopType];
      this.box(16,row,w-32,80,COLORS.surface,6,'#CABB9F');flag(this.ctx,29,row+18,5,a.faction);
      this.text(`${factionName(a.faction).split(' · ')[0]} ${type} ${a.remainingCount} 人`,42,row+18,14,COLORS.ink,600);
      this.text(`${location(a.sourceId)} → ${location(a.targetId)}`,28,row+40,13,COLORS.ink);
      const volley=a.troopType==='archer'?a.volleyState==='pending'?' · 待齐射':a.volleyState==='fired'?' · 已齐射':' · 已跳过齐射':'';
      this.text(`${Math.max(0,(a.arrivalAtMs-b.gameMs)/1000).toFixed(2)} 秒到达${volley}`,28,row+62,13,COLORS.muted);
      this.regions.push({id:`army-target-${a.id}`,label:`${factionName(a.faction)} ${type} ${a.remainingCount} 人，查看${location(a.targetId)}`,x:16,y:row,w:w-32,h:80,run:()=>{if(!b.armies.some(current=>current.id===a.id))return;this.armyPage=null;this.selected=a.targetId;this.queryOffset=0;this.campDetailsOpen=true;}});
    }
    if(!armies.length)this.text('当前没有行军部队',w/2,y+76,16,COLORS.muted,400,'center');
    const footer=h-bottom-56;
    if(this.armyPage>0)this.button('army-prev','上一页',20,footer,86,44,()=>{this.armyPage=this.armyPage!-1;});
    this.text(`${this.armyPage+1} / ${pages}`,w/2,footer+22,14,COLORS.ink,600,'center');
    if(this.armyPage<pages-1)this.button('army-next','下一页',w-106,footer,86,44,()=>{this.armyPage=this.armyPage!+1;});
  }
  private campPanel(camp:Camp,y:number):void{
    const b=this.session.match!.battle,w=this.viewport.width,owner=factionOf(b,camp.owner),capacity=campCapacity(camp,owner),rate=asNumber(productionRate(b,camp,owner,b.gameMs));
    this.text(`${CAMP_CONFIG[camp.type].name} ${['I','II','III'][camp.tier-1]}`,22,y+22,18,COLORS.ink,650);
    this.button('close-camp','收起',w-72,y+3,56,44,()=>{this.campDetailsOpen=false;},'quiet');
    const incoming=b.armies.filter(a=>a.targetId===camp.id);
    const baseRate=asNumber(CAMP_CONFIG[camp.type].rate)*asNumber(TIER_RATE[camp.tier])*(b.ruleRevision==='1.6'?.75:1);
    const currentRate=camp.garrison>=capacity?0:rate*(camp.mobilizeUntil>b.gameMs&&asNumber(camp.bonusBudget)>0?2:1);
    const conversion=[`友援或占领后转为${CAMP_CONFIG[camp.type].troopName}`,'存活兵力 1∶1 转换，途中不换兵'];
    const pages:string[][]=[
      [`${factionName(camp.owner)} · ${CAMP_CONFIG[camp.type].troopName}`,`驻军 ${camp.garrison}/${capacity} · 来兵 ${incoming.length} 队`],
      [`产速：基础 ${baseRate.toFixed(2)} → ${currentRate.toFixed(2)}/秒`,`容量：基础 ${BASE_CAPACITY[camp.tier]} → ${capacity}`],
      [`速度：基础 ${((b.ruleRevision==='1.6'?24:80)*CAMP_CONFIG[camp.type].speed).toFixed(2)} → ${(owner?movementSpeed(b,camp,owner):(b.ruleRevision==='1.6'?24:80)*CAMP_CONFIG[camp.type].speed).toFixed(2)}/秒`,'当前营地升级不改变已在途部队'],
      camp.type==='fort'?[`塔射：120 范围 · ${SHOT_INTERVAL[camp.tier]/1000} 秒/发`,camp.feintUntil>b.gameMs?'当前停射，现有驻军仍可出征':camp.garrison>0?'可打路过敌军与范围内敌营':'驻军为零，按后续节拍检查开火']:
        camp.type==='archery'?['出征齐射一次 · 驻营不自动射击','70 范围，准备 0.5 秒，30%向下取整']:conversion,
    ];
    if(camp.type==='fort'||camp.type==='archery')pages.push(conversion);
    if(b.ruleRevision==='1.6')pages.splice(1,0,[`道路出口 ${neighbors(b,camp.id).length} 条 · 仅能向相邻城市派兵`,MAPS[b.mapId].tutorial?'抵达后再次派兵，不能越过中间城池':'可沿外环迂回，中央连通四向但易受夹击']);
    if(camp.mobilizeUntil>b.gameMs||camp.feintUntil>b.gameMs)pages.push([
      camp.mobilizeUntil>b.gameMs?`征兵剩 ${((camp.mobilizeUntil-b.gameMs)/1000).toFixed(1)} 秒 · 额度 ${asNumber(camp.bonusBudget).toFixed(2)}`:'当前无征兵效果',
      camp.feintUntil>b.gameMs?`停产剩 ${((camp.feintUntil-b.gameMs)/1000).toFixed(1)} 秒`:'当前未受火袭',
    ]);
    if(camp.owner==='P'&&camp.tier!==3){const tier=camp.tier,u=UPGRADE[tier],upgradeRate=asNumber(productionRate(b,{...camp,feintUntil:0},owner,b.gameMs));pages.push([`升级需 ${u.threshold} 兵，消耗 ${u.cost}，留 ${Math.max(0,camp.garrison-u.cost)}`,`自然产速 ${upgradeRate.toFixed(2)} → ${(upgradeRate*asNumber(TIER_RATE[tier===1?2:3])/asNumber(TIER_RATE[tier])).toFixed(2)}/秒`,`升级容量：${capacity} → ${campCapacity({tier:tier===1?2:3},owner)}`]);}
    for(const a of incoming){
      const state=a.volleyState==='pending'?`待齐射：${Math.max(0,(a.volleyCheckAtMs!-b.gameMs)/1000).toFixed(2)} 秒后`:
        a.volleyState==='fired'?'已齐射，本次不再射击':a.volleyState==='skipped'?`已跳过：${a.volleySkipReason==='friendly'?'当时为友方':a.volleySkipReason==='empty'?'当时为空营':'取整伤害为零'}`:'到达后按当时归属结算／整编';
      pages.push([`${factionName(a.faction)} ${a.remainingCount} 兵 · ${( (a.arrivalAtMs-b.gameMs)/1000).toFixed(2)} 秒`,state]);
    }
    this.ctx.font='400 13px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    const readable:string[][]=[];
    for(const lines of pages){const wrapped:string[]=[];for(const line of lines){let part='';for(const char of line){if(this.ctx.measureText(part+char).width>w-44){wrapped.push(part);part=char;}else part+=char;}if(part)wrapped.push(part);}for(let i=0;i<wrapped.length;i+=2)readable.push(wrapped.slice(i,i+2));}
    const page=this.queryOffset%readable.length;
    this.button('camp-details',`${page+1}/${readable.length} ▸`,w-136,y+3,60,44,()=>{this.queryOffset++;},'quiet');
    this.text(readable[page]![0]!,22,y+53,13,COLORS.muted);if(readable[page]![1])this.text(readable[page]![1]!,22,y+76,13,COLORS.muted);
    if(this.session.page==='battle'&&camp.owner==='P'&&camp.tier!==3)this.upgradeButton(camp,22,y+91,w-44,44);
    else this.text(this.session.page==='pause'?'已暂停，继续对战后可升级':camp.tier===3?'已达最高等级':'敌方与中立营地不可升级',22,y+118,13,COLORS.muted);
  }
  private effectDuration(e:BattleEvent):number{
    if(['capture','dispatch','arrival','tower-shot','volley'].includes(e.type))return tacticalDuration(e.type);
    if(e.type==='card'){const target=this.session.match!.battle.camps.find(c=>c.id===e.targetId);const renewed=e.reason==='mobilize'&&(target?.mobilizeUntil??0)>e.atMs+6000||e.reason==='feint'&&(target?.feintUntil??0)>e.atMs+4000;return renewed?280:600;}
    return e.type==='upgrade'?220:160;
  }
  private activeAccents():Set<number>{
    const b=this.session.match!.battle;
    return selectBattleAccents(this.effects.filter(({event:e,created,owner})=>b.gameMs-created<this.effectDuration(e)&&(!['card','upgrade'].includes(e.type)||b.camps.find(c=>c.id===e.targetId)?.owner===owner)).map(e=>e.event));
  }
  private drawCombatAccents(accents:Set<number>):void{
    const b=this.session.match!.battle,reduced=!!this.session.profile?.settings.reducedMotion,crowded=b.armies.length>40;
    for(const {event:e,created}of this.effects){
      const age=b.gameMs-created;if(age<0||!accents.has(e.id))continue;
      const target=b.camps.find(c=>c.id===e.targetId),source=b.camps.find(c=>c.id===e.sourceId);
      if(e.type==='tower-shot'||e.type==='volley'){
        const from=e.type==='volley'?e.position:source,to=e.type==='volley'?target:e.position;
        if(from&&to)shotAccent(this.ctx,this.point(from),this.point(to),e.faction??null,age,e.type==='volley',reduced,crowded);
      }else if(target&&e.type==='card'&&e.reason&&e.faction){
        const p=this.point(target);cardAccent(this.ctx,p.x-29,p.y-27,e.reason as ActiveCardId,CAMP_CONFIG[target.type].troop,e.faction,e.amount??0,age,reduced||crowded,this.effectDuration(e));
      }else if(target&&e.type==='arrival'&&e.reason==='enemy'&&e.faction){
        tacticalAccent(this.ctx,'arrival',this.point(target),source?this.point(source):null,e.faction,age,reduced,crowded);
      }else if(target&&e.type==='capture'&&e.faction){
        // Capture is one combined sequence: retain the actual contact before the flag flourish.
        const arrival=this.effects.find(({event:a})=>a.type==='arrival'&&a.reason==='enemy'&&a.targetId===e.targetId&&a.faction===e.faction&&a.atMs===e.atMs)?.event;
        const origin=arrival&&b.camps.find(c=>c.id===arrival.sourceId);
        if(arrival)tacticalAccent(this.ctx,'arrival',this.point(target),origin?this.point(origin):null,e.faction,age,reduced,crowded);
      }
    }
  }
  private drawEffects(bounds:Rect,obstacles:Rect[],accents:Set<number>):Map<string,{target:Point;age:number}>{
    const b=this.session.match!.battle,now=b.gameMs,reduced=this.session.profile?.settings.reducedMotion;
    const departures=new Map<string,{target:Point;age:number}>();
    this.effects=this.effects.filter(e=>now-e.created<800);
    const labels=new Map<string,{label:string;point:Point;priority:number;color:string}>();
    const totals=new Map<string,number>();
    const accumulate=(key:string,amount:number)=>{const total=(totals.get(key)??0)+amount;totals.set(key,total);return total;};
    for(const {event:e,created,owner}of this.effects){
      const target=b.camps.find(c=>c.id===e.targetId),source=b.camps.find(c=>c.id===e.sourceId),age=now-created;
      if(target&&target.owner!==owner&&(e.type==='card'||e.type==='upgrade'))continue;
      const motion=accents.has(e.id);
      if(age<0)continue;
      if(e.type==='dispatch'&&source&&target&&source.owner===e.faction&&motion){
        tacticalAccent(this.ctx,'dispatch',this.point(source),this.point(target),e.faction!,age,!!reduced,b.armies.length>40);
        if(!reduced&&b.armies.length<=40)departures.set(source.id,{target,age});
      }
      if(target&&source&&e.type==='arrival'&&e.reason==='friendly'&&e.faction===target.owner&&motion&&!reduced&&b.armies.length<=40&&this.effects.some(({event:a})=>a.type==='garrison-change'&&a.targetId===e.targetId&&a.atMs===e.atMs&&(a.amount??0)>0)){
        const p=this.point(target);arrivalAccent(this.ctx,p.x,p.y,CAMP_CONFIG[source.type].troop,CAMP_CONFIG[target.type].troop,e.faction!,age*160/550,this.point(source));
      }
      if(target&&e.type==='upgrade'&&motion)upgradeAccent(this.ctx,this.point(target),target.tier,Math.max(20,30*this.board.k)/28,age,!!reduced);
      if(target&&e.type==='capture'&&e.faction===target.owner&&motion){
        // Ownership already changed; only the decorative ground seal waits for contact.
        if(reduced||age>=180)tacticalAccent(this.ctx,'capture',this.point(target),null,e.faction!,reduced?age:(age-180)*800/620,!!reduced,b.armies.length>40);
      }
      if(e.type==='army-loss')continue; // Moving losses are attached to that army's stable count badge.
      const point=target;if(!point||age>=(e.type==='capture'?800:600))continue;
      const amount=e.amount??0;let label='',priority=0,color=COLORS.player;
      if(e.type==='capture'&&e.faction===target?.owner){label=`夺城 · ${CAMP_CONFIG[target!.type].troopName}`;priority=10;}
      else if(e.type==='garrison-loss'){
        accumulate(`loss:${e.targetId}:${e.reason}`,amount);
        label=([['tower-shot','塔射'],['volley','齐射']] as const).flatMap(([reason,name])=>{const loss=totals.get(`loss:${e.targetId}:${reason}`)??0;return loss?[`${name} −${loss}`]:[];}).join(' · ');
        priority=9;color=COLORS.enemy1;
      }
      else if(e.type==='upgrade'){label=`升级 −${amount}`;priority=8;}
      else if(e.type==='garrison-change'){label=`${amount>0?'+':''}${amount} ${target?CAMP_CONFIG[target.type].troopName:''}`;priority=7;color=amount<0?COLORS.enemy1:COLORS.player;}
      else if(e.type==='card'){
        const total=accumulate(`card:${e.targetId}:${e.reason}`,e.reason==='supply'?amount:1);
        label=e.reason==='mobilize'?`征兵 +${6*total}秒 / 额度 +${8*total}`:e.reason==='feint'?`停产 +${4*total}秒`:`乡勇 +${total}`;priority=6;
      }
      else if(e.type==='overflow'){label=`溢出 ${amount}，未入营`;priority=5;color=COLORS.muted;}
      else if(e.type==='volley-skipped'){label=e.reason==='friendly'?'齐射跳过 · 友方':e.reason==='empty'?'齐射跳过 · 空营':'齐射跳过 · 取整为零';priority=4;color=COLORS.muted;}
      else if(e.type==='arrival'&&e.reason==='friendly'){label=`归队 · ${CAMP_CONFIG[target!.type].troopName}`;priority=3;}
      const old=labels.get(e.targetId!);if(label&&(!old||priority>=old.priority))labels.set(e.targetId!,{label,point,priority,color});
    }
    this.ctx.font='600 13px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    const placed=placeArmyLabels([...labels].sort((a,z)=>z[1].priority-a[1].priority).map(([id,{label,point}])=>({id,point:this.point(point),width:this.ctx.measureText(label).width+12})),bounds,obstacles,true);
    for(const [id,{label,point,color}]of labels){
      const r=placed.get(id);if(!r)continue;const p=this.point(point);
      this.ctx.strokeStyle='#87958B';this.ctx.lineWidth=1;this.ctx.beginPath();this.ctx.moveTo(p.x,p.y);this.ctx.lineTo(r.x+r.w/2,r.y+12);this.ctx.stroke();
      this.box(r.x,r.y,r.w,r.h,COLORS.surface,6);this.text(label,r.x+r.w/2,r.y+12,13,color,600,'center');
    }
    return departures;
  }
  private pause():void{
    const s=this.session,m=s.match,{width:w,height:h,top,bottom}=this.viewport;
    if(!m){const y=this.header('对局已暂停');this.wide('home','返回首页',y+50,()=>{s.page='home';});return;}
    this.battle(false);this.regions=[];
    this.ctx.fillStyle='#19130FBD';this.ctx.fillRect(0,0,w,h);
    this.ctx.save();this.ctx.globalAlpha*=s.profile?.settings.reducedMotion?1:.7+.3*Math.min(1,Math.max(0,(this.now-this.pageStarted)/140));
    const expired=s.expired&&!s.temporary,panelH=Math.min(h-top-bottom-24,(this.pauseDetailsOpen?474:340)+(expired?48:0));
    const pw=Math.min(296,w-32),x=(w-pw)/2,y=top+(h-top-bottom-panelH)/2;
    this.box(x,y+5,pw,panelH,'#102C2855',24);this.box(x,y,pw,panelH,COLORS.surface,24,'#C9BA96');
    this.text('已暂停',w/2,y+36,25,COLORS.ink,650,'center',true);
    this.text(`${MAPS[m.battle.mapId].name} · ${time(m.battle.gameMs)}`,w/2,y+65,13,COLORS.muted,500,'center');
    // The backdrop has no input regions; closing resumes only through the session transaction.
    drawCourtyardHeading(this.ctx,x+pw-49,y+12,44,29);
    this.text(expired?'返回':'继续',x+pw-27,y+26.5,13,'#F3DFC0',500,'center',true);
    this.regions.push({id:'back',label:expired?'回首页':'继续对战',x:x+pw-47,y:y+5,w:44,h:44,run:()=>{if(expired)void s.pause('home');else void s.resume();}});
    const contentTop=y+83,contentBottom=y+panelH-82,first=this.startScroll(contentTop,contentBottom);
    let row=contentTop+15-this.scroll;
    row=this.paragraph(expired?(s.match?.meritPolicy==='growth-v1'?'超过 24 小时不能继续。放弃不扣军功；回首页可保留本局。':'超过 24 小时不能继续。旧局放弃扣 10 军功，最低 0；回首页可保留本局。'):s.temporary?'临时练兵 · 不影响原存档':s.match?.modeId==='arena-four'&&!s.match.meritPolicy?'旧局计分：第2/3/4名扣5/8/10，放弃扣10。':'已暂停，战场为你保留',x+16,row,pw-32,13,COLORS.muted,20)+18;
    const gap=(pw-48)/3,actionsX=x+24;
    this.textButton('save-home',s.temporary?'退出练兵':'回首页',actionsX,row,gap-4,44,()=>void s.pause('home'));
    this.textButton('pause-settings','设置',actionsX+gap,row,gap-4,44,()=>this.open('settings'));
    this.textButton('forfeit','放弃',actionsX+gap*2,row,gap-4,44,()=>this.confirmForfeit());
    row+=52;
    this.textButton('pause-details',this.pauseDetailsOpen?'收起军情':'查看军情 ›',w/2-70,row,140,44,()=>{this.pauseDetailsOpen=!this.pauseDetailsOpen;this.scroll=0;});row+=48;
    if(this.pauseDetailsOpen){
      for(const id of PASSIVE_IDS){const level=factionOf(m.battle,'P')!.passives[id];row=this.paragraph(`${CARDS[id].short} ${level} 层 · ${id==='farming'?'产兵':id==='logistics'?'移速':'容量'} +${(asNumber(passiveBonus(id==='logistics'?15:20,level))*100).toFixed(2)}%`,x+18,row+5,pw-36,13,COLORS.muted,21);}
      this.button('army-list',`查看行军 · ${m.battle.armies.length} 队`,x+18,row+8,pw-36,44,()=>{this.cancel();this.selected=null;this.armyPage=0;});row+=60;
    }
    this.endScroll(first,contentTop,contentBottom,row+4);
    this.button('resume',expired?'已超时，保留待处理':'继续对战',x+18,y+panelH-66,pw-36,48,()=>void s.resume(),expired?'quiet':'primary');
    this.ctx.restore();
  }
  private confirmForfeit():void{
    const p=this.session.profile,m=this.session.match,formal=!this.session.temporary&&m?.rankedCommitment;
    this.modal={title:'放弃本局？',body:formal&&this.session.match?.meritPolicy==='growth-v1'?'放弃不扣军功，不获策略或周胜。已用锦囊不返还。':formal?`军功 ${p!.rankPoints} → ${Math.max(0,p!.rankPoints-10)}，实际扣 ${Math.min(10,p!.rankPoints)}。已用锦囊不返还。`:'本局不计军功。放弃后可重新练兵，不影响已保存的正式进度。',label:'确认放弃',run:()=>void this.session.forfeit()};
  }
  private result():void{
    const s=this.session,p=s.profile,r=s.temporary?.battle.result??p?.latestResult?.result,record=s.temporary?null:p?.latestResult,w=this.viewport.width,start=this.header('战报',()=>void s.acknowledge()),bottom=this.viewport.height-this.viewport.bottom,y=start-this.scroll;
    if(!r){this.paragraph('本局已处理，记录已保存。',22,y+30,w-44);this.wide('result-home','返回首页',y+100,()=>void s.acknowledge());return;}
    const first=this.startScroll(start-8,bottom-151),won=r.independentWinner==='P',tied=r.playerRank===1&&!won;
    const compact=bottom-start<540,heroH=compact?80:170,c=this.ctx;
    c.save();rounded(c,20,y,w-40,heroH,4);c.clip();drawArt(c,'home',20,y,w-40,heroH,'cover');c.fillStyle=won?'#21160B45':'#182124C9';c.fillRect(20,y,w-40,heroH);c.restore();
    const entrance=s.profile?.settings.reducedMotion?1:Math.min(1,Math.max(0,(this.now-this.pageStarted)/240));
    c.save();c.translate(w/2,y+heroH*(compact?.3:.44));c.scale(.86+.14*(1-Math.pow(1-entrance,3)),.86+.14*(1-Math.pow(1-entrance,3)));
    if(won){const size=compact?32:48;drawSettingSeal(c,-size/2,-size/2,size,size,true);this.text('捷',0,0,size*.7,'#FFE5B6',550,'center',true);}
    else{c.rotate(-.12);drawRankStandard(c,0,0,compact?48:82,0);}c.restore();
    this.text(won?'夺城告捷':tied?'并列第 1':`本局第 ${r.playerRank} 名`,w/2,y+heroH-15,29,COLORS.ink,700,'center',true);
    fieldPaper(c,20,y+heroH+3,w-40,Math.max(700,bottom-y));
    this.nightPanel=false;
    let row=y+heroH+(compact?19:29);
    const own=r.stats.find(st=>st.faction==='P');
    row=this.paragraph(`${own?`我方 ${own.camps} 城 · ${own.troops} 兵 · `:''}用时 ${time(r.atMs)}`,24,row,w-48,14,COLORS.muted,22)+8;
    row=this.paragraph(resultExplanation(r),24,row,w-48,compact?12:13,COLORS.muted,compact?18:21)+(compact?12:25);
    if(record?.modeId==='arena-four'){
      const delta=`军功 ${record.rankDeltaApplied>=0?'+':''}${record.rankDeltaApplied}`;
      const pointSize=this.lines(delta,w-88,32).length>1?20:32;
      this.text(delta,w/2,row+7,pointSize,record.rankDeltaApplied<0?COLORS.enemy1:COLORS.player,650,'center');
      this.resultBadge(record.matchId,record.rankPointsBefore,record.rankPointsAfter,w-39,row+7,row-18);
      row+=40;
      row=this.paragraph(`${rankName(record.rankPointsAfter)} · 当前 ${record.rankPointsAfter}`,24,row,w-48,14,COLORS.muted,22)+10;
      if(won&&!record.qualified)row=this.paragraph('本局未有效派兵，不获军功、策略或周胜。',24,row,w-48,13,COLORS.muted,21)+10;
      if(!s.temporary&&p?.choice?.state==='pending'){
        const ids=p.choice.candidateIds.slice(0,3),sw=compact?40:52,sh=compact?46:62;
        for(const [i,id]of ids.entries()){const sx=w/2+(i-(ids.length-1)/2)*(sw+8)-sw/2;drawCourtyardPanel(c,sx,row,sw,sh,'tile');drawStrategyIllustration(c,sx+4,row+5,sw-8,sh-10,id);}
        row+=sh+18;
      }
    }else row=this.paragraph(s.temporary?'临时练兵 · 不写首胜，不计军功、不发策略':won?'教学首胜解锁新的候选资格，不直接赠卡。':'练兵不扣军功，可以免费重试。',24,row,w-48,15,COLORS.player,23)+10;
    this.textButton('result-details',this.resultDetailsOpen?'收起战报':'查看战报 ›',w/2-70,row,140,44,()=>{this.resultDetailsOpen=!this.resultDetailsOpen;if(!this.resultDetailsOpen)this.scroll=0;});row+=58;
    if(this.resultDetailsOpen){
      const reason=r.reason==='last-camp'?'只剩一方持有营地':r.reason==='eliminated'?'最后一城失守，在途军士撤离':'四分钟结束，按城数与总兵力裁决';
      row=this.paragraph(reason,24,row,w-48,14,COLORS.muted,23)+10;
      if(record?.modeId==='arena-four'){
        if(record.rankDeltaRequested<record.rankDeltaApplied)row=this.paragraph(`军功最低为 0，本次实际扣除 ${-record.rankDeltaApplied}。`,24,row,w-48,13,COLORS.muted,21)+10;
        const oldLevel=Math.floor(record.rankPointsBefore/30),newLevel=Math.floor(record.rankPointsAfter/30);
        if(newLevel!==oldLevel)row=this.paragraph(`${newLevel>oldLevel?'军衔晋升':'当前军衔调整'}：${rankName(record.rankPointsBefore)} → ${rankName(record.rankPointsAfter)}`,24,row,w-48,14,COLORS.player,22)+10;
        this.text(`本周 ${record.winsAfter} 胜`,24,row,13,COLORS.muted);row+=30;
      }
      for(const st of r.stats){this.text(`${factionName(st.faction)} · ${st.rank===null?'未结算':`第 ${st.rank} 名`}`,24,row,13,COLORS.ink);this.text(`${st.camps} 城 / ${st.troops} 兵`,w-24,row,13,COLORS.muted,400,'right');row+=27;}
    }
    this.nightPanel=true;
    this.endScroll(first,start-8,bottom-151,row+12);
    if(!s.temporary&&p?.choice?.state==='pending')this.text('冠军奖励 · 策略任选一张',w/2,bottom-143,12,COLORS.player,500,'center');
    else if(this.maxScroll>24)this.text('上滑查看',w/2,bottom-143,12,COLORS.muted,400,'center');
    if(!s.temporary&&p?.choice?.state==='pending')this.wide('choose-reward','领取奖励',bottom-126,()=>void s.acknowledge('choice'),true);
    else if(record?.modeId==='tutorial'||s.temporary){
      const mapId=s.temporary?.battle.mapId??record!.mapId,temporary=!!s.temporary,next=mapId==='L01'?'L02':mapId==='L02'?'L03':null;
      this.wide('again',!won?'重试本关':temporary?'再练一次':next?'继续下一课':'开始征战',bottom-126,()=>{void(async()=>{
        await s.acknowledge();if(s.error&&!temporary)return;
        if(!won||temporary)await s.start(mapId,temporary);else if(next)await s.start(next);else await s.start(s.nextMap);
      })();},true);
    }else this.wide('again','再来一局',bottom-126,()=>{if(s.busy)return;void(async()=>{await s.acknowledge('prepare');if(s.page==='prepare'&&!s.error)await s.start(s.nextMap);})();},true);
    const skipNextLesson=record?.modeId==='tutorial'&&won&&record.mapId!=='L03';
    this.textButton('result-home',!p?'返回记录处理':skipNextLesson?'开始征战':'回首页',w/2-80,bottom-65,160,44,()=>void s.acknowledge(skipNextLesson?'prepare':'home'));
  }
  private resultBadge(matchId:string,before:number,after:number,x:number,y:number,row:number):void{
    const c=this.ctx,feedback=this.resultFeedback?.matchId===matchId?this.resultFeedback:null;
    const level=(points:number)=>Math.floor(points/30),tier=(points:number)=>level(points)===0?0:level(points)>=36?8:Math.floor((level(points)-1)/5)+1;
    const changed=level(before)!==level(after),promotion=after>before&&changed,cross=promotion&&tier(before)!==tier(after);
    const duration=cross?300:promotion?220:after<before?150:0;
    if(feedback&&feedback.started===null)feedback.started=this.now;
    const elapsed=feedback?Math.max(0,this.now-feedback.started!):duration;
    const progress=duration?Math.min(1,elapsed/duration):1;
    if(progress===1)this.resultFeedback=null;
    if(cross&&progress<1){c.save();c.globalAlpha=1-progress;rankBadge(c,x,y,16,before);c.restore();}
    c.save();c.globalAlpha=cross?progress:after<before?.65+.35*progress:1;c.translate(x,y);c.scale(cross?.75+.25*progress:1,1);rankBadge(c,0,0,16,after);c.restore();
    if(promotion&&progress<1){c.save();c.globalAlpha=(1-progress)*.65;rounded(c,20,row,this.viewport.width-40,78,16);c.strokeStyle=COLORS.player;c.lineWidth=2;c.stroke();c.restore();}
  }
  private expiry():string{const p=this.session.profile!;const date=new Date(nextWeekAt(p.weekId)+8*3600000).toISOString().slice(5,10);return `北京时间 ${date} 周一 00:00 到期`;}
  private choice():void{
    if(getArtStatus().ready===getArtStatus().total&&this.session.profile?.choice?.state==='pending'){this.paintedChoice();return;}
    const s=this.session,p=s.profile!,choice=p.choice,w=this.viewport.width,y=this.header('择一领令',()=>void s.acknowledge()),bottom=this.viewport.height-this.viewport.bottom;
    if(!choice||choice.state!=='pending'){this.paragraph('本次选择已处理或已到期。',22,y+30,w-44);return;}
    this.text(this.expiry(),22,y+5,13,COLORS.muted);
    const first=this.startScroll(y+27,bottom-137);let top=y+29-this.scroll;
    for(const id of choice.candidateIds){
      const card=CARDS[id],value=card.kind==='active'?p.activeInventory[id as ActiveCardId]:p.passiveLevels[id as 'farming'];
      const receivable=Number.isSafeInteger(value+1);
      const status=`${card.kind==='active'?'库存':'层数'} ${value}${receivable?` → ${value+1}`:' · 数量超出可保存范围'}`,description=card.kind==='passive'?'本周每局自动，不消耗；重复领取递减提升。':card.description;
      const descriptionY=Math.max(213,57+this.lines(status,w-186,14).length*21+12),bonusY=descriptionY+this.lines(description,w-72,13).length*20+5;
      const itemH=Math.max(136,bonusY+(card.kind==='passive'?20:0));
      this.box(20,top,w-40,itemH,this.selectedChoice===id?'#583125':COLORS.surface,14,this.selectedChoice===id?COLORS.player:'#CEBFA1');
      cardSymbol(this.ctx,44,top+24,13,id);this.text(card.name,65,top+23,18,COLORS.ink,650);this.text(card.kind==='active'?'主动':'被动',w-36,top+23,12,COLORS.muted,400,'right');
      this.cardPainting(id,36,top+48,98,147);
      this.paragraph(status,150,top+63,w-186,14,COLORS.player,21);
      this.paragraph(description,36,top+descriptionY,w-72,13,COLORS.muted,20);
      if(card.kind==='passive'){const limit=id==='logistics'?15:20,label=id==='farming'?'产兵':id==='logistics'?'移速':'容量';this.text(`${label} +${(asNumber(passiveBonus(limit,value))*100).toFixed(2)}%${receivable?` → +${(asNumber(passiveBonus(limit,value+1))*100).toFixed(2)}%`:''}`,36,top+bonusY,12,COLORS.player);}
      this.regions.push({id:`choice-${id}`,label:`选择${card.name}`,x:20,y:top,w:w-40,h:itemH,run:()=>{if(!receivable){this.notify('该卡数量超出可保存范围，请选择其他候选');return;}this.selectedChoice=id;}});
      top+=itemH+10;
    }
    this.endScroll(first,y+27,bottom-137,top);
    if(this.maxScroll>0)this.text(`上滑查看全部 ${choice.candidateIds.length} 张候选`,w/2,bottom-127,11,COLORS.muted,400,'center');
    this.wide('claim',this.selectedChoice?`确认领取${CARDS[this.selectedChoice].short}`:'请选择一张',bottom-117,()=>{if(this.selectedChoice)void s.claim(this.selectedChoice);else this.notify('先点选一张策略');},!!this.selectedChoice);
    this.textButton('abandon-choice','放弃本次机会',20,bottom-56,w-40,44,()=>{this.modal={title:'放弃选策机会？',body:'这次冠军只可领取一张。放弃后不补发，不退还机会，也没有补偿货币。',label:'确认放弃',run:()=>void s.abandonChoice()};});
  }
  private paintedChoice():void{
    const s=this.session,p=s.profile!,choice=p.choice!,w=this.viewport.width,top=this.header('择一领令',()=>void s.acknowledge()),bottom=this.viewport.height-this.viewport.bottom;
    this.text('本次只领一张',22,top+5,14,COLORS.ink,500);
    this.text(this.expiry(),w-22,top+5,11,COLORS.muted,400,'right');
    const first=this.startScroll(top+27,bottom-137),y=top+30-this.scroll,n=choice.candidateIds.length,cw=Math.min(180,(w-40-Math.max(0,n-1)*8)/Math.max(1,n)),ih=cw*1.4,ch=ih+62;
    const left=(w-(cw*n+Math.max(0,n-1)*8))/2;
    for(const [i,id]of choice.candidateIds.entries()){
      const card=CARDS[id],x=left+i*(cw+8),selected=this.selectedChoice===id,value=card.kind==='active'?p.activeInventory[id as ActiveCardId]:p.passiveLevels[id as 'farming'];
      const lift=selected&&!p.settings.reducedMotion?4:0;
      drawOrderMount(this.ctx,x,y-lift,cw,ch);
      drawStrategyIllustration(this.ctx,x+8,y+8-lift,cw-16,ih-8,id);
      this.text(card.name,x+cw/2,y+ih+20-lift,w<340?14:16,'#38271B',600,'center',true);
      this.text(card.kind==='active'?'主动':'被动',x+cw/2,y+ih+43-lift,12,'#61462E',500,'center');
      if(selected){drawSettingSeal(this.ctx,x+cw-25,y+ch-28-lift,20,20,true);this.text('选',x+cw-15,y+ch-18-lift,14,'#FFE9C1',600,'center',true);}
      this.regions.push({id:`choice-${id}`,label:`选择${card.name}`,x,y,w:cw,h:ch,run:()=>{if(!Number.isSafeInteger(value+1)){this.notify('该卡数量超出可保存范围，请选择其他候选');return;}this.selectedChoice=id;}});
    }
    const detailTop=y+ch+12,id=this.selectedChoice&&choice.candidateIds.includes(this.selectedChoice)?this.selectedChoice:null;
    const card=id?CARDS[id]:null,value=id?(card!.kind==='active'?p.activeInventory[id as ActiveCardId]:p.passiveLevels[id as 'farming']):0;
    const stock=card?`${card.kind==='active'?'库存':'层数'} ${value} → ${value+1}`:'';
    const effect=card?(card.kind==='passive'?'本周每局自动，不消耗；重复领取递减提升。':card.description):'点选一张军令，查看领取后的效果。确认前可以改选，本次只领取一张。';
    const limit=id==='logistics'?15:20,label=id==='farming'?'产兵':id==='logistics'?'移速':'容量';
    const bonus=card?.kind==='passive'?`${label} +${(asNumber(passiveBonus(limit,value))*100).toFixed(2)}% → +${(asNumber(passiveBonus(limit,value+1))*100).toFixed(2)}%`:'';
    const paperHeight=44+(card?31+this.lines(stock,w-48,15).length*22+8:0)+this.lines(effect,w-48,card?14:15).length*(card?22:24)+(bonus?8+this.lines(bonus,w-48,14).length*22:0);
    fieldPaper(this.ctx,18,detailTop,w-36,paperHeight);this.nightPanel=false;
    let row=detailTop+24;
    if(card){this.text(card.name,24,row,21,COLORS.ink,650,'left',true);row+=31;row=this.paragraph(stock,24,row,w-48,15,COLORS.player,22)+8;}
    row=this.paragraph(effect,24,row,w-48,card?14:15,COLORS.ink,card?22:24)+8;
    if(bonus)row=this.paragraph(bonus,24,row,w-48,14,COLORS.player,22);
    this.nightPanel=true;
    this.endScroll(first,top+27,bottom-137,row+12);
    this.regions=this.regions.filter(r=>!r.id.startsWith('choice-')||r.h>=44);
    if(this.maxScroll>0)this.text('上滑查看完整效果',w/2,bottom-127,11,COLORS.muted,400,'center');
    this.wide('claim',this.selectedChoice?`确认领取${CARDS[this.selectedChoice].short}`:'请选择一张',bottom-117,()=>{if(this.selectedChoice)void s.claim(this.selectedChoice);else this.notify('先点选一张策略');},!!this.selectedChoice);
    this.textButton('abandon-choice','放弃本次机会',20,bottom-56,w-40,44,()=>{this.modal={title:'放弃选策机会？',body:'这次冠军只可领取一张。放弃后不补发，不退还机会，也没有补偿货币。',label:'确认放弃',run:()=>void s.abandonChoice()};});
  }
  private library():void{this.paintedLibrary();}
  private cardEffect(id:CardId):string{
    return {mobilize:'短时加快征兵',march:'下次行军提速 40%',supply:'立即补 6 兵',feint:'停产停射 4 秒',farming:'每局产兵更快',logistics:'每局行军更快',fortification:'提升驻军容量'}[id];
  }
  private openCardDetails(id:CardId):void{this.detailStarted=this.now;this.librarySelection=id;this.detailScroll=0;this.detailMaxScroll=0;this.cardRulesOpen=false;this.gesture=null;}
  private closeCardDetails():void{this.librarySelection=null;this.detailScroll=0;this.detailMaxScroll=0;this.cardRulesOpen=false;this.gesture=null;}
  private paintedLibrary():void{
    const s=this.session,p=s.profile!,c=this.ctx,{width:w,height:h,bottom}=this.viewport;
    if(!drawArt(c,'order-archive',0,0,w,h,'stretch'))this.courtyardBackdrop();
    c.fillStyle='#150E0838';c.fillRect(0,0,w,h);
    const start=this.header('策略图鉴',()=>{s.page=s.returnPage;}),edge=h-bottom-28;
    const first=this.startScroll(start,edge),left=26,right=w-26,gap=12;
    const summaries:Record<CardId,string>={mobilize:'加快征兵',march:'下次提速',supply:'即时补兵',feint:'停产停射',farming:'提升产兵',logistics:'提升移速',fortification:'扩充容量'};
    let row=start-this.scroll;
    for(const [title,ids]of [['主动锦囊',ACTIVE_IDS],['被动兵法',PASSIVE_IDS]] as const){
      const active=ids===ACTIVE_IDS,columns=active?2:3,cardHeight=110,cw=(right-left-(columns-1)*gap)/columns;
      this.text(title,left,row+12,18,'#F3D6A9',550,'left',true);row+=30;
      for(const [i,id]of ids.entries()){
        const cx=left+(i%columns)*(cw+gap),cy=row+Math.floor(i/columns)*(cardHeight+12),open=p.unlockedCardIds.includes(id);
        const pressed=this.gesture?.region?.id===`library-${id}`&&!this.gesture.drag,py=cy+(pressed?1:0);
        drawOrderMount(c,cx,py,cw,cardHeight,!open);
        c.fillStyle=!open?'#74716B':active?'#8B3725':'#3C5B4C';c.fillRect(cx+cw/2-3,py-3,6,10);
        drawStrategyIllustration(c,cx+8,py+8,cw-16,54,id,!open);
        if(!open){c.strokeStyle='#746453';c.lineWidth=1.3;c.strokeRect(cx+8,py+15,8,7);c.beginPath();c.arc(cx+12,py+14,3,Math.PI,0);c.stroke();}
        this.text(CARDS[id].name,cx+cw/2,py+77,active?18:14,'#38271B',550,'center',true);
        this.text(open?summaries[id]:'未解锁',cx+cw/2,py+95,12,'#694D30',400,'center');
        this.regions.push({id:`library-${id}`,label:`查看${CARDS[id].name}，${open?'已解锁':'未解锁'}`,x:cx,y:cy,w:cw,h:cardHeight,run:()=>this.openCardDetails(id)});
      }
      row+=Math.ceil(ids.length/columns)*(cardHeight+12)+8;
    }
    this.endScroll(first,start,edge,row);
    this.text('点选军令，查看效果与解锁条件',w/2,h-bottom-12,12,'#E3CBA9',400,'center');
  }
  private drawCardSheet():void{
    const id=this.librarySelection!,card=CARDS[id],p=this.session.profile!,c=this.ctx,{width:w,height:h,top,bottom}=this.viewport;
    c.save();
    const catalogue=this.session.page==='library';
    const open=p.unlockedCardIds.includes(id),value=card.kind==='active'?p.activeInventory[id as ActiveCardId]:p.passiveLevels[id as 'farming'];
    const sw=Math.min(320,w-32),sx=(w-sw)/2,bw=sw-36;
    const stock=catalogue||!open?`通关「${MAPS[card.lesson].name}」解锁`:card.kind==='active'?`持有 ${value} 张 · 每次使用扣 1`:`本周累计 ${value} 层`;
    const hint=card.kind==='passive'?'被动 · 本周自动生效':id==='feint'?'主动 · 敌方城池':id==='march'?'主动 · 下次出兵':'主动 · 我方城池';
    const effect=id==='supply'?'补充最多 6 兵，不超过容量':id==='feint'?'敌营停产 4 秒，塔营同时停射':this.cardEffect(id);
    const bonus=!catalogue&&card.kind==='passive'&&open?`当前增益 +${(asNumber(passiveBonus(id==='logistics'?15:20,value))*100).toFixed(2)}%${id==='fortification'?` · 一级容量 ${campCapacity({tier:1},{passives:p.passiveLevels})}`:''}`:'';
    const expiry=catalogue?'策略于下周一 00:00 到期，解锁资格保留。':this.expiry();
    const summaryHeight=10+this.lines(effect,bw,15).length*23+8+this.lines(stock,bw,13).length*21+8+(bonus?this.lines(bonus,bw,13).length*21+8:0);
    const contentHeight=summaryHeight+44+(this.cardRulesOpen?12+this.lines(card.description,bw,14).length*23+12+this.lines(expiry,bw,12).length*21+12:0);
    const sh=Math.min(78+contentHeight+66,this.cardRulesOpen?460:380,h-top-bottom-24),sy=top+(h-top-bottom-sh)/2;
    c.fillStyle='#19130FAC';c.fillRect(0,0,w,h);this.regions=[];
    c.globalAlpha*=this.session.profile?.settings.reducedMotion?1:.75+.25*Math.min(1,Math.max(0,(this.now-this.detailStarted)/160));
    this.regions.push({id:'card-sheet-scrim',label:'关闭策略说明',x:0,y:top,w,h:h-top-bottom,run:()=>this.closeCardDetails()});
    this.box(sx,sy+4,sw,sh,'#102C2840',4);
    const nightPanel=this.nightPanel;
    if(catalogue){
      drawCourtyardPanel(c,sx,sy,sw,sh);
      this.nightPanel=false;
    }else this.box(sx,sy,sw,sh,COLORS.surface,4,'#B4A58A');
    this.regions.push({id:'card-sheet-surface',label:'策略说明',x:sx,y:sy,w:sw,h:sh,run:()=>{}});
    drawStrategyIllustration(c,sx+12,sy+12,48,48,id,!open);

    drawCourtyardHeading(c,sx+64,sy+13,Math.min(146,sw-118),29,catalogue);
    this.text(card.name,sx+74,sy+27,18,'#F5E9D0',650,'left',true);
    this.text(hint,sx+70,sy+51,11,COLORS.muted);
    drawCourtyardHeading(c,sx+sw-49,sy+10,44,30);
    this.text('返回',sx+sw-27,sy+25,13,'#F1DBB7',550,'center',true);
    this.regions.push({id:'card-sheet-close',label:'关闭',x:sx+sw-48,y:sy+4,w:44,h:44,run:()=>this.closeCardDetails()});
    c.fillStyle='#D7CEBA';c.fillRect(sx+18,sy+68,bw,1);
    const contentTop=sy+78,contentBottom=sy+sh-66,first=this.regions.length;
    this.detailMaxScroll=Math.max(0,contentHeight-(contentBottom-contentTop));this.detailScroll=Math.min(this.detailScroll,this.detailMaxScroll);
    c.save();c.beginPath();c.rect(sx+18,contentTop,bw,contentBottom-contentTop);c.clip();
    let row=contentTop+10-this.detailScroll;
    row=this.paragraph(effect,sx+18,row,bw,15,COLORS.ink,23)+8;
    row=this.paragraph(stock,sx+18,row,bw,13,!catalogue&&open?COLORS.player:COLORS.muted,21)+8;
    if(bonus)row=this.paragraph(bonus,sx+18,row,bw,13,COLORS.player,21)+8;
    this.textButton('card-rules',this.cardRulesOpen?'收起说明':'详细规则 ›',sx+18,row,bw,44,()=>{this.cardRulesOpen=!this.cardRulesOpen;this.detailScroll=0;});row+=44;
    if(this.cardRulesOpen){row=this.paragraph(card.description,sx+18,row+12,bw,14,COLORS.ink,23)+12;this.paragraph(expiry,sx+18,row,bw,12,COLORS.muted,21);}
    c.restore();
    this.regions=this.regions.flatMap((r,i)=>{if(i<first)return[r];const y=Math.max(contentTop,r.y),edge=Math.min(contentBottom,r.y+r.h);return edge-y>=44?[{...r,y,h:edge-y}]:[];});
    this.button('card-sheet-done','知道了',w/2-65,sy+sh-54,130,44,()=>this.closeCardDetails(),'primary');
    this.nightPanel=nightPanel;c.restore();
  }
  private ranks():void{
    const p=this.session.profile!,w=this.viewport.width,start=this.header('军衔册',()=>{this.session.page=this.session.returnPage;}),y=start-this.scroll,bottom=this.viewport.height-this.viewport.bottom,first=this.startScroll(start-10,bottom);
    const title=rankName(p.rankPoints),titleSize=this.lines(title,w-44,29).length>1?20:29;
    const bannerHeight=Math.min(205,(bottom-start)*.36);
    drawRankStandard(this.ctx,w/2,y+bannerHeight/2+3,bannerHeight,p.rankPoints);
    this.text('军',w/2,y+bannerHeight*.515+3,Math.round(bannerHeight*.29),'#E3C797',550,'center',true);
    const titleY=y+bannerHeight+28;
    let row=titleY;
    for(const line of this.lines(title,w-44,titleSize)){this.text(line,w/2,row,titleSize,COLORS.ink,650,'center',true);row+=36;}
    const merit=`军功 ${p.rankPoints}`,meritSize=this.lines(merit,w-44,28).length>1?18:28;
    this.text(merit,w/2,row+9,meritSize,COLORS.player,650,'center');row+=43;
    meritRuler(this.ctx,40,row,w-80,(p.rankPoints%30)/30);
    this.text(`${p.rankPoints%30} / 30`,w/2,row+30,12,COLORS.muted,500,'center');
    this.text(`下一级还需 ${30-p.rankPoints%30} 军功`,w/2,row+53,15,COLORS.ink,500,'center');
    const history=`曾达 ${rankName(p.highestRankPoints)} · ${p.highestRankPoints} 军功`;
    const journalHeight=105+this.lines(history,w-44,14).length*22+(p.weeklyRecord?65+this.lines(`已归档 ${p.weeklyRecord.archivedWeeks} 周 · 冠军累计 ${p.weeklyRecord.totalWins} · 最佳单周 ${p.weeklyRecord.bestWins} 胜`,w-44,13).length*21:0)+(this.rankRulesOpen?400:0);
    fieldPaper(this.ctx,16,row+67,w-32,journalHeight);this.nightPanel=false;
    row=this.paragraph(`曾达 ${rankName(p.highestRankPoints)} · ${p.highestRankPoints} 军功`,22,row+84,w-44,14,COLORS.muted,22)+15;
    if(p.weeklyRecord){
      row=this.paragraph(`周战绩纪念 · ${p.weeklyRecord.lastWeekId} 起的一周 ${p.weeklyRecord.lastWeekWins} 胜`,22,row,w-44,14,COLORS.player,22)+8;
      row=this.paragraph(`已归档 ${p.weeklyRecord.archivedWeeks} 周 · 冠军累计 ${p.weeklyRecord.totalWins} · 最佳单周 ${p.weeklyRecord.bestWins} 胜`,22,row,w-44,13,COLORS.muted,21)+15;
    }
    this.textButton('rank-rules',this.rankRulesOpen?'收起规则':'军功规则 ›',w/2-70,row,140,44,()=>{this.rankRulesOpen=!this.rankRulesOpen;if(!this.rankRulesOpen)this.scroll=0;});row+=64;
    if(this.rankRulesOpen){
      const names=['军司马','都尉','校尉','中郎将','偏将军','车骑将军','骠骑将军','大将军'];
      for(const [i,n]of names.entries()){rankBadge(this.ctx,26,row,10,30+i*150);this.text(n,44,row,15,COLORS.ink,550);this.text(i===7?'1080 起，小级持续增加':`${30+i*150} 军功起 · 五个小级`,w-24,row,12,COLORS.muted,400,'right');row+=31;}
      row=this.paragraph('军衔为游戏化设计，并非历史统一晋升制度。军衔没有战斗属性。新局有效冠军 +30；失败、平局和放弃不扣军功。军衔与历史最高保留；旧局仍按开局时约定计分。',24,row+19,w-48,13,COLORS.muted,22);
    }
    this.nightPanel=true;
    this.endScroll(first,start-10,bottom,row+12);
  }

  private tentDesk(title:string,close:()=>void,backLabel=title==='设置'?'关闭设置':'返回设置'):{x:number;pw:number;start:number;edge:number}{
    const {width:w,height:h,top,bottom}=this.viewport,c=this.ctx;
    const pw=Math.min(368,w-32),x=(w-pw)/2;
    // The painted desk occupies the middle of the scene. Keep all scrolling
    // text on that surface, with the title and exit outside the cloth.
    const start=Math.max(top+58,Math.ceil(h*.318));
    const edge=Math.min(h-bottom-60,Math.floor(h*.754));
    const painted=drawArt(c,'field-tent',0,0,w,h,'stretch');
    if(!painted){
      this.courtyardBackdrop();
      drawCourtyardPanel(c,12,start-4,w-24,edge-start+8);
    }
    this.regions=[];
    const titleWidth=title.length>2?126:94;
    drawCourtyardHeading(c,x+8,top+8,titleWidth,38,true);
    this.text(title,x+8+titleWidth/2,top+27,title.length>2?20:24,'#F5E9D0',750,'center',true);
    this.returnPlaque(x+pw-4,top+5,close,backLabel);
    return {x,pw,start,edge};
  }

  private settings():void{
    const s=this.session,p=s.profile,{width:w,height:h,bottom}=this.viewport,c=this.ctx;
    const close=()=>{s.page=s.returnPage;};
    const {x,pw,start,edge}=this.tentDesk('设置',close),art=getArtStatus();
    const first=this.startScroll(start,edge),row=start-this.scroll;
    if(!p)this.paragraph('存档尚未恢复，可关闭查看恢复选项。',x+22,row+22,pw-44,14,'#59402E',23);
    else{
      this.text('声音与画面',x+30,row+11,14,'#653A24',700,'left',true);
      const controlsY=row+24,rowHeight=54;
      const controls=[
        ['sound','声音','播放游戏音效'],
        ['vibration','震动','夺城时震动'],
        ['reducedMotion','减少动态','减少装饰动效'],
      ] as const;
      for(const [i,[key,name,description]]of controls.entries()){
        const yy=controlsY+i*rowHeight,enabled=p.settings[key],sx=x+pw-88;
        const pressed=this.gesture?.region?.id===`setting-${key}`&&!this.gesture.drag;
        if(pressed){
          c.fillStyle='#82402824';
          c.fillRect(x+22,yy+3,pw-44,rowHeight-6);
        }
        this.text(name,x+31,yy+18,18,'#32251B',650,'left',true);
        this.text(description,x+31,yy+39,12,'#4D3523');
        if(i>0){c.fillStyle='#6A462A59';c.fillRect(x+30,yy,pw-60,1);}
        const sealY=yy+12+(pressed?2:0);
        let visual=this.settingVisuals.get(key);
        if(!visual)visual={enabled,from:enabled?1:0,started:this.now};
        else if(visual.enabled!==enabled){const progress=Math.min(1,Math.max(0,(this.now-visual.started)/100));visual={enabled,from:visual.from+((visual.enabled?1:0)-visual.from)*progress,started:this.now};}
        this.settingVisuals.set(key,visual);
        const progress=p.settings.reducedMotion?1:Math.min(1,Math.max(0,(this.now-visual.started)/100));
        const position=visual.from+((enabled?1:0)-visual.from)*progress;
        drawSettingSeal(c,sx+34*position,sealY,30,30,enabled);
        for(const [on,dx]of [[false,0],[true,34]] as const){
          const current=on===enabled;
          this.text(on?'开':'关',sx+dx+15,sealY+15,18,current&&enabled&&progress===1?'#FFF1D0':'#4C3827',current?750:400,'center',true);
        }
        this.regions.push({id:`setting-${key}`,label:`${name}：${enabled?'开启':'关闭'}`,x:x+18,y:yy,w:pw-36,h:rowHeight,run:()=>void s.setting(key)});
        if(key==='sound'&&enabled&&this.soundPreview){
          const auditionX=sx-50;
          this.text('试听',auditionX+22,yy+28,12,'#783C28',650,'center');
          c.fillStyle='#9B6447';c.fillRect(auditionX+10,yy+37,24,1);
          this.regions.push({id:'test-sound',label:'试听',x:auditionX,y:yy+6,w:44,h:44,run:()=>{if(this.session.profile?.settings.sound)this.soundPreview?.();}});
        }
      }
      this.text('帮助与记录',x+30,row+207,14,'#653A24',650,'left',true);
      const utility=(id:string,label:string,yy:number,color:string,run:()=>void)=>{
        const pressed=this.gesture?.region?.id===id&&!this.gesture.drag;
        if(pressed){c.fillStyle='#A5815926';c.fillRect(x+18,yy,pw-36,44);}
        c.fillStyle='#6A462A59';c.fillRect(x+30,yy+43,pw-60,1);
        const icon=id==='about'?'cards':'info';
        drawMobileIcon(c,x+36,yy+22,16,icon,color);
        this.text(label,x+52,yy+22,16,color,550,'left',true);
        drawMobileIcon(c,x+pw-39,yy+22,14,'chevron',color);
        this.regions.push({id,label,x:x+18,y:yy,w:pw-36,h:44,run});
      };
      utility('about','玩法与关于',row+220,'#342216',()=>{s.page='about';});
      utility('reset','清除本地游戏记录',row+265,'#742B1C',()=>{
        this.modal={title:'清除全部本地记录？',body:'军功、最高、教学、解锁、策略、周进度、当前对局和设置全部清除，无法从好友榜找回。仅影响本游戏本机记录，不删除本人托管成绩。',label:'确认清除本地',run:()=>void s.reset()};
      });
    }
    let end=row+(p?310:50);
    if(p&&art.failed){end=this.paragraph('部分画面未载入，可重新载入。',x+22,end,pw-44,14,'#59402E',24)+12;this.button('retry-art','重新载入画面资源',x+20,end,pw-40,48,()=>{void retryArt().then(()=>this.notify(getArtStatus().failed?'部分画面仍未载入，可稍后重试':'画面资源已载入'));});end+=60;}
    this.endScroll(first,start,edge,end);
    const doneWidth=Math.min(164,pw-40);
    this.button('settings-done','完成',(w-doneWidth)/2,Math.min(h-bottom-54,Math.round(h*.85)),doneWidth,46,close,'primary');
  }
  private upgradeArrow(x:number,y:number,pressed=false):void{
    const c=this.ctx;
    c.save();c.lineJoin='round';c.lineCap='round';
    c.beginPath();c.moveTo(x-4,y);c.lineTo(x,y-4);c.lineTo(x+4,y);
    c.moveTo(x,y-4);c.lineTo(x,y+4);
    c.strokeStyle='#F4E9CF';c.lineWidth=3.5;c.stroke();
    c.strokeStyle=pressed?'#424E39':'#686F42';c.lineWidth=1.5;c.stroke();c.restore();
  }

  private manualTab(id:string,label:string,x:number,y:number,w:number,selected:boolean,run:()=>void):void{
    const c=this.ctx,pressed=this.gesture?.region?.id===id&&!this.gesture.drag;
    if(selected){c.fillStyle=pressed?'#6F3022':'#873B29';c.fillRect(x,y+5,w,34);}
    this.text(label,x+w/2,y+22,16,selected?'#F7E4BF':'#4B3020',550,'center',true);
    this.regions.push({id,label,x,y,w,h:44,run});
  }
  private quickGuide(start:number,edge:number):void{
    const w=this.viewport.width,chapter=this.manualChapter,cw=(w-72)/3;
    for(const [i,title]of ['派兵','升级','施策'].entries())this.manualTab(`about-chapter-${i}`,title,30+i*(cw+6),start,cw,chapter===i,()=>{if(i!==this.manualChapter)this.manualChanged=this.now;this.manualChapter=i as ManualChapter;this.manualStarted=null;this.scroll=0;});
    const top=start+52,first=this.startScroll(top,edge),y=top-this.scroll;
    const progress=Math.min(1,Math.max(0,(this.now-(this.manualChanged??this.pageStarted))/(this.manualChanged===null?160:120)));
    this.ctx.globalAlpha*=this.session.profile?.settings.reducedMotion?1:.55+.45*progress;
    const diagramHeight=chapter===1?(this.viewport.height<650?226:258):this.viewport.height<650?124:180;
    drawManualDiagram(this.ctx,32,y,w-64,diagramHeight,chapter,this.manualStarted===null?null:this.now-this.manualStarted,!!this.session.profile?.settings.reducedMotion);
    let row=y+diagramHeight+23;
    for(const [i,step]of MANUAL_STEPS[chapter].entries())row=this.paragraph(`${i+1}. ${step}`,34,row,w-68,15,'#38291E',25)+3;
    row=this.paragraph('图解演示，不开局、不消耗锦囊。',34,row+4,w-68,12,'#674C33',20)+7;
    this.endScroll(first,top,edge,row+6);
  }
  private about():void{
    const {width:w,height:h,bottom}=this.viewport,c=this.ctx;
    if(!drawArt(c,'war-table',0,0,w,h,'stretch')){
      c.fillStyle='#2D2118';c.fillRect(0,0,w,h);c.fillStyle='#E2C99D';c.fillRect(18,h*.13,w-36,h*.71);
    }
    this.nightPanel=false;
    this.text('玩法与关于',22,this.viewport.top+26,w<340?23:27,'#F1DFC0',550,'left',true);
    this.returnPlaque(w-16,this.viewport.top+5,()=>{this.session.page='settings';});
    const start=Math.max(this.viewport.top+64,h*.16),edge=Math.min(h-bottom-82,h*.83),tabWidth=(w-72)/2;
    const y=start+58;
    const change=(rules:boolean)=>{if(rules!==this.aboutRulesOpen)this.manualChanged=this.now;this.aboutRulesOpen=rules;this.aboutSection=null;this.manualStarted=null;this.scroll=0;};
    this.manualTab('about-guide','操作图解',30,start,tabWidth,!this.aboutRulesOpen,()=>change(false));
    this.manualTab('about-rules','详细规则',42+tabWidth,start,tabWidth,this.aboutRulesOpen,()=>change(true));
    const canReplay=!this.aboutRulesOpen&&this.manualChapter!==1;
    if(canReplay){this.nightPanel=true;this.button('about-replay','演示一次',24,h-bottom-56,102,46,()=>{this.manualStarted=this.now;});this.nightPanel=false;}
    this.button('about-lessons','去练兵试一试',canReplay?138:24,h-bottom-56,w-(canReplay?162:48),46,()=>{this.session.page='lessons';},'primary');
    if(!this.aboutRulesOpen){this.quickGuide(y,edge);return;}
    const first=this.startScroll(y-8,edge);
    this.ctx.globalAlpha*=this.session.profile?.settings.reducedMotion?1:.55+.45*Math.min(1,Math.max(0,(this.now-(this.manualChanged??this.pageStarted))/120));
    const sections=[
      ['夺城与守城','拖到道路相连的邻城，派出当前一半兵力。轻点查询产速与容量，点檐角箭头升级；最后一城失守即淘汰。旧版进行中对局仍可直达，结束后新局采用道路规则。'],
      ['四类营地','新局一级步营每秒 0.9 兵，弓／骑营 0.6，塔营 0.3。基础移速 24，骑兵 33.6。兵种取决于出发营地，到达友营或占领后整编。行军不会自然增兵，受箭塔攻击会减员。'],
      ['弓兵与塔营','弓兵出发至少 0.5 秒、进入目的营地 70 范围后，只检查齐射一次，伤害为当时人数的 30%向下取整。友方、空营、人数不足均跳过且不补射。塔营固定射程 120，打路过敌军或敌营，每次 1 兵。驻营弓兵不自动射击。'],
      ['到达与整编','到达按 1∶1 交战，相等只清零，不占领。增援和攻城存活者按目标营地整编；只有从骑营再次派兵才变快。多个攻击阵营同刻到达时，只有大于其他攻击方总和的一方留下差额攻城。'],
      ['驻兵升级','一级达到 30 兵可花 10 升二级，二级达到 70 兵可花 25 升三级。容量 50／90／140，产速倍率 1／1.3／1.6。出兵不降级，易主保留等级。'],
      ['四方与军功','正式局上限四分钟，到时按城数、总兵力排序，两项都同则并列。有效独立冠军且曾派兵才能获得 +30 军功、一次选卡和一次周胜。新局失败、平局与放弃不扣军功，不发参与分。旧局仍按开局约定计分。'],
      ['策略与周界','冠军在固定混合候选中只选一张。主动使用扣库存，被动每周累计、每局自动生效。北京时间周一清库存、被动层数、旧待选和周胜；军功、最高和永久解锁保留，已知周胜归档为永久纪念。'],
      ['保存与隐私','每 5 游戏秒保存检查点，消费、升级、结果、领奖立即完整保存。后台不补算；恢复需明确继续，现实超过 24 小时不能续战。离线核心使用本机存储；好友榜不等于云存档。'],
      ['版本与原创',`谋定山河 0.1.0 · 新局规则 v1.6，保留 v1.5 旧局。原创设色山水与建筑插画，士兵、军旗和界面由 Canvas 绘制。画面资源 ${getArtStatus().ready}/${getArtStatus().total}。本地玩家与电脑对战。`],
    ];
    const scrollLimit=(section:number|null)=>Math.max(0,y+sections.length*60+(section===null?0:this.lines(sections[section]![1]!,w-60,15).length*24+18)-edge+12);
    this.maxScroll=scrollLimit(this.aboutSection);this.scroll=Math.min(this.scroll,this.maxScroll);
    let row=y-this.scroll;
    for(const [i,[title,body]]of sections.entries()){
      const label=`${title} ${this.aboutSection===i?'−':'+'}`;
      c.fillStyle='#82603B55';c.fillRect(28,row+47,w-56,1);
      this.text(label,34,row+24,17,'#432D1E',550,'left',true);
      this.regions.push({id:`about-section-${i}`,label,x:24,y:row,w:w-48,h:48,run:()=>{
        this.aboutSection=this.aboutSection===i?null:i;
        this.scroll=Math.min(i*60,scrollLimit(this.aboutSection));
      }});
      row+=60;
      if(this.aboutSection===i)row=this.paragraph(body!,30,row,w-60,15,'#432D1E',24)+18;
    }
    this.ctx.restore();
    this.regions=this.regions.filter((r,i)=>i<first||r.y>=y-8&&r.y+r.h<=edge);
  }

  private recovery():void{
    const s=this.session,w=this.viewport.width,start=this.header('记录需要处理',s.profile?()=>{s.page='home';}:null),y=start-this.scroll,bottom=this.viewport.height-this.viewport.bottom,first=this.startScroll(start-10,bottom-12);
    this.text('本地记录需检查',26,y+20,24,COLORS.ink,600,'left',true);
    let row=this.paragraph(s.error||'当前对局需要确认后继续。',26,y+61,w-52,15,COLORS.muted,25);
    row=this.paragraph('原记录保留，请先尝试重新读取。',26,row+10,w-52,14,COLORS.ink,23)+16;
    this.wide('retry-load','重新读取',row,()=>void s.load(),true);row+=70;
    if(s.backup){
      fieldPaper(this.ctx,23,row,w-46,122);
      this.text('可恢复的完整副本',35,row+23,18,'#44301F',550,'left',true);
      this.text(new Date(s.backup.writtenAt).toLocaleString('zh-CN'),35,row+49,12,'#6B5035');
      this.button('recover-backup','恢复可用副本',35,row+65,w-70,44,()=>{this.modal={title:'恢复较早的完整副本？',body:`将恢复到 ${new Date(s.backup!.writtenAt).toLocaleString('zh-CN')}。后续尚未确认的进度可能回退；不会混合两份库存或补发奖励。`,label:'确认恢复',run:()=>void s.recover()};});
      row+=140;
    }
    this.wide('practice','临时无奖励练兵',row,()=>void s.start('L01',true));row+=68;
    this.textButton('recovery-reset','清除本地记录…',20,row,w-40,44,()=>{this.modal={title:'清除全部本地记录？',body:'当前军功、最高、教学、解锁、策略、周进度、快照和设置全部清除，无法云找回。',label:'确认清除本地',run:()=>void s.reset()};});
    this.endScroll(first,start-10,bottom-12,row+64);
  }
  private leaderboard():void{
    const s=this.session,p=s.profile,w=this.viewport.width,start=this.header('好友周榜'),bottom=this.viewport.height-this.viewport.bottom-22,first=this.startScroll(start,bottom),y=start-this.scroll;
    this.ctx.globalAlpha*=p?.settings.reducedMotion?1:.7+.3*Math.min(1,Math.max(0,(this.now-this.pageStarted)/120));
    this.text('本机本周',w/2,y+25,17,COLORS.muted,500,'center',true);
    this.text(`${p?.qualifiedArenaWins??0} 胜`,w/2,y+67,30,COLORS.ink,650,'center');
    let row=this.paragraph('比较本周标准四方对电脑的独立冠军次数。同分并列，不是真人对战。',30,y+111,w-60,14,COLORS.muted,24);
    this.ctx.fillStyle='#86613960';this.ctx.fillRect(30,row+8,w-60,1);row+=43;
    this.text('微信好友榜未启用',w/2,row,21,'#773C2C',600,'center',true);
    row=this.paragraph('当前平台未启用微信好友能力。你仍可离线对战，军功与策略照常保存在本机。',30,row+37,w-60,15,COLORS.ink,25)+23;
    row=this.paragraph('榜单不是云存档；不开启不会上传你的成绩，也不会请求好友资料。',30,row,w-60,14,COLORS.muted,24);
    this.endScroll(first,start,bottom,row+24);
  }
  private drawModal():void{
    const m=this.modal!,{width:w,height:h}=this.viewport;this.ctx.save();this.regions=[];this.ctx.fillStyle='#19130FA0';this.ctx.fillRect(0,0,w,h);
    this.ctx.globalAlpha*=this.session.profile?.settings.reducedMotion?1:.82+.18*Math.min(1,Math.max(0,(this.now-this.modalStarted)/180));
    const reset=m.label==='确认清除本地';
    const y=Math.max(this.viewport.top+20,h/2-165);
    if(reset){
      drawCourtyardPanel(this.ctx,20,y,w-40,330);
      drawCourtyardHeading(this.ctx,36,y+18,Math.min(220,w-72),38,true);
      this.text(m.title,46,y+37,20,'#F5E9D0',700,'left',true);
      this.paragraph(m.body,40,y+84,w-80,15,'#4D3523',25);
    }else{
      this.box(20,y,w-40,330,COLORS.surface,20);
      this.text(m.title,40,y+37,21,COLORS.ink,700,'left',true);
      this.paragraph(m.body,40,y+84,w-80,15,COLORS.muted,25);
    }
    this.button('modal-cancel','取消',40,y+258,(w-92)/2,48,()=>{this.modal=null;},'secondary');
    this.button('modal-confirm',m.label,52+(w-92)/2,y+258,(w-92)/2,48,()=>{this.modal=null;m.run();},'danger');
    this.ctx.restore();
  }
  down(id:number,x:number,y:number):void{
    if(this.renderedArtRevision!==(getArtRevision()+getFontRevision())){this.gesture=null;return;}
    const context=this.inputContext();if(this.renderedContext!==null&&this.renderedContext!==context){this.clearInput();return;}
    if(this.gesture)return;
    this.inputVersion++;
    const region=[...this.regions].reverse().find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)??null;
    const shortcut=region?.id.startsWith('upgrade-camp-')?this.session.match?.battle.camps.find(c=>c.id===region.id.slice(13)):null;
    const camp=!this.modal&&!this.campDetailsOpen&&this.armyPage===null&&this.session.page==='battle'?(shortcut??(!region?this.campAt(x,y):null)):null;
    this.gesture={id,x,y,lastY:y,point:{x,y},region,source:camp?.owner==='P'?camp.id:null,drag:false,page:this.session.page,context,started:this.now};
  }
  move(id:number,x:number,y:number):void{
    const g=this.gesture;if(!g||g.id!==id)return;
    g.point={x,y};if(distance({x:g.x,y:g.y},g.point)>8)g.drag=true;
    if(g.drag&&g.source&&g.region?.id===`upgrade-camp-${g.source}`)g.region=null;
    if(g.drag&&g.source&&!g.region)this.selected=null;
    if(g.drag&&this.librarySelection&&!this.modal)this.detailScroll=Math.max(0,Math.min(this.detailMaxScroll,this.detailScroll+g.lastY-y));
    else if(g.drag&&this.session.page!=='battle'&&!this.modal){this.scroll=Math.max(0,Math.min(this.maxScroll,this.scroll+g.lastY-y));}g.lastY=y;
  }
  up(id:number,x:number,y:number):void{
    if(this.renderedArtRevision!==(getArtRevision()+getFontRevision())){this.gesture=null;return;}
    const g=this.gesture;if(!g||g.id!==id)return;
    if(g.context!==this.inputContext()){this.clearInput();return;}
    if(g.page!==this.session.page){this.gesture=null;return;}
    // Some native gestures omit move events; the release still carries the final position.
    this.move(id,x,y);this.gesture=null;
    if(g.region){const r=g.region;if(!g.drag&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)r.run();return;}
    if(this.modal||this.campDetailsOpen||this.armyPage!==null||this.session.page!=='battle')return;
    if(g.source&&this.session.match?.battle.camps.find(c=>c.id===g.source)?.owner!=='P'){this.cancel();return;}
    if(this.regions.some(r=>!(g.drag&&g.source&&r.id.startsWith('upgrade-camp-'))&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)){this.cancel();return;}
    if(g.drag&&this.card&&this.card!=='march'){this.cancel();return;}
    if(g.drag&&!g.source)return;
    const target=g.drag&&g.source?this.dragTarget(x,y,g.source):this.campAt(x,y);
    if(g.drag&&g.source){if(target&&target.id!==g.source){
      const card=this.card,version=this.inputVersion,matchId=this.session.match?.battle.id;void this.session.action({kind:'dispatch',sourceId:g.source,targetId:target.id,march:card==='march'}).then(ok=>{if(ok&&version===this.inputVersion&&matchId===this.session.match?.battle.id&&this.card===card)this.card=null;});
    }return;}
    if(this.card&&this.card!=='march'&&target){
      this.commitCard(this.card,target);return;
    }
    if(!target){this.selected=null;this.card=null;return;}
    this.queryOffset=0;this.selected=this.selected===target.id?null:target.id;
  }
  private commitCard(card:Exclude<ActiveCardId,'march'>,target:Camp):void{
    const version=this.inputVersion,matchId=this.session.match?.battle.id;
    void this.session.action({kind:'card',cardId:card,targetId:target.id}).then(ok=>{if(ok&&version===this.inputVersion&&matchId===this.session.match?.battle.id&&this.card===card){this.card=null;this.selected=null;}});
  }
  wheel(delta:number):void{if(this.librarySelection)this.detailScroll=Math.max(0,Math.min(this.detailMaxScroll,this.detailScroll+delta));else if(this.session.page!=='battle')this.scroll=Math.max(0,Math.min(this.maxScroll,this.scroll+delta));}
}
