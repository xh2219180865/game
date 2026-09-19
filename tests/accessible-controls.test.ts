import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function harness(){
  const source=readFileSync(new URL('../src/platform/browser.ts',import.meta.url),'utf8');
  const start=source.indexOf('const controls='),end=source.indexOf('let last=',start);assert.ok(start>=0&&end>start);
  const code=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'}).code;
  const outside={};
  type Button={textContent:string;dataset:{action?:string};onclick:null|(()=>void);focus:()=>void};
  const controls={
    children:[] as Button[],
    contains(node:unknown){return this.children.includes(node as Button);},
    replaceChildren(...children:Button[]){if(this.contains(document.activeElement))document.activeElement=outside;this.children=children;},
  };
  const document={
    activeElement:outside as unknown,
    querySelector:()=>controls,
    createElement(){const button:Button={textContent:'',dataset:{},onclick:null,focus(){document.activeElement=button;}};return button;},
  };
  const view={regions:[] as {id:string;label:string;run:()=>void}[],modal:null as object|null};
  const audio={unlock(){},click(){}};
  const sync=new Function('document','view','audio','session',code+'\nreturn accessibleControls;')(document,view,audio,{profile:{settings:{sound:false}}}) as ()=>void;
  const set=(...ids:string[])=>{view.regions=ids.map(id=>({id,label:id,run(){}}));sync();};
  const button=(id:string)=>{const b=controls.children.find(b=>b.dataset.action===id);assert.ok(b);return b;};
  const focused=()=>((document.activeElement as Button).dataset?.action);
  return {view,document,controls,sync,set,button,focused,outside};
}

test('U04 U18: changing a focused card label retains keyboard focus on the same action',()=>{
  const h=harness();h.set('pause','card-supply');h.button('card-supply').focus();h.view.regions[1]!.label='乡勇 × 1';h.sync();
  assert.equal(h.focused(),'card-supply');assert.equal(h.button('card-supply').textContent,'乡勇 × 1');
});
test('U04 U18: a keyboard-opened confirmation focuses cancel and closing restores the invoking control',()=>{
  const h=harness();h.set('back','reset');h.button('reset').focus();h.view.modal={};h.set('modal-cancel','modal-confirm');assert.equal(h.focused(),'modal-cancel');
  h.button('modal-confirm').focus();h.view.modal={};h.sync();assert.equal(h.focused(),'modal-cancel','a different confirmation must not inherit destructive focus');
  h.view.modal=null;h.set('back','reset');assert.equal(h.focused(),'reset');
});
test('U04 U18: refreshing one confirmation retains explicit keyboard selection without moving outside focus',()=>{
  const h=harness();h.set('reset');h.button('reset').focus();h.view.modal={};h.set('modal-cancel','modal-confirm');h.button('modal-confirm').focus();h.view.regions[0]!.label='取消此操作';h.sync();assert.equal(h.focused(),'modal-confirm');
  h.document.activeElement=h.outside;h.view.regions[0]!.label='取消';h.sync();assert.equal(h.document.activeElement,h.outside);
});
test('U04: keyboard navigation falls back to an available action and only invokes its current handler',()=>{
  const h=harness();let old=0,current=0;h.set('primary');h.view.regions[0]!.run=()=>old++;h.button('primary').focus();h.set('back','start');assert.equal(h.focused(),'back');
  const b=h.button('start');h.view.regions[1]!.run=()=>current++;h.sync();b.onclick!();assert.equal(old,0);assert.equal(current,1);
});
for(const kind of ['page','confirmation'] as const)test(`U04: a detached ${kind} button cannot invoke a later action that reuses its ID`,()=>{
  const h=harness();let calls=0;
  const id=kind==='confirmation'?'modal-confirm':'primary';
  if(kind==='confirmation')h.view.modal={};
  h.set(id);const stale=h.button(id);
  if(kind==='confirmation')h.view.modal=null;
  h.set('back');
  if(kind==='confirmation')h.view.modal={};
  h.set(id);h.view.regions[0]!.run=()=>calls++;
  stale.onclick!();assert.equal(calls,0,'discard the old DOM event instead of redirecting it to the new action');
  h.button(id).onclick!();assert.equal(calls,1,'the current control still works');
});
