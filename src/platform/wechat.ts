import { GameSession } from '../app/session.ts';
import type { StoragePort } from '../app/storage.ts';
import { GameView } from '../render/game.ts';
import { GameAudio, type AudioContextPort } from './audio.ts';
import { getArtStatus, loadArt, retryArt, type ArtImage } from '../render/assets.ts';

interface Touch {identifier:number;clientX:number;clientY:number}
interface TouchEvent {changedTouches:Touch[]}
interface WindowInfo {windowWidth:number;windowHeight:number;pixelRatio:number;safeArea?:{top:number;bottom:number}}
interface WechatPort {
  createCanvas():HTMLCanvasElement;
  createImage():ArtImage;
  createWebAudioContext?():AudioContextPort;
  getWindowInfo?():WindowInfo;
  getSystemInfoSync():WindowInfo;
  getMenuButtonBoundingClientRect?():{bottom:number};
  getStorageSync(key:string):unknown;
  setStorage(options:{key:string;data:string;success:()=>void;fail:(error:unknown)=>void}):void;
  removeStorage(options:{key:string;success:()=>void;fail:(error:unknown)=>void}):void;
  onTouchStart(callback:(e:TouchEvent)=>void):void;
  onTouchMove(callback:(e:TouchEvent)=>void):void;
  onTouchEnd(callback:(e:TouchEvent)=>void):void;
  onTouchCancel(callback:(e:TouchEvent)=>void):void;
  onHide(callback:()=>void):void;
  onShow(callback:()=>void):void;
  onWindowResize?(callback:()=>void):void;
  vibrateShort?(options:{type:'light'}):void;
}
declare const wx:WechatPort;
function reportArt(){if(getArtStatus().failed)console.warn('部分画面资源未载入，暂用简化画面，可重新载入。');}
void loadArt(()=>wx.createImage()).then(reportArt);
const canvas=wx.createCanvas(),ctx=canvas.getContext('2d');
if(!ctx)throw new Error('Canvas 2D unavailable');
const storage:StoragePort={
  async read(key){const data=wx.getStorageSync(key);return data===''||data===undefined||data===null?null:typeof data==='string'?data:JSON.stringify(data);},
  write(key,data){return new Promise((resolve,reject)=>wx.setStorage({key,data,success:resolve,fail:reject}));},
  remove(key){return new Promise((resolve,reject)=>wx.removeStorage({key,success:resolve,fail:reject}));},
};
const audio=new GameAudio(()=>{if(!wx.createWebAudioContext)throw new Error('WebAudio unavailable');return wx.createWebAudioContext();},()=>Date.now(),()=>{if(!hidden&&session.profile?.settings.sound)view.notify('声音未能播放，请在设置中试听重试');});
let view:GameView,lastVibration=0;
function vibrate(){if(!hidden&&session.profile?.settings.vibration&&Date.now()-lastVibration>=500){lastVibration=Date.now();wx.vibrateShort?.({type:'light'});}}
const session=new GameSession({storage,now:()=>Date.now(),random:()=>Math.random(),notify:text=>view.notify(text),present:event=>view.present(event),events:events=>{
  view.events(events);audio.play(events,!hidden&&(session.profile?.settings.sound??false),session.match?.battle.id??session.profile?.latestResult?.matchId,session.restorationVersion);
  if(events.some(e=>e.type==='capture'&&e.faction==='P'))vibrate();
}});
view=new GameView(ctx,session,vibrate);
view.soundPreview=()=>audio.preview();
function resize():void{
  const info=wx.getWindowInfo?.()??wx.getSystemInfoSync(),ratio=Math.min(info.pixelRatio,3),safeTop=info.safeArea?.top??16;
  let menuBottom:number|undefined;
  try{menuBottom=wx.getMenuButtonBoundingClientRect?.()?.bottom;}catch{/* Some runtimes cannot report menu geometry. */}
  const top=typeof menuBottom==='number'&&Number.isFinite(menuBottom)&&menuBottom>safeTop&&menuBottom<=info.windowHeight?menuBottom+6:safeTop+44;
  canvas.width=Math.round(info.windowWidth*ratio);canvas.height=Math.round(info.windowHeight*ratio);ctx!.setTransform(ratio,0,0,ratio,0,0);
  view.viewport={width:info.windowWidth,height:info.windowHeight,top,bottom:Math.max(12,info.windowHeight-(info.safeArea?.bottom??info.windowHeight))};
  view.cancel();
}
wx.onTouchStart(e=>{if(hidden)return;if(session.profile?.settings.sound){audio.unlock();audio.click(true);}for(const t of e.changedTouches)view.down(t.identifier,t.clientX,t.clientY);});
wx.onTouchMove(e=>{for(const t of e.changedTouches)view.move(t.identifier,t.clientX,t.clientY);});
wx.onTouchEnd(e=>{for(const t of e.changedTouches)view.up(t.identifier,t.clientX,t.clientY);});
wx.onTouchCancel(e=>{for(const t of e.changedTouches)view.cancel(t.identifier);});
let hidden=false,last=Date.now(),previousPage=session.page;
wx.onHide(()=>{hidden=true;view.cancel();audio.suspend();void session.suspend();});
wx.onShow(()=>{hidden=false;last=Date.now();resize();void retryArt().then(reportArt);});wx.onWindowResize?.(resize);
function frame():void{
  const now=Date.now();if(!view.viewportUsable){if(session.page==='battle')void session.suspend();}else if(!hidden)session.tick(Math.min(250,Math.max(0,now-last)));last=now;
  if(!session.profile?.settings.sound)audio.stop();
  if(previousPage==='battle'&&!['battle','result'].includes(session.page))audio.suspend();previousPage=session.page;
  view.draw(now);requestAnimationFrame(frame);
}
resize();void session.load();requestAnimationFrame(frame);
