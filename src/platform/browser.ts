import { GameSession } from '../app/session.ts';
import type { StoragePort } from '../app/storage.ts';
import { GameView } from '../render/game.ts';
import { GameAudio } from './audio.ts';
import { getArtStatus, loadArt, retryArt } from '../render/assets.ts';

function reportArt(){if(getArtStatus().failed)console.warn('部分画面资源未载入，暂用简化画面，可重新载入。');}
void loadArt(()=>new Image()).then(reportArt);

const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const ctx=canvas.getContext('2d');
if(!ctx)throw new Error('当前浏览器不支持 Canvas 2D');
const storage:StoragePort={
  async read(key){return localStorage.getItem(key);},
  async write(key,value){localStorage.setItem(key,value);},
  async remove(key){localStorage.removeItem(key);},
};
const audio=new GameAudio(()=>new AudioContext(),()=>Date.now(),()=>{if(!document.hidden&&session.profile?.settings.sound)view.notify('声音未能播放，请在设置中试听重试');});
let view:GameView,lastVibration=0;
function vibrate(){if(session.profile?.settings.vibration&&Date.now()-lastVibration>=500){lastVibration=Date.now();navigator.vibrate?.(15);}}
const session=new GameSession({storage,now:()=>Date.now(),random:()=>Math.random(),notify:text=>view.notify(text),present:event=>view.present(event),events:events=>{
  view.events(events);audio.play(events,session.profile?.settings.sound??false,session.match?.battle.id??session.profile?.latestResult?.matchId,session.restorationVersion);
  if(events.some(e=>e.type==='capture'))vibrate();
}});
view=new GameView(ctx,session,vibrate);
view.soundPreview=()=>audio.preview();
function resize():void{
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,3);
  const style=getComputedStyle(canvas),safeTop=parseFloat(style.getPropertyValue('--safe-area-top'))||0,safeBottom=parseFloat(style.getPropertyValue('--safe-area-bottom'))||0;
  const top=Math.max(16,safeTop-rect.top),bottom=Math.max(12,rect.bottom-window.innerHeight+safeBottom);
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);ctx!.setTransform(ratio,0,0,ratio,0,0);
  view.viewport={width:rect.width,height:rect.height,top,bottom};controls.style.top=`${top}px`;view.cancel();
}
const point=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
canvas.addEventListener('pointerdown',e=>{audio.unlock();audio.click(session.profile?.settings.sound??false);canvas.setPointerCapture(e.pointerId);const p=point(e);view.down(e.pointerId,p.x,p.y);});
canvas.addEventListener('pointermove',e=>{const p=point(e);view.move(e.pointerId,p.x,p.y);});
canvas.addEventListener('pointerup',e=>{const p=point(e);view.up(e.pointerId,p.x,p.y);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
canvas.addEventListener('pointercancel',e=>view.cancel(e.pointerId));
canvas.addEventListener('wheel',e=>{e.preventDefault();view.wheel(e.deltaY);},{passive:false});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden){view.cancel();audio.suspend();void session.suspend();}else{void retryArt().then(reportArt);}last=performance.now();});
window.addEventListener('pagehide',()=>{view.cancel();audio.suspend();void session.suspend();});
window.addEventListener('storage',e=>{if(e.key?.startsWith('territory-conquest:')){view.cancel();void session.pause('recovery');session.error='其他窗口修改了本地记录，请重新读取后继续。';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.repeat){e.preventDefault();view.escape();}});
const controls=document.querySelector<HTMLElement>('#controls')!;
let controlSignature='';
let controlModal:GameView['modal']=null,returnFocusAction:string|undefined;
function accessibleControls():void{
  const signature=view.regions.map(r=>r.id+':'+r.label).join('|'),modalChanged=controlModal!==view.modal;
  if(signature===controlSignature&&!modalChanged)return;controlSignature=signature;
  const focused=controls.contains(document.activeElement)?(document.activeElement as HTMLButtonElement).dataset.action:undefined,previousModal=controlModal;
  if(!previousModal&&view.modal)returnFocusAction=focused;controlModal=view.modal;
  const buttons=view.regions.map(r=>{const button=document.createElement('button');button.textContent=r.label;button.dataset.action=r.id;button.onclick=()=>{if(!controls.contains(button))return;audio.unlock();audio.click(session.profile?.settings.sound??false);view.regions.find(current=>current.id===r.id)?.run();};return button;});
  controls.replaceChildren(...buttons);
  if(focused){
    const target=view.modal?(modalChanged?'modal-cancel':focused):previousModal?returnFocusAction:focused;
    (buttons.find(button=>button.dataset.action===target)??buttons[0])?.focus({preventScroll:true});
  }
  if(!view.modal)returnFocusAction=undefined;
}
let last=performance.now(),remainder=0,previousPage=session.page;
function frame(now:number):void{
  const delta=Math.min(250,Math.max(0,now-last))+remainder;remainder=delta-Math.floor(delta);last=now;
  if(!view.viewportUsable){if(session.page==='battle')void session.suspend();}else if(!document.hidden)session.tick(Math.floor(delta));
  if(!session.profile?.settings.sound)audio.stop();
  if(previousPage==='battle'&&!['battle','result'].includes(session.page))audio.suspend();previousPage=session.page;
  view.draw(now);accessibleControls();requestAnimationFrame(frame);
}
resize();document.querySelector('#boot')?.remove();void session.load();requestAnimationFrame(frame);
